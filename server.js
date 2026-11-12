import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 3000;
const MAX_NAME = 12;
// ponytail: rooms live in memory only — a restart drops every room. Move to Redis/DB if that matters.
const rooms = new Map(); // code -> { host: ws, players: Set<ws> }

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
  const players = [...room.players].map(p => ({ id: p.id, name: p.name, host: p === room.host }));
  for (const p of room.players) p.send(JSON.stringify({ type: 'room', code, players, you: p.id }));
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
      if (msg.type === 'create') rooms.set(code, { host: ws, players: new Set() });
      const room = rooms.get(code);
      if (!room) return err(ws, '존재하지 않는 방입니다.');
      if ([...room.players].some(p => p.name === name)) return err(ws, '이미 같은 닉네임이 방에 있습니다.');
      leave(ws);
      ws.name = name;
      ws.room = code;
      room.players.add(ws);
      broadcast(code);
    } else if (msg.type === 'leave') {
      leave(ws);
      ws.send(JSON.stringify({ type: 'left' }));
    }
  });
});

http.listen(PORT, () => console.log(`http://localhost:${PORT}`));
