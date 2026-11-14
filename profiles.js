// 프로필 저장소. 프로필의 주인은 기기에 저장된 비밀 열쇠(key)로 구분한다 (로그인 없음).
// 저장 위치: 환경 변수 DATABASE_URL이 있으면 PostgreSQL(Neon 등), 없으면 DATA_DIR의 JSON 파일(개발용).
// ponytail: 시작할 때 전부 메모리로 읽고, 바뀐 프로필만 DB에 쓴다. 서버가 한 대일 때만 맞는 방식.
//           여러 대로 늘리면 닉네임 중복 검사를 DB의 UNIQUE 제약으로 옮겨야 한다.
import { readFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { writeFile, rename } from 'node:fs/promises';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';

const DIR = process.env.DATA_DIR || new URL('./data', import.meta.url).pathname;
const FILE = join(DIR, 'profiles.json');
export const EMBLEMS = ['king', 'queen', 'bishop', 'blade', 'feather', 'infinity', 'tide', 'key', 'lantern']; // 문장 (이름과 그림은 클라이언트의 MARKS)
export const COLORS = ['amber', 'jade', 'crimson', 'violet', 'silver'];
export const BANNERS = ['none', 'gold', 'dusk', 'sakura', 'rosechain', 'violet', 'bluesmoke', 'starsmoke', 'sunforest', 'moongeese', 'redcloud',
  'butterfly', 'curtain', 'crow', 'cover', 'planet']; // 프로필 배너·칭호 배너 (그림은 클라이언트)
// 관리자 계정: 모든 칭호와 모든 배너를 가진다. 환경 변수 ADMIN_LOGINS(쉼표로 구분)로 바꿀 수 있음
const ADMINS = new Set((process.env.ADMIN_LOGINS ?? 'lliooli').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
export const isAdmin = p => !!p?.login && ADMINS.has(p.login);
// 배너 잠금: 배너마다 여는 조건 test(p). 조건은 나중에 정한다 → 지금은 모두 잠김 ('none'은 항상)
const BANNER_UNLOCK = {};
export const bannersOf = p => BANNERS.filter(b => b === 'none' || isAdmin(p) || !!BANNER_UNLOCK[b]?.(p));
const NAME = /^[\p{L}\p{N}_ ]{2,12}$/u; // 글자·숫자·밑줄·띄어쓰기 2~12자
const MAX_INTRO = 80;

// 칭호: 기획 원문의 "칭호 : 달성조건" 그대로. goal이 있으면 count(stats)가 goal 이상일 때, flag가 있으면 stats.flags[flag]가 켜졌을 때 얻는다.
// hidden: 얻기 전에는 도감에서 이름과 조건을 가린다
const jobWins = job => st => st.jobWins?.[job] || 0;
export const TITLES = [
  { id: 'novice', name: '새내기 모험가', desc: '프로필을 처음 만들었습니다.', goal: 0, count: () => 0 },
  { id: 'seer', name: '선지자', desc: '아르카나로 게임 10회 이상 승리.', goal: 10, count: jobWins('아르카나') },
  { id: 'chosen', name: '선택받은자', desc: '용사로 게임 10회 이상 승리.', goal: 10, count: jobWins('용사') },
  { id: 'genesis', name: '천지창조', desc: '마법사로 게임 10회 이상 승리.', goal: 10, count: jobWins('마법사') },
  { id: 'oracle', name: '신의 계시', desc: '사제로 게임 10회 이상 승리.', goal: 10, count: jobWins('사제') },
  { id: 'faith', name: '부서지지 않는 신념', desc: '방패병으로 게임 10회 이상 승리.', goal: 10, count: jobWins('방패병') },
  { id: 'tamer', name: '야수를 길들인자', desc: '비스트테이머로 게임 10회 이상 승리.', goal: 10, count: jobWins('비스트 테이머') },
  { id: 'bullseye', name: '백발백중', desc: '궁수로 게임 10회 이상 승리.', goal: 10, count: jobWins('궁수') },
  { id: 'fingers', name: '나쁜 손버릇', desc: '도적으로 게임 10회 이상 승리.', goal: 10, count: jobWins('도적') },
  { id: 'dream', name: '일장춘몽', desc: '몽상가로 게임 10회 이상 승리.', goal: 10, count: jobWins('몽상가') },
  { id: 'deal', name: '거래를 제안하지!', desc: '상인으로 게임 10회 이상 승리.', goal: 10, count: jobWins('상인') },
  { id: 'bloody', name: '피범벅', desc: '버서커로 게임 10회 이상 승리.', goal: 10, count: jobWins('버서커') },
  { id: 'rise', name: '일어나라', desc: '네크로맨서로 게임 10회 이상 승리.', goal: 10, count: jobWins('네크로맨서') },
  { id: 'paradox', name: '모순 사랑꾼', desc: '박애주의자로 게임 10회 이상 승리.', goal: 10, count: jobWins('박애주의자') },
  { id: 'alchemy', name: '무에서 유를 만들다', desc: '연금술사로 게임 10회 이상 승리.', goal: 10, count: jobWins('연금술사') },
  { id: 'demonlord', name: '마왕', desc: '마왕군으로 게임 10회 이상 승리.', goal: 10, count: st => st.demonWins || 0 },
  { id: 'lover', name: '연인', desc: '특정 플레이어와 연인계약 맺기.', flag: 'lover' },
  { id: 'legend', name: '전설', desc: '게임 50회 이상 승리.', goal: 50, count: st => st.wins || 0 },
  { id: 'sulky', name: '나 안삐졌어', desc: '3연패 이상 달성', goal: 3, count: st => st.bestLossStreak || 0 },
  { id: 'doom', name: '종말 구도자', desc: '용사파티를 한명도 죽이지 않고 제단완성으로 승리. (마왕군일때만)', flag: 'doom' },
  { id: 'network', name: '인맥', desc: '친구 10명 이상 보유', goal: 10, count: (st, p) => p.friends?.length || 0 },
  { id: 'superstar', name: '슈퍼스타', desc: '친구 20명 이상 보유', goal: 20, count: (st, p) => p.friends?.length || 0 },
  { id: 'flawless', name: '완전무결', desc: '게임 종료시 hp(소울하트 제외) 10 이상.', flag: 'flawless' },
  { id: 'changer', name: '게임 체인저', desc: '게임 종료시 hp(소울하트 포함) 1 이하', flag: 'changer' },
  { id: 'sparkle', name: '반짝 반짝', desc: '홈 화면의 마법진이 맞춰지는걸 목격', flag: 'sparkle', hidden: true },
];
const hasTitle = (t, p) => { if (isAdmin(p)) return true; const st = p.stats || {}; return t.flag ? !!st.flags?.[t.flag] : t.count(st, p) >= t.goal; };

const byKey = new Map();  // key -> profile
const byName = new Map(); // 소문자 닉네임 -> key
const byLogin = new Map(); // 소문자 로그인 아이디 -> key
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
for (const p of loaded) { byKey.set(p.key, p); byName.set(p.nickname.toLowerCase(), p.key); if (p.login) byLogin.set(p.login, p.key); }

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
export const titlesOf = p => TITLES.filter(t => hasTitle(t, p));
// 도감에 보여 줄 칭호 전체: 얻었는지, 진행도(cur / goal). 숨겨진 칭호는 얻기 전까지 가린다
export const codexOf = p => TITLES.map(t => {
  const got = !!p && hasTitle(t, p);
  if (t.hidden && !got) return { id: t.id, name: '???', desc: '숨겨진 칭호입니다.', got, hidden: true };
  return { id: t.id, name: t.name, desc: t.desc, got, goal: t.goal || 0, cur: t.goal && p ? Math.min(t.goal, t.count(p.stats || {}, p)) : 0 };
});

/* ---------- 경험치와 레벨 ----------
   한 판: 참가 40 + 승리 60 + 끝까지 살아남음 10 (보통 한 판에 40~110, 평균 약 75)
   다음 레벨까지 필요한 경험치: 1~19레벨은 60에서 8씩 늘어남 (20레벨까지 합계 2,508 ≈ 33판)
   20레벨부터는 레벨마다 10%씩 늘어남 (30레벨 ≈ 550/레벨, 40레벨 ≈ 1,430/레벨, 50레벨 ≈ 3,700/레벨). 최고 99레벨 */
export const XP = { play: 40, win: 60, survive: 10 };
export const MAX_LEVEL = 99;
export const xpNeed = lv => lv < 20 ? 60 + 8 * (lv - 1) : Math.round(212 * 1.1 ** (lv - 19) / 5) * 5;
export function levelOf(xp = 0) {
  let lv = 1, into = Math.max(0, xp);
  while (lv < MAX_LEVEL && into >= xpNeed(lv)) { into -= xpNeed(lv); lv++; }
  return { lv, xp, into, need: lv < MAX_LEVEL ? xpNeed(lv) : 0 };
}
const blankStats = () => ({ games: 0, wins: 0, heroGames: 0, heroWins: 0, demonGames: 0, demonWins: 0, streak: 0, bestStreak: 0,
  lossStreak: 0, bestLossStreak: 0, xp: 0, recent: [], jobWins: {}, flags: {} });
// 게임이 끝나면 한 사람의 결과를 기록한다. camp: 'hero' | 'demon'. 얻은 경험치를 돌려준다
// 칭호용: job(직업), hand(손패 = hp), soul(소울하트), sealWin(제단 완성으로 끝남), heroDeaths(죽은 용사 파티 수)
export function recordGame(key, { camp, win, survived, job, hand = 0, soul = 0, sealWin = false, heroDeaths = 0 }) {
  const p = getByKey(key);
  if (!p) return 0;
  const st = p.stats = { ...blankStats(), ...p.stats };
  const gain = XP.play + (win ? XP.win : 0) + (survived ? XP.survive : 0);
  st.games++; st.xp += gain;
  if (camp === 'demon') { st.demonGames++; if (win) st.demonWins++; } else { st.heroGames++; if (win) st.heroWins++; }
  if (win) { st.wins++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); st.lossStreak = 0; }
  else { st.streak = 0; st.lossStreak++; st.bestLossStreak = Math.max(st.bestLossStreak, st.lossStreak); }
  st.jobWins = { ...st.jobWins }; st.flags = { ...st.flags };
  if (win && job) st.jobWins[job] = (st.jobWins[job] || 0) + 1;
  if (win && camp === 'demon' && sealWin && !heroDeaths) st.flags.doom = true;
  if (survived && hand >= 10) st.flags.flawless = true;                // 살아서 끝났고 손패 10장 이상
  if (survived && hand + soul <= 1) st.flags.changer = true;           // 살아서 끝났고 손패 + 소울하트 1 이하
  st.recent = [...st.recent, (camp === 'demon' ? 'd' : 'h') + (win ? 1 : 0)].slice(-24); // 최근 판 (진영 + 승패)
  persist(p);
  return gain;
}

// 다른 사람에게 보여 줄 정보 (key는 절대 내보내지 않는다)
export function publicView(p) {
  const title = TITLES.find(t => t.id === p.title);
  const stats = { ...blankStats(), ...p.stats };
  return { nickname: p.nickname, intro: p.intro, emblem: EMBLEMS.includes(p.emblem) ? p.emblem : EMBLEMS[0], color: p.color, banner: bannersOf(p).includes(p.banner) ? p.banner : 'none', tbanner: bannersOf(p).includes(p.tbanner) ? p.tbanner : 'none', title: title?.name || '', stats, level: levelOf(stats.xp), createdAt: p.createdAt };
}
// 본인에게 보여 줄 정보 (+ 고를 수 있는 칭호)
export const ownView = p => ({ ...publicView(p), login: p.login || '', titleId: p.title, titles: titlesOf(p).map(({ id, name, desc }) => ({ id, name, desc })), codex: codexOf(p), banners: bannersOf(p), admin: isAdmin(p) });

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
  const emblem = EMBLEMS.includes(input.emblem) ? input.emblem : EMBLEMS[0];
  const color = COLORS.includes(input.color) ? input.color : 'amber';
  const owned = bannersOf(p); // 잠긴 배너는 고를 수 없다
  const banner = owned.includes(input.banner) ? input.banner : owned.includes(p?.banner) ? p.banner : 'none';
  const tbanner = owned.includes(input.tbanner) ? input.tbanner : owned.includes(p?.tbanner) ? p.tbanner : 'none';
  const next = p || { key: randomBytes(16).toString('hex'), createdAt: Date.now(), stats: blankStats() };
  const title = titlesOf(next).some(t => t.id === input.title) ? input.title : (p?.title || TITLES[0].id);
  if (p) byName.delete(p.nickname.toLowerCase());
  Object.assign(next, { nickname, intro, emblem, color, banner, tbanner, title });
  byKey.set(next.key, next); byName.set(nickname.toLowerCase(), next.key);
  persist(next);
  return { profile: next };
}

/* ---------- 계정: 아이디 + 비밀번호 ----------
   비밀번호는 원문을 저장하지 않고 scrypt 해시만 저장한다. 로그인에 성공하면 프로필 key(세션 열쇠)를 돌려준다. */
const LOGIN = /^[a-z0-9_]{3,16}$/; // 영문 소문자·숫자·밑줄 3~16자
const hash = (password, salt) => scryptSync(String(password), salt, 32).toString('hex');
const loginErr = (login, password) => {
  if (!LOGIN.test(login)) return '아이디는 영문·숫자·밑줄(_) 3~16자로 정해 주세요.';
  if (String(password ?? '').length < 6) return '비밀번호는 6자 이상으로 정해 주세요.';
  if (String(password).length > 100) return '비밀번호가 너무 깁니다.';
  return '';
};
// 가입: 이 기기에 비밀번호 없는 예전 프로필(legacyKey)이 있으면 그 프로필에 계정을 붙인다
export function signup({ login, password, nickname, legacyKey }) {
  login = String(login ?? '').trim().toLowerCase();
  const e = loginErr(login, password); if (e) return { error: e };
  if (byLogin.has(login)) return { error: '이미 사용 중인 아이디입니다.' };
  let p = getByKey(legacyKey);
  if (p && p.login) p = null; // 이미 계정이 있는 프로필은 이어받지 않는다
  if (!p) {
    const res = save(null, { nickname, emblem: EMBLEMS[0], color: 'amber' });
    if (res.error) return res;
    p = res.profile;
  }
  const salt = randomBytes(16).toString('hex');
  Object.assign(p, { login, salt, pass: hash(password, salt) });
  byLogin.set(login, p.key);
  persist(p);
  return { profile: p };
}
// 표시 플래그 켜기 (예: 홈 화면 마법진 목격). 새로 켜졌으면 true
export function setFlag(key, flag) {
  const p = getByKey(key);
  if (!p || !['sparkle'].includes(flag)) return false;
  p.stats = { ...blankStats(), ...p.stats }; p.stats.flags = { ...p.stats.flags };
  if (p.stats.flags[flag]) return false;
  p.stats.flags[flag] = true; persist(p);
  return true;
}
// 대표 칭호 바꾸기 (얻은 칭호만)
export function setTitle(key, id) {
  const p = getByKey(key);
  if (!p) return { error: '로그인하면 칭호를 달 수 있습니다.' };
  if (!titlesOf(p).some(t => t.id === id)) return { error: '아직 얻지 못한 칭호입니다.' };
  p.title = id; persist(p);
  return { profile: p };
}
export function login({ login, password }) {
  login = String(login ?? '').trim().toLowerCase();
  const p = byKey.get(byLogin.get(login));
  const fail = { error: '아이디 또는 비밀번호가 맞지 않습니다.' };
  if (!p) { hash(password, 'x'.repeat(32)); return fail; } // 없는 아이디도 같은 시간이 걸리게
  const a = Buffer.from(hash(password, p.salt), 'hex'), b = Buffer.from(p.pass, 'hex');
  return a.length === b.length && timingSafeEqual(a, b) ? { profile: p } : fail;
}
