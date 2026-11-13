import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { JOBS } from './jobs.js';
import * as profiles from './profiles.js';

const PORT = process.env.PORT || 3000;
const MAX_NAME = 12;
const MIN_PLAYERS = 2; // ponytail: 테스트용 최소 인원. 규칙이 정해지면 올린다.
const GRACE_MS = Number(process.env.GRACE_MS) || 10 * 60 * 1000; // 연결이 끊긴 자리를 지켜 주는 시간
// ponytail: 방과 플레이어는 메모리에만 있다. 서버가 재시작되면 모두 사라진다. 필요해지면 Redis/DB로.
const rooms = new Map();   // code -> { code, host, players: [player], started }
const players = new Map(); // token -> { id, token, name, room, ready, ws, timer, job, role }
// ponytail: 마왕군 수는 임시로 4명당 1명(최소 1명). 규칙이 정해지면 바꾼다.
const demonCount = n => Math.max(1, Math.floor(n / 4));

const http = createServer(async (req, res) => {
  // 한 페이지짜리 앱: 모든 경로에 index.html (초대 링크는 /?room=ABCDE)
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
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
    send(p, { type: 'room', code: room.code, players: list, you: p.id, minPlayers: MIN_PLAYERS, maxPlayers: JOBS.length,
      canStart: canStart(room), started: room.started, role: p.role, jobs });
  }
}

// 방에서 완전히 내보낸다 (직접 나가기, 또는 끊긴 채로 GRACE_MS가 지났을 때)
function remove(p) {
  clearTimeout(p.timer);
  const room = rooms.get(p.room);
  p.room = null; p.ready = false;
  if (!room) return;
  room.players = room.players.filter(x => x !== p);
  if (!room.players.length) return rooms.delete(room.code);
  if (room.host === p) room.host = room.players.find(x => x.ws) || room.players[0]; // 접속 중인 사람에게 방장을 넘긴다
  broadcast(room);
}

new WebSocketServer({ server: http }).on('connection', ws => {
  let me = null;

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
      return send(me, { type: 'profile:me', profile: prof && profiles.ownView(prof) });
    }
    if (msg.type === 'profile:save') {
      const res = profiles.save(msg.key, msg);
      if (res.error) return send(me, { type: 'profile:error', message: res.error });
      return send(me, { type: 'profile:me', key: res.profile.key, profile: profiles.ownView(res.profile), saved: true });
    }
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
      const target = msg.type === 'create' ? { code, host: me, players: [], started: false } : rooms.get(code);
      if (!target) return err(me, '존재하지 않는 방입니다.');
      if (target === room) return broadcast(room);
      // 같은 이름의 자리가 끊겨 있으면 그 자리를 이어받는다 (탭을 닫았다가 다시 들어온 경우)
      const seat = target.players.find(p => p.name === name);
      if (seat?.ws) return err(me, '이미 같은 닉네임이 방에 있습니다.');
      if (target.started && !seat) return err(me, '이미 게임이 시작된 방입니다.');
      if (room) remove(me);
      if (target.players.length >= JOBS.length && !seat) return err(me, `방이 가득 찼습니다. (최대 ${JOBS.length}명)`);
      if (msg.type === 'create') rooms.set(code, target);
      me.name = name; me.room = code; me.profiled = !!prof;
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
      for (const p of room.players) send(p, { type: 'start' }); // 먼저 보내야 클라이언트가 로딩부터 띄운다
      broadcast(room);
    } else if (msg.type === 'leave') {
      remove(me);
      send(me, { type: 'left' });
    }
  });
});

http.listen(PORT, () => console.log(`http://localhost:${PORT}`));
