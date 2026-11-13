// 프로필 저장소. 프로필의 주인은 기기에 저장된 비밀 열쇠(key)로 구분한다 (로그인 없음).
// 저장 위치: 환경 변수 DATABASE_URL이 있으면 PostgreSQL(Neon 등), 없으면 DATA_DIR의 JSON 파일(개발용).
// ponytail: 시작할 때 전부 메모리로 읽고, 바뀐 프로필만 DB에 쓴다. 서버가 한 대일 때만 맞는 방식.
//           여러 대로 늘리면 닉네임 중복 검사를 DB의 UNIQUE 제약으로 옮겨야 한다.
import { readFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { writeFile, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const DIR = process.env.DATA_DIR || new URL('./data', import.meta.url).pathname;
const FILE = join(DIR, 'profiles.json');
export const EMBLEMS = ['sword', 'shield', 'star', 'moon', 'heart', 'eye'];
export const COLORS = ['amber', 'jade', 'crimson', 'violet', 'silver'];
const NAME = /^[\p{L}\p{N}_ ]{2,12}$/u; // 글자·숫자·밑줄·띄어쓰기 2~12자
const MAX_INTRO = 80;

// 칭호: test(profile)가 참이면 얻는다. 조건은 stats를 보고 판단한다 (예: 5연승 → p.stats.bestStreak >= 5)
export const TITLES = [
  { id: 'novice', name: '새내기 모험가', desc: '프로필을 처음 만들었습니다.', test: () => true },
];

const byKey = new Map();  // key -> profile
const byName = new Map(); // 소문자 닉네임 -> key
const db = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 }) : null;
let loaded;
export const storage = db ? 'database' : 'file'; // /health에서 보여 줌
if (db) {
  await db.query('CREATE TABLE IF NOT EXISTS profiles (key text PRIMARY KEY, data jsonb NOT NULL)');
  loaded = (await db.query('SELECT data FROM profiles')).rows.map(r => r.data);
  console.log(`프로필 ${loaded.length}개를 데이터베이스에서 불러왔습니다.`);
} else {
  try { loaded = JSON.parse(readFileSync(FILE, 'utf8')); } catch { loaded = []; } // 첫 실행: 파일 없음
}
for (const p of loaded) { byKey.set(p.key, p); byName.set(p.nickname.toLowerCase(), p.key); }

let saveTimer, dbQueue = Promise.resolve();
function persist(p) {
  if (db) { // 바뀐 프로필 하나만 순서대로 저장
    dbQueue = dbQueue.then(() => db.query('INSERT INTO profiles (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = $2', [p.key, p]))
      .catch(e => console.error('프로필 저장 실패:', e.message));
    return;
  }
  clearTimeout(saveTimer); // 파일: 변경이 몰려도 0.5초에 한 번만, 임시 파일에 쓴 뒤 바꿔치기해서 깨지지 않게
  saveTimer = setTimeout(async () => {
    mkdirSync(DIR, { recursive: true });
    await writeFile(FILE + '.tmp', JSON.stringify([...byKey.values()]));
    await rename(FILE + '.tmp', FILE);
  }, 500);
}

export const count = () => byKey.size;
export const getByKey = key => byKey.get(String(key ?? '')) || null;
export const getByName = name => byKey.get(byName.get(String(name ?? '').trim().toLowerCase())) || null;
export const titlesOf = p => TITLES.filter(t => t.test(p));

// 다른 사람에게 보여 줄 정보 (key는 절대 내보내지 않는다)
export function publicView(p) {
  const title = TITLES.find(t => t.id === p.title);
  return { nickname: p.nickname, intro: p.intro, emblem: p.emblem, color: p.color, title: title?.name || '', stats: p.stats, createdAt: p.createdAt };
}
// 본인에게 보여 줄 정보 (+ 고를 수 있는 칭호)
export const ownView = p => ({ ...publicView(p), titleId: p.title, titles: titlesOf(p).map(({ id, name, desc }) => ({ id, name, desc })) });

export function search(q) {
  q = String(q ?? '').trim().toLowerCase();
  if (!q) return [];
  return [...byName.entries()].filter(([n]) => n.includes(q)).sort(([a], [b]) => (a.startsWith(q) ? 0 : 1) - (b.startsWith(q) ? 0 : 1) || a.localeCompare(b))
    .slice(0, 8).map(([, key]) => publicView(byKey.get(key)));
}

// 만들기(key 없음) 또는 고치기. 성공하면 { profile }, 실패하면 { error }
export function save(key, input) {
  const p = key ? getByKey(key) : null;
  if (key && !p) return { error: '프로필을 찾을 수 없습니다. 새로 만들어 주세요.' };
  const nickname = String(input.nickname ?? '').trim();
  if (!NAME.test(nickname)) return { error: '닉네임은 글자·숫자 2~12자로 정해 주세요.' };
  const owner = byName.get(nickname.toLowerCase());
  if (owner && owner !== p?.key) return { error: '이미 다른 사람이 쓰는 닉네임입니다.' };
  const intro = String(input.intro ?? '').trim().slice(0, MAX_INTRO);
  const emblem = EMBLEMS.includes(input.emblem) ? input.emblem : 'star';
  const color = COLORS.includes(input.color) ? input.color : 'amber';
  const next = p || { key: randomBytes(16).toString('hex'), createdAt: Date.now(),
    stats: { games: 0, wins: 0, heroWins: 0, demonWins: 0, streak: 0, bestStreak: 0 } };
  const title = titlesOf(next).some(t => t.id === input.title) ? input.title : (p?.title || TITLES[0].id);
  if (p) byName.delete(p.nickname.toLowerCase());
  Object.assign(next, { nickname, intro, emblem, color, title });
  byKey.set(next.key, next); byName.set(nickname.toLowerCase(), next.key);
  persist(next);
  return { profile: next };
}
