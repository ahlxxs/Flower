import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const MAX_NAME = 12;
const MIN_PLAYERS = 2; // ponytail: 테스트용 최소 인원. 규칙이 정해지면 올린다.
// ponytail: rooms live in memory only — a restart drops every room. Move to Redis/DB if that matters.
const rooms = new Map(); // code -> { host: ws, players: Set<ws>, started: bool }

const http = createServer(async (req, res) => {
  // Single-page app: every path gets index.html (invite links look like /?room=ABCDE).
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(await readFile(new URL('./public/index.html', import.meta.url)));
});

function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
  let code;
  do code = [...randomBytes(5)].map(b => abc[b % abc.length]).join('');
  while (rooms.has(code));
  return code;
}

function broadcast(code) {
  const room = rooms.get(code);
  if (!room) return;
  const players = [...room.players].map(p => ({ id: p.id, name: p.name, host: p === room.host, ready: p.ready }));
  for (const p of room.players) p.send(JSON.stringify({ type: 'room', code, players, you: p.id, minPlayers: MIN_PLAYERS, canStart: canStart(room) }));
}

// 방장을 뺀 전원이 준비하고, 최소 인원이 모이면 시작할 수 있다
function canStart(room) {
  return room.players.size >= MIN_PLAYERS && [...room.players].every(p => p === room.host || p.ready);
}

function leave(ws) {
  const code = ws.room;
  const room = rooms.get(code);
  if (!room) return;
  room.players.delete(ws);
  ws.room = null;
  if (room.players.size === 0) return rooms.delete(code);
  if (room.host === ws) room.host = room.players.values().next().value; // pass host to the oldest player
  broadcast(code);
}

const err = (ws, message) => ws.send(JSON.stringify({ type: 'error', message }));

new WebSocketServer({ server: http }).on('connection', ws => {
  ws.id = randomBytes(4).toString('hex');
  ws.on('close', () => leave(ws));
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const name = String(msg.name ?? '').trim().slice(0, MAX_NAME);

    if (msg.type === 'create' || msg.type === 'join') {
      if (!name) return err(ws, '닉네임을 입력하세요.');
      const code = msg.type === 'create' ? newCode() : String(msg.code ?? '').trim().toUpperCase();
      if (msg.type === 'create') rooms.set(code, { host: ws, players: new Set(), started: false });
      const room = rooms.get(code);
      if (!room) return err(ws, '존재하지 않는 방입니다.');
      if (room.started) return err(ws, '이미 게임이 시작된 방입니다.');
      if ([...room.players].some(p => p.name === name)) return err(ws, '이미 같은 닉네임이 방에 있습니다.');
      leave(ws);
      ws.name = name;
      ws.room = code;
      ws.ready = false;
      room.players.add(ws);
      broadcast(code);
    } else if (msg.type === 'ready') {
      const room = rooms.get(ws.room);
      if (!room || room.started) return;
      ws.ready = !!msg.ready;
      broadcast(ws.room);
    } else if (msg.type === 'start') {
      const room = rooms.get(ws.room);
      if (!room || room.host !== ws || room.started) return;
      if (!canStart(room)) return err(ws, '모두 준비해야 시작할 수 있습니다.');
      room.started = true;
      for (const p of room.players) p.send(JSON.stringify({ type: 'start' }));
    } else if (msg.type === 'leave') {
      leave(ws);
      ws.send(JSON.stringify({ type: 'left' }));
    }
  });
});

http.listen(PORT, () => console.log(`http://localhost:${PORT}`));
