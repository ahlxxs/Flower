import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { JOBS } from './jobs.js';
import * as profiles from './profiles.js';
import { CARDS } from './cards.js';
import * as G from './game.js';
// 카드 목록 + 대상 규칙(누구를 고르는지)과 사용 불가 이유
const CARDS_JSON = JSON.stringify(CARDS.map(c => ({ ...c, target: G.targetOf(c), unusable: G.UNUSABLE[c.name] || null })));

const PORT = process.env.PORT || 3000;
const MAX_NAME = 12;
const MIN_PLAYERS = 2; // ponytail: 테스트용 최소 인원. 규칙이 정해지면 올린다.
const GRACE_MS = Number(process.env.GRACE_MS) || 10 * 60 * 1000; // 연결이 끊긴 자리를 지켜 주는 시간
// ponytail: 방과 플레이어는 메모리에만 있다. 서버가 재시작되면 모두 사라진다. 필요해지면 Redis/DB로.
const rooms = new Map();   // code -> { code, host, players: [player], started }
// ponytail: 로그인 실패 횟수는 메모리에만 (서버 재시작 시 초기화). 서버를 여러 대로 늘리면 공용 저장소로
const authTries = new Map(); // ip -> { fails, lock }
// 맵(배경). 그림은 public/maps/<이름>-back.svg·-front.svg. 'forest' 말고는 같은 이름의 배너가 있다 (그 맵에서 10번 이기면 열림)
const MAPS = ['forest', 'redcloud', 'moongeese', 'dusk', 'gold', 'sakura', 'rosechain', 'violet', 'cover', 'planet', 'crow', 'curtain', 'butterfly',
  'thicket', 'firefly', 'swamp', 'waterfall', 'ruins', 'shrine', 'sunset', 'skycity', 'henge', 'bluesmoke', 'starsmoke', 'sunforest'];
const players = new Map(); // token -> { id, token, name, room, ready, ws, timer, job, role, pkey(로그인한 프로필 key) }

// 내 프로필 + 친구 목록(접속 여부, 들어가 있는 방). 친구의 key는 절대 내보내지 않는다
const onlineAs = key => [...players.values()].find(x => x.pkey === key && x.ws);
function friendCard(key) {
  const f = profiles.getByKey(key);
  if (!f) return null;
  const v = profiles.publicView(f), on = onlineAs(key), r = on && rooms.get(on.room);
  return { nickname: v.nickname, emblem: v.emblem, photo: v.photo, color: v.color, title: v.title, lv: v.level.lv, online: !!on, room: r && !r.started ? r.code : '', playing: !!r?.started };
}
function ownView(prof) {
  const cards = list => (list || []).map(friendCard).filter(Boolean);
  return { ...profiles.ownView(prof), friends: cards(prof.friends), friendReqs: cards(prof.friendReqs), friendSent: cards(prof.friendSent) };
}
// 그 프로필로 접속해 있는 모든 곳에 메시지 하나를 보낸다
const sendTo = (key, msg) => { for (const x of players.values()) if (x.pkey === key && x.ws) send(x, msg); };
const lastInvite = new Map(); // "보낸 key>받는 key" -> 시각 (같은 친구에게 초대를 너무 자주 보내지 않게)
// 그 프로필로 접속해 있는 곳에 바뀐 내 프로필을 보낸다 (친구 신청을 받았을 때 등)
function pushProfile(prof, extra = {}) {
  for (const x of players.values()) if (x.pkey === prof.key && x.ws) send(x, { type: 'profile:me', profile: ownView(prof), ...extra });
}
// ponytail: 마왕군 수는 임시로 4명당 1명(최소 1명). 규칙이 정해지면 바꾼다.
const demonCount = n => Math.max(1, Math.floor(n / 4));

const http = createServer(async (req, res) => {
  // 정적 파일: 배경 음악 /audio/이름.mp3, 카드 그림 /cards/이름.jpg, 아이콘 /favicon.svg·/brand/이름.svg 등
  // (아이폰 사파리는 Range 요청을 지원해야 음악이 재생된다)
  const asset = req.url.match(/^\/((?:audio|cards|brand|maps)\/)?([\w-]+\.(mp3|jpg|png|svg))$/);
  if (asset) {
    const file = new URL(`./public/${asset[1] || ''}${asset[2]}`, import.meta.url);
    const size = await stat(file).then(s => s.size, () => 0);
    if (!size) { res.writeHead(404); return res.end(); }
    // 맵 그림은 다시 그려도 이름이 같으므로, 브라우저가 매번 바뀌었는지 확인하게 한다 (안 바뀌었으면 304로 짧게)
    const fresh = asset[1] === 'maps/' || asset[1] === 'brand/' || !asset[1];
    const mtime = fresh ? (await stat(file)).mtime : null;
    if (fresh && req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(mtime.toUTCString())) { res.writeHead(304); return res.end(); }
    const head = { 'content-type': { mp3: 'audio/mpeg', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' }[asset[3]], 'accept-ranges': 'bytes',
      'cache-control': fresh ? 'no-cache' : 'public, max-age=86400', ...(fresh ? { 'last-modified': mtime.toUTCString() } : {}) };
    const m = (req.headers.range || '').match(/bytes=(\d*)-(\d*)/);
    if (!m) { res.writeHead(200, { ...head, 'content-length': size }); return createReadStream(file).pipe(res); }
    const start = m[1] ? +m[1] : size - +m[2], end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (start >= size || start > end) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}` });
    return createReadStream(file, { start, end }).pipe(res);
  }
  const av = req.url.match(/^\/avatar\/([0-9a-f]{16})\.img(\?|$)/); // 올린 프로필 사진 (주소에 판 번호가 붙어 있어 오래 저장해도 된다)
  if (av) {
    const img = profiles.avatarImage(av[1]);
    if (!img) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': img.mime, 'content-length': img.buf.length, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
    return res.end(img.buf);
  }
  if (req.url === '/cards.json') { // 카드 목록 (게임 화면에서 카드를 그릴 때 사용)
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' });
    return res.end(CARDS_JSON);
  }
  if (req.url === '/health') { // 상태 확인용: 프로필 저장 위치와 개수 (비밀 값은 내보내지 않음)
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, storage: profiles.storage, profiles: profiles.count() }));
  }
  // 한 페이지짜리 앱: 모든 경로에 index.html (초대 링크는 /?room=ABCDE)
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); // 새로 올린 화면이 바로 보이게
  res.end(await readFile(new URL('./public/index.html', import.meta.url)));
});

const id = n => randomBytes(n).toString('hex');
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I 혼동 없는 글자만
  let code;
  do code = [...randomBytes(5)].map(b => abc[b % abc.length]).join('');
  while (rooms.has(code));
  return code;
}

const send = (p, msg) => p.ws?.readyState === 1 && p.ws.send(JSON.stringify(msg));
const err = (p, message) => send(p, { type: 'error', message });

// 방장을 뺀 전원이 준비하고, 최소 인원이 모이면 시작할 수 있다
const canStart = room => room.players.length >= MIN_PLAYERS && room.players.length <= JOBS.length
  && room.players.every(p => p === room.host || p.ready);

function broadcast(room) {
  // 직업은 공개, 진영은 본인에게만 보낸다
  const list = room.players.map(p => ({ id: p.id, name: p.name, host: p === room.host, ready: p.ready, online: !!p.ws, job: p.job, profile: !!p.profiled }));
  const jobs = room.started ? Object.fromEntries(JOBS.filter(j => room.players.some(p => p.job === j.name)).map(j => [j.name, j])) : null;
  for (const p of room.players) {
    send(p, { type: 'room', code: room.code, map: room.map || 'forest', players: list, you: p.id, minPlayers: MIN_PLAYERS, maxPlayers: JOBS.length,
      canStart: canStart(room), started: room.started, role: p.role, jobs });
  }
  pushGame(room); // 게임 중이면 게임 화면도 (재접속한 사람이 바로 이어서 볼 수 있게)
}

/* ---------- 게임 진행: 규칙은 game.js, 여기서는 시간 제한과 전달만 ---------- */
// 각자에게 자기 시점의 게임 정보 + 연출(fx)을 보낸다
function pushGame(room, fx = []) {
  const g = room.game;
  if (!g) return;
  const turnLeft = Math.max(0, room.turnEndsAt - Date.now());
  // fx 중 to가 있는 것(예: 관심법으로 본 손패)은 그 사람에게만
  for (const p of room.players) send(p, { type: 'game', view: { ...G.viewFor(g, p.id), turnLeft }, fx: fx.filter(f => !f.to || f.to === p.id) });
}
// 시간 제한: 공격받은 사람이 10초 안에 답하지 않으면 맞은 것으로, 차례가 60초를 넘기면 자동으로 넘긴다
function schedule(room) {
  const g = room.game;
  clearTimeout(room.timer);
  if (!g || g.over) return;
  const p = g.pending;
  if (p) { // 기다리는 일마다 시간이 지나면: 공격은 맞은 것으로, 거절 대기는 효과 적용, 고르기는 무작위로
    const act = {
      attack: () => G.react(g, p.target, null),                                   // 방어 안 함 → 맞음
      counter: () => G.resolveCounter(g),                                          // 아무도 거절 안 함 → 효과
      choice: () => G.choose(g, p.who, {}, true),                                  // 무작위로 고름
      trade: () => (p.stage === 'offer' ? G.tradeSkip(g, p.who) : G.tradeAnswer(g, p.who, { accept: false })), // 거래 안 함 / 거절
      offering: () => G.offer(g, null, null, true),                                // 못 고른 사람은 무작위로 바침
      thief: () => G.endThief(g),                                                  // 제단 공개
    }[p.kind];
    room.timer = setTimeout(() => apply(room, act), Math.max(0, p.endsAt - Date.now()));
  } else {
    room.timer = setTimeout(() => apply(room, () => G.endTurn(g, g.seats[g.turn].id)), Math.max(0, room.turnEndsAt - Date.now()));
  }
}
// 게임 동작 하나를 적용하고 결과를 모두에게 알린다
function apply(room, action, who) {
  const g = room.game, before = g.turn;
  const res = action();
  if (res.error) return who && err(who, res.error);
  const fx = res.fx || [];
  // 내 차례에 내가 쓰러졌거나(양날도끼 반동 등) 악마의 숲을 썼으면 다음 사람에게
  if (!g.over && !g.pending && (!g.seats[g.turn].alive || g.forceEnd)) fx.push(...(G.endTurn(g, g.seats[g.turn].id).fx || []));
  if (g.turn !== before || fx.some(f => f.kind === 'turn')) room.turnEndsAt = Date.now() + G.TURN_MS;
  if (g.phase !== 'action' && !g.pending) room.turnEndsAt = Date.now() + G.TURN_MS;
  pushGame(room, fx);
  schedule(room);
  if (g.over && !room.recorded) recordResults(room);
}
const newTitles = (prof, before) => profiles.titlesOf(prof).filter(t => !before.has(t.id)).map(t => t.name);
// 게임이 끝나면 로그인한 사람마다 전적과 경험치를 남기고, 바뀐 프로필을 보낸다 (게스트는 기록 없음)
function recordResults(room) {
  const g = room.game, o = g.over;
  room.recorded = true;
  for (const p of room.players) {
    const s = g.seats.find(x => x.id === p.id);
    if (!p.pkey || !s) continue;
    const win = o.winner === 'eater' ? s.id === o.id : !s.eater && s.role === o.winner;
    const before = new Set(profiles.titlesOf(profiles.getByKey(p.pkey)).map(t => t.id));
    const gain = profiles.recordGame(p.pkey, { camp: s.role, win, survived: s.alive, job: s.job, hand: s.hand.length, soul: s.soul,
      map: room.map, sealWin: !!o.seal, heroDeaths: g.seats.filter(x => x.role === 'hero' && !x.eater && !x.alive).length });
    const prof = profiles.getByKey(p.pkey);
    if (prof) send(p, { type: 'profile:me', profile: ownView(prof), gained: gain, newTitles: newTitles(prof, before) });
  }
}

// 방에서 완전히 내보낸다 (직접 나가기, 또는 끊긴 채로 GRACE_MS가 지났을 때)
function remove(p) {
  clearTimeout(p.timer);
  const room = rooms.get(p.room);
  p.room = null; p.ready = false;
  if (!room) return;
  room.players = room.players.filter(x => x !== p);
  if (!room.players.length) { clearTimeout(room.timer); return rooms.delete(room.code); }
  if (room.host === p) room.host = room.players.find(x => x.ws) || room.players[0]; // 접속 중인 사람에게 방장을 넘긴다
  broadcast(room);
}

new WebSocketServer({ server: http, maxPayload: 512 * 1024 }) // 메시지 하나는 512KB까지 (프로필 사진 포함)
.on('connection', (ws, req) => {
  let me = null;
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  ws.on('close', () => {
    if (!me || me.ws !== ws) return; // 이미 새 연결로 바뀐 경우
    me.ws = null;
    if (!me.room) return players.delete(me.token);
    broadcast(rooms.get(me.room));
    const p = me;
    p.timer = setTimeout(() => { remove(p); players.delete(p.token); }, GRACE_MS);
  });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // 첫 메시지: 저장해 둔 토큰이 있으면 그 자리로 돌아간다
    if (msg.type === 'hello') {
      if (me) return;
      me = players.get(String(msg.token ?? ''));
      if (me) {
        clearTimeout(me.timer);
        if (me.ws) { send(me, { type: 'replaced' }); me.ws.close(); } // 같은 자리를 다른 탭이 가져감
      } else {
        me = { id: id(4), token: id(16), name: '', room: null, ready: false, ws: null, timer: null };
        players.set(me.token, me);
      }
      me.ws = ws;
      send(me, { type: 'welcome', token: me.token, inRoom: !!me.room });
      if (me.room) broadcast(rooms.get(me.room));
      return;
    }
    if (!me) return;
    const room = rooms.get(me.room);

    // ---------- 프로필 ----------
    if (msg.type === 'profile:me') {
      const prof = profiles.getByKey(msg.key);
      me.pkey = prof?.key || null; // 이 연결은 이 프로필로 접속 중 (친구 목록의 "접속 중")
      return send(me, { type: 'profile:me', profile: prof && ownView(prof) });
    }
    // ---------- 로그인 / 회원가입 ----------
    if (msg.type === 'auth:login' || msg.type === 'auth:signup') {
      const tries = authTries.get(ip) || { fails: 0, lock: 0 };
      if (tries.lock > Date.now()) return send(me, { type: 'auth:error', message: `로그인 시도가 너무 많습니다. ${Math.ceil((tries.lock - Date.now()) / 1000)}초 뒤에 다시 해 주세요.` });
      const res = msg.type === 'auth:login' ? profiles.login(msg) : profiles.signup(msg);
      if (res.error) {
        if (msg.type === 'auth:login' && ++tries.fails >= 5) { tries.fails = 0; tries.lock = Date.now() + 30000; } // 같은 곳에서 5번 틀리면 30초 쉬기
        authTries.set(ip, tries);
        return send(me, { type: 'auth:error', message: res.error });
      }
      authTries.delete(ip);
      me.pkey = res.profile.key;
      return send(me, { type: 'auth:ok', key: res.profile.key, profile: ownView(res.profile), signup: msg.type === 'auth:signup' });
    }
    if (msg.type === 'profile:save') {
      if (!profiles.getByKey(msg.key)) return send(me, { type: 'profile:error', message: '로그인하면 프로필을 고칠 수 있습니다.' });
      const res = profiles.save(msg.key, msg);
      if (res.error) return send(me, { type: 'profile:error', message: res.error });
      return send(me, { type: 'profile:me', key: res.profile.key, profile: ownView(res.profile), saved: true });
    }
    if (msg.type === 'profile:avatar') { // 내 사진을 문장으로 올리기
      const res = profiles.setAvatarImage(msg.key, msg.data);
      if (res.error) return send(me, { type: 'profile:error', message: res.error });
      return send(me, { type: 'profile:me', profile: ownView(res.profile), avatarSaved: true });
    }
    if (msg.type === 'profile:title') { // 도감이나 기록부에서 칭호 달기
      const res = profiles.setTitle(msg.key, String(msg.id ?? ''));
      if (res.error) return send(me, { type: 'profile:error', message: res.error });
      return send(me, { type: 'profile:me', profile: ownView(res.profile), titled: true });
    }
    if (['friend:request', 'friend:accept', 'friend:decline', 'friend:remove'].includes(msg.type)) { // 친구
      const nick = String(msg.nickname ?? ''), titled = x => new Set(x ? profiles.titlesOf(x).map(t => t.id) : []);
      const mine = titled(profiles.getByKey(msg.key)), theirs = titled(profiles.getByName(nick)); // 친구 수 칭호(인맥·슈퍼스타) 알림용
      const res = msg.type === 'friend:request' ? profiles.friendRequest(msg.key, nick)
        : msg.type === 'friend:remove' ? profiles.friendRemove(msg.key, nick) : profiles.friendAnswer(msg.key, nick, msg.type === 'friend:accept');
      if (res.error) return send(me, { type: 'profile:error', message: res.error, friend: true });
      pushProfile(res.other, { friendNotice: res.notice, newTitles: newTitles(res.other, theirs) }); // 상대 화면도 바로 바뀐다
      pushProfile(res.profile, { friendDone: msg.type, newTitles: newTitles(res.profile, mine) });
      return;
    }
    if (msg.type === 'friend:invite') { // 내가 있는 방으로 친구 초대
      const prof = profiles.getByKey(msg.key), f = profiles.getByName(String(msg.nickname ?? ''));
      if (!prof || !f || !prof.friends?.includes(f.key)) return send(me, { type: 'profile:error', message: '친구만 초대할 수 있습니다.', friend: true });
      if (!room || room.started) return send(me, { type: 'profile:error', message: '대기실에 있을 때 초대할 수 있습니다.', friend: true });
      const pair = prof.key + '>' + f.key;
      if (Date.now() - (lastInvite.get(pair) || 0) < 10000) return send(me, { type: 'profile:error', message: '잠시 뒤에 다시 초대해 주세요.', friend: true });
      lastInvite.set(pair, Date.now());
      sendTo(f.key, { type: 'friend:invite', from: prof.nickname, code: room.code });
      return send(me, { type: 'friend:invited', nickname: f.nickname });
    }
    if (msg.type === 'title:sparkle') { // 홈 화면 마법진이 겹치는 순간을 봄 (숨겨진 칭호)
      const prof = profiles.getByKey(msg.key);
      if (prof && profiles.setFlag(msg.key, 'sparkle')) send(me, { type: 'profile:me', profile: ownView(prof), newTitles: ['반짝 반짝'] });
      return;
    }
    if (msg.type === 'codex') return send(me, { type: 'codex', titles: profiles.codexOf(profiles.getByKey(msg.key)) }); // 게스트도 도감은 볼 수 있음
    if (msg.type === 'profile:find') return send(me, { type: 'profile:list', q: msg.q, results: profiles.search(msg.q) });
    if (msg.type === 'profile:view') {
      const prof = profiles.getByName(msg.nickname);
      return send(me, { type: 'profile:view', nickname: msg.nickname, profile: prof && profiles.publicView(prof) });
    }

    if (msg.type === 'create' || msg.type === 'join') {
      // 프로필이 있으면 프로필 닉네임으로 들어간다. 없으면 게스트 (등록된 닉네임은 쓸 수 없음)
      const prof = profiles.getByKey(msg.key);
      const name = prof ? prof.nickname : String(msg.name ?? '').trim().slice(0, MAX_NAME);
      if (!name) return err(me, '닉네임을 입력하세요.');
      if (!prof && profiles.getByName(name)) return err(me, '프로필로 등록된 닉네임입니다. 다른 닉네임을 쓰거나 그 프로필로 접속하세요.');
      const code = msg.type === 'create' ? newCode() : String(msg.code ?? '').trim().toUpperCase();
      const target = msg.type === 'create' ? { code, host: me, players: [], started: false, map: 'forest' } : rooms.get(code);
      if (!target) return err(me, '존재하지 않는 방입니다.');
      if (target === room) return broadcast(room);
      // 같은 이름의 자리가 끊겨 있으면 그 자리를 이어받는다 (탭을 닫았다가 다시 들어온 경우)
      const seat = target.players.find(p => p.name === name);
      if (seat?.ws) return err(me, '이미 같은 닉네임이 방에 있습니다.');
      if (target.started && !seat) return err(me, '이미 게임이 시작된 방입니다.');
      if (room) remove(me);
      if (target.players.length >= JOBS.length && !seat) return err(me, `방이 가득 찼습니다. (최대 ${JOBS.length}명)`);
      if (msg.type === 'create') rooms.set(code, target);
      me.name = name; me.room = code; me.profiled = !!prof; me.pkey = prof?.key || null;
      if (seat) {
        clearTimeout(seat.timer); players.delete(seat.token);
        me.ready = seat.ready; me.job = seat.job; me.role = seat.role;
        target.players[target.players.indexOf(seat)] = me;
        if (target.host === seat) target.host = me;
      } else {
        me.ready = false; me.job = null; me.role = null;
        target.players.push(me);
      }
      broadcast(target); // started 값으로 클라이언트가 게임 화면으로 바로 간다
      if (msg.type === 'create' && prof) for (const k of prof.friends || []) sendTo(k, { type: 'friend:room', from: prof.nickname, code }); // 친구에게 "방을 만들었어요" 알림
    } else if (msg.type === 'map') { // 방장이 맵(배경)을 고른다. 게임 중에는 바꿀 수 없다
      if (!room || room.host !== me || room.started || !MAPS.includes(msg.map)) return;
      room.map = msg.map;
      broadcast(room);
    } else if (msg.type === 'ready') {
      if (!room || room.started) return;
      me.ready = !!msg.ready;
      broadcast(room);
    } else if (msg.type === 'start') {
      if (!room || room.host !== me || room.started) return;
      if (!canStart(room)) return err(me, '모두 준비해야 시작할 수 있습니다.');
      room.started = true;
      const jobs = shuffle(JOBS.map(j => j.name));
      const demons = new Set(shuffle([...room.players]).slice(0, demonCount(room.players.length)));
      room.players.forEach((p, i) => { p.job = jobs[i]; p.role = demons.has(p) ? 'demon' : 'hero'; });
      room.recorded = false;
      room.game = G.newGame(room.players.map(p => ({ id: p.id, name: p.name, role: p.role, job: p.job })), shuffle);
      room.turnEndsAt = Date.now() + G.TURN_MS + 6000; // 시작 연출·운명 공개를 보는 시간만큼 더
      for (const p of room.players) send(p, { type: 'start' }); // 먼저 보내야 클라이언트가 로딩부터 띄운다
      broadcast(room);
      schedule(room);
    } else if (['use', 'react', 'counter', 'choose', 'end', 'tradeOffer', 'tradeSkip', 'tradeAnswer', 'tradeUnfair', 'offer', 'thief'].includes(msg.type)) {
      if (!room?.game) return;
      const g = room.game, num = v => (v === null || v === undefined ? null : Number(v));
      const actions = {
        use: () => G.useCard(g, me.id, num(msg.index), { target: msg.target, target2: msg.target2, give: num(msg.give) }),
        react: () => G.react(g, me.id, num(msg.index)),
        counter: () => G.counter(g, me.id, num(msg.index)),
        choose: () => G.choose(g, me.id, msg.data || {}),
        end: () => G.endTurn(g, me.id),
        tradeOffer: () => G.tradeOffer(g, me.id, { target: msg.target, index: num(msg.index), claim: msg.claim }),
        tradeSkip: () => G.tradeSkip(g, me.id),
        tradeAnswer: () => G.tradeAnswer(g, me.id, { accept: !!msg.accept, index: num(msg.index), claim: msg.claim }),
        tradeUnfair: () => G.useCard(g, me.id, num(msg.index), { target: msg.target, asTrade: true }), // 거래 턴에 불공정 거래를 거래 대신
        offer: () => G.offer(g, me.id, num(msg.index)),
        thief: () => G.thief(g, me.id, num(msg.index)),
      };
      apply(room, actions[msg.type], me);
    } else if (msg.type === 'debugHand' && process.env.ARCANA_TEST && room?.game) { // 테스트 전용: 손패 지정 (실제 서버에서는 꺼져 있음)
      const st = room.game.seats.find(x => x.id === me.id);
      st.hand = msg.names.map(n => CARDS.find(c => c.name === n).id);
      pushGame(room);
    } else if (msg.type === 'debugOver' && process.env.ARCANA_TEST && room?.game) { // 테스트 전용: 바로 게임 끝내기
      room.game.over = { winner: msg.winner === 'demon' ? 'demon' : 'hero' };
      apply(room, () => ({ fx: [{ kind: 'over' }] }));
    } else if (msg.type === 'backToLobby') { // 게임이 끝나면 같은 방 대기실로
      if (!room?.game?.over) return;
      clearTimeout(room.timer);
      room.game = null; room.started = false;
      for (const p of room.players) { p.ready = false; p.job = null; p.role = null; }
      broadcast(room);
    } else if (msg.type === 'leave') {
      remove(me);
      send(me, { type: 'left' });
    }
  });
});

http.listen(PORT, () => console.log(`http://localhost:${PORT}`));
