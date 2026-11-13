// 게임 진행 (서버에서만 돈다). 확정 규칙 2·3·6을 따른다:
//  - 손패 = 생명. 공격을 막지 못하면 손패를 잃고(뒷면 버림), 0장이면 쓰러지며 진영이 공개된다.
//  - 카드를 쓰면 앞면으로 공개하고 바로 1장을 뽑는다. 덱이 비면 버림 더미를 섞어 되돌린다.
//  - 마왕군이 모두 쓰러지면 용사 파티, 용사 파티가 모두 쓰러지면 마왕군 승리.
// ponytail: 헌납·봉인, 거래, 직업 능력, 카드별 특수 효과는 아직 없다. 그런 카드는 공개만 되고 효과는 "준비 중".
import { CARDS, buildDeck } from './cards.js';

export const HAND_START = 5;        // 시작 손패
export const ACTIONS_PER_TURN = 2;  // 한 차례에 쓸 수 있는 카드 수 (규칙 미정: 임시)
export const TURN_MS = 60000;       // 차례 제한 시간
export const REACT_MS = 10000;      // 공격받았을 때 방어를 고르는 시간

const C = id => CARDS[id];
export const isAttack = c => c.tags.includes('공격');
export const isDefense = c => c.tags.includes('방어');
const UNUSABLE = new Set(['악마의 서', '어둠의 서']);
const damageOf = c => (c.name === '양날도끼' ? 2 : 1);
// 대상이 필요한 카드: 공격 + 성경(원하는 사람 회복)
export const needsTarget = c => isAttack(c) || c.name === '성경';

export function newGame(players, shuffle) {
  const g = {
    shuffle, deck: buildDeck(shuffle), up: [], down: [], round: 1, turn: 0, actions: ACTIONS_PER_TURN, attacked: false,
    seats: players.map(p => ({ id: p.id, name: p.name, role: p.role, hand: [], alive: true })),
    pending: null, log: [], over: null,
  };
  for (let i = 0; i < HAND_START; i++) for (const s of g.seats) draw(g, s);
  say(g, `라운드 1이 시작되었습니다. ${g.seats[0].name}의 차례입니다.`);
  return g;
}

const seat = (g, id) => g.seats.find(s => s.id === id);
const say = (g, text) => { g.log.push(text); if (g.log.length > 30) g.log.shift(); };

function draw(g, s, n = 1) {
  for (let i = 0; i < n; i++) {
    if (!g.deck.length) { // 규칙 3: 덱이 마르면 버림 더미를 섞어 되돌린다
      g.deck = g.shuffle([...g.up, ...g.down]); g.up = []; g.down = [];
      if (g.deck.length) say(g, '덱이 바닥나 버림 더미를 섞어 다시 덱으로 만들었습니다.');
    }
    if (!g.deck.length) return;
    s.hand.push(g.deck.pop());
  }
}

// 피해: 손패에서 무작위로 n장을 뒷면 버림으로. 0장이면 쓰러짐
function hurt(g, s, n, fx) {
  for (let i = 0; i < n && s.hand.length; i++) g.down.push(s.hand.splice(Math.floor(Math.random() * s.hand.length), 1)[0]);
  fx.push({ kind: 'hit', target: s.id, amount: n });
  if (!s.hand.length && s.alive) {
    s.alive = false;
    say(g, `${s.name}이(가) 쓰러졌습니다. 정체는 ${s.role === 'demon' ? '마왕군' : '용사 파티'}였습니다.`);
    fx.push({ kind: 'death', target: s.id, role: s.role });
    checkWin(g);
  }
}

function checkWin(g) {
  const alive = g.seats.filter(s => s.alive);
  if (!alive.some(s => s.role === 'demon')) g.over = { winner: 'hero' };
  else if (!alive.some(s => s.role === 'hero')) g.over = { winner: 'demon' };
  if (g.over) { g.pending = null; say(g, g.over.winner === 'hero' ? '마왕군이 모두 쓰러졌습니다. 용사 파티의 승리!' : '용사 파티가 모두 쓰러졌습니다. 마왕군의 승리!'); }
}

// 카드 사용. 성공하면 { fx: [...] }, 실패하면 { error }
export function useCard(g, id, index, targetId) {
  const s = seat(g, id), cur = g.seats[g.turn];
  if (g.over) return { error: '게임이 끝났습니다.' };
  if (!s || s !== cur) return { error: '내 차례가 아닙니다.' };
  if (g.pending) return { error: '공격에 대한 응답을 기다리는 중입니다.' };
  if (g.actions <= 0) return { error: `이번 차례에는 카드를 ${ACTIONS_PER_TURN}장까지 쓸 수 있습니다. 차례를 마치세요.` };
  const cardId = s.hand[index];
  if (cardId === undefined) return { error: '없는 카드입니다.' };
  const c = C(cardId);
  if (UNUSABLE.has(c.name)) return { error: `${c.name}은(는) 사용할 수 없는 카드입니다.` };
  if (isDefense(c)) return { error: '방어 카드는 공격을 받을 때 씁니다.' };
  if (isAttack(c) && g.attacked) return { error: '공격은 한 차례에 한 번만 할 수 있습니다.' };
  const t = needsTarget(c) ? seat(g, targetId) : null;
  if (needsTarget(c)) {
    if (!t || !t.alive) return { error: '대상을 골라 주세요.' };
    if (isAttack(c) && t === s) return { error: '자신은 공격할 수 없습니다.' };
  }

  // 규칙 3: 앞면으로 공개하고 바로 1장 뽑기
  s.hand.splice(index, 1); g.up.push(cardId); draw(g, s); g.actions--;
  const fx = [{ kind: 'use', by: s.id, card: cardId, target: t?.id }];
  if (isAttack(c)) {
    g.attacked = true;
    g.pending = { attacker: s.id, target: t.id, card: cardId, dmg: damageOf(c), endsAt: Date.now() + REACT_MS };
    say(g, `${s.name}이(가) ${c.name}(으)로 ${t.name}을(를) 공격합니다!`);
    fx.push({ kind: 'attack', by: s.id, target: t.id, card: cardId });
    if (c.name === '양날도끼') { say(g, `양날도끼의 반동으로 ${s.name}도 피해를 입습니다.`); hurt(g, s, 1, fx); }
  } else if (c.name === '성경') {
    draw(g, t); say(g, `${s.name}이(가) 성경으로 ${t.name}을(를) 회복시켰습니다. (+1)`);
    fx.push({ kind: 'heal', target: t.id, amount: 1 });
  } else if (c.name === '치유 물약') {
    draw(g, s, 2); say(g, `${s.name}이(가) 치유 물약으로 회복했습니다. (+2)`);
    fx.push({ kind: 'heal', target: s.id, amount: 2 });
  } else {
    say(g, `${s.name}이(가) ${c.name}을(를) 사용했습니다. (효과는 준비 중)`);
  }
  return { fx };
}

// 공격받은 사람의 응답: 방어 카드 index, 또는 null(맞기). 시간이 지나면 서버가 null로 부른다
export function react(g, id, index) {
  const p = g.pending;
  if (!p || p.target !== id) return { error: '응답할 공격이 없습니다.' };
  const t = seat(g, id), a = seat(g, p.attacker), fx = [];
  const cardId = index === null || index === undefined ? undefined : t.hand[index];
  g.pending = null;
  if (cardId !== undefined && isDefense(C(cardId))) {
    t.hand.splice(index, 1); g.up.push(cardId); draw(g, t);
    say(g, `${t.name}이(가) ${C(cardId).name}(으)로 공격을 막았습니다!`);
    fx.push({ kind: 'use', by: t.id, card: cardId }, { kind: 'block', target: t.id, by: a.id });
  } else {
    say(g, `${t.name}이(가) 공격을 받아 손패 ${p.dmg}장을 잃었습니다.`);
    hurt(g, t, p.dmg, fx);
  }
  return { fx };
}

export function endTurn(g, id) {
  if (g.over) return { error: '게임이 끝났습니다.' };
  if (g.seats[g.turn].id !== id) return { error: '내 차례가 아닙니다.' };
  if (g.pending) return { error: '공격에 대한 응답을 기다리는 중입니다.' };
  let next = g.turn;
  do {
    next = (next + 1) % g.seats.length;
    if (next === 0) { g.round++; say(g, `라운드 ${g.round}이 시작되었습니다.`); } // ponytail: 라운드 끝 헌납은 아직 없음
  } while (!g.seats[next].alive);
  g.turn = next; g.actions = ACTIONS_PER_TURN; g.attacked = false;
  say(g, `${g.seats[next].name}의 차례입니다.`);
  return { fx: [{ kind: 'turn', id: g.seats[next].id }] };
}

// 한 사람에게 보낼 게임 화면 정보 (남의 손패와 살아 있는 사람의 진영은 보내지 않는다)
export function viewFor(g, id) {
  const me = seat(g, id);
  return {
    round: g.round, turn: g.seats[g.turn].id, actions: g.actions, attacked: g.attacked, actionsMax: ACTIONS_PER_TURN,
    deck: g.deck.length, up: g.up.at(-1) ?? null, down: g.down.length,
    players: g.seats.map(s => ({ id: s.id, name: s.name, hand: s.hand.length, alive: s.alive, role: s.alive && !g.over ? undefined : s.role })),
    hand: me ? me.hand : [],
    pending: g.pending && { attacker: g.pending.attacker, target: g.pending.target, card: g.pending.card, dmg: g.pending.dmg, left: Math.max(0, g.pending.endsAt - Date.now()) },
    log: g.log.slice(-6), over: g.over,
  };
}
