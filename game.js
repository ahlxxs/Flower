// 게임 진행 (서버에서만 돈다). 확정 규칙 2·3·6과 기획 문서(PDF)의 카드 효과를 따른다.
//  - 생명 = 손패 + 소울하트. 피해는 소울하트가 먼저 받고, 그다음 손패를 뒷면 버림으로 잃는다. 둘 다 0이면 쓰러진다.
//  - 카드를 쓰면 앞면으로 공개하고 바로 1장을 뽑는다. 차례를 시작할 때도 1장을 뽑는다. 덱이 비면 버림 더미를 섞어 되돌린다.
//  - "바퀴"는 라운드 1번으로 본다. 행동 카드는 쓰고 나서 잠깐 동안 다른 사람이 "거절"로 막을 수 있다.
//  - 한 사람의 차례: 행동(카드 사용) → 거래 턴(뒷면 카드 1장 교환 제안, 말로 블러핑 가능) → 다음 사람.
//  - 살아 있는 모두가 한 번씩 차례를 마치면 헌납(규칙 5): 모두 1장을 동시에 바치고, 섞어서 공개, 제물은 제단에 남아 봉인 진행, 모두 1장 보충.
// ponytail: 사거리와 직업 능력은 아직 없다. 이것에 기대는 카드 효과는 "아직 효과 없음"으로 공개만 된다.
import { CARDS, buildDeck } from './cards.js';

export const HAND_START = 5;        // 시작 손패
export const ACTIONS_PER_TURN = 2;  // 한 차례에 쓸 수 있는 카드 수 (규칙 미정: 임시)
export const TURN_MS = 60000;       // 차례 제한 시간
export const REACT_MS = 10000;      // 공격받았을 때 방어를 고르는 시간
export const COUNTER_MS = 4000;     // 행동 카드에 "거절"을 낼 수 있는 시간
export const CHOICE_MS = 20000;     // 카드·사람을 고르는 시간 (불공정 거래, 상점, 고블린, 강제, 여명과 황혼의 산)
export const TRADE_MS = 25000;      // 거래 턴: 제안을 고르는 시간
export const ANSWER_MS = 20000;     // 거래 제안을 받은 사람이 답하는 시간
export const OFFER_MS = 20000;      // 헌납: 바칠 카드를 고르는 시간
export const THIEF_MS = 4000;       // 헌납 직후 공개 전, 제단 도둑을 쓸 수 있는 시간
export const SEAL_GOAL = 2;         // 봉인 목표 (규칙 미정: 덱에 바칠 수 있는 제물이 적어 임시로 2)

const C = id => CARDS[id];
export const isAttack = c => c.tags.includes('공격');
export const isDefense = c => c.tags.includes('방어');
const HEAL_CARDS = new Set(['성경', '치유 물약', '치유의 펜던트']); // 대성당이 모으는 치유 관련 카드

// 대상: other = 다른 사람 1명, any = 아무나 1명(나 포함), two = 서로 다른 두 사람, give = 다른 사람 + 건넬 내 카드
const TARGET = {
  도둑질: 'other', 매혹: 'other', '영혼 약탈': 'other', '불공정 거래': 'other', 관심법: 'other', 소문내기: 'other', '파괴!': 'other',
  공개: 'other', 기부: 'give', 정복: 'other', 강제: 'other', '투탕카멘의 가면': 'other', 방벽: 'two', 세이렌: 'other', 대서재: 'other', 별: 'other', 성경: 'any',
};
export const targetOf = c => (isAttack(c) ? 'other' : TARGET[c.name] || null);
export const UNUSABLE = {
  '악마의 서': '악마의 서는 사용할 수 없는 카드입니다.', '어둠의 서': '어둠의 서는 사용할 수 없는 카드입니다.',
  거절: '거절은 다른 사람이 행동 카드를 쓸 때 낼 수 있습니다.',
};
const PLACE = { '힘의 펜던트': 3, '민첩의 펜던트': 3, '방어의 펜던트': 3, '치유의 펜던트': 3, 고블린: 2, 던전: 1, '여명과 황혼의 산': 5 }; // 자기 앞에 놓는 카드: 남는 바퀴 수
const REMOVE = new Set(['소문내기', '부활!', '주정뱅이']); // 쓰면 게임에서 제외
const NO_EFFECT = { // 사용했을 때는 효과가 없는 카드 → 이유
  '몽마의 돌': '제단에 바쳐졌을 때 효과가 있는 카드라, 사용하면 효과가 없습니다.', 네크로노미콘: '제단에 있을 때 효과가 있는 카드라, 사용하면 효과가 없습니다.', 꽃: '예쁘다.',
  '성스러운 십자가': '지니고 있을 때의 효과라, 쓰면 효과가 없습니다.', '은둔자의 로브': '사용 효과가 없는 카드입니다.', 야수: '사용 효과가 없는 카드입니다.',
};

export function newGame(players, shuffle) {
  const g = {
    shuffle, deck: buildDeck(shuffle), up: [], down: [], removed: [], round: 1, turn: 0, turnCount: 0, dir: 1, actions: ACTIONS_PER_TURN,
    seats: players.map(p => ({ id: p.id, name: p.name, role: p.role, job: p.job, hand: [], soul: 0, field: [], alive: true, revealed: false,
      eater: false, starUses: 0, hitsRound: 0, attacksTurn: 0 })),
    charms: [], barriers: [], tree: null, tavern: null, market: null, pending: null, queue: [], forceEnd: false, log: [], over: null,
    phase: 'action', played: [], tradesDone: 0, tradeOpen: false, altar: { seals: [], placed: [] },
  };
  for (let i = 0; i < HAND_START; i++) for (const s of g.seats) draw(g, s);
  say(g, '라운드 1이 시작되었습니다.');
  startTurn(g, []); // 첫 사람도 차례 시작에 1장
  return g;
}

/* ---------- 도우미 ---------- */
const seat = (g, id) => g.seats.find(s => s.id === id);
const say = (g, text) => { g.log.push(text); if (g.log.length > 40) g.log.shift(); };
const rnd = n => Math.floor(Math.random() * n);
const alive = g => g.seats.filter(s => s.alive);
const hp = s => s.hand.length + s.soul;
const has = (s, name) => s.hand.some(id => C(id).name === name);
const fieldHas = (s, name) => s.field.some(f => C(f.card).name === name);
const takeOut = (s, i) => s.hand.splice(i, 1)[0];
const blocked = (g, a, b) => g.barriers.some(x => (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id));

// 손에 카드 넣기 (어둠의 서·별 같은 특수 카드 처리 포함)
function give(g, s, id, fx) {
  const c = C(id);
  if (c.name === '어둠의 서' && s.job !== '네크로맨서') { // 어둠의 서는 네크로맨서에게 양도된다
    const necro = alive(g).find(x => x.job === '네크로맨서');
    if (necro) { necro.hand.push(id); say(g, `어둠의 서가 네크로맨서 ${necro.name}에게 넘어갔습니다.`); return; }
  }
  s.hand.push(id);
  if (c.name === '별' && s.eater && s.alive && !g.over) { // 별을 먹는 괴물: 별을 얻으면 즉시 승리
    g.over = { winner: 'eater', id: s.id }; g.pending = null;
    say(g, `${s.name}은(는) 별을 먹는 괴물이었습니다! 별을 손에 넣어 승리합니다.`);
    fx?.push({ kind: 'over' });
  }
}
function ensureDeck(g) { // 규칙 3: 덱이 마르면 버림 더미를 섞어 되돌린다
  if (g.deck.length) return;
  g.deck = g.shuffle([...g.up, ...g.down]); g.up = []; g.down = [];
  if (g.deck.length) say(g, '덱이 바닥나 버림 더미를 섞어 다시 덱으로 만들었습니다.');
}
function draw(g, s, n = 1, fx) {
  for (let i = 0; i < n; i++) {
    ensureDeck(g);
    if (!g.deck.length) return;
    give(g, s, g.deck.pop(), fx);
  }
}
// 손패를 n장 잃는다 (뒷면 버림). 악마의 서가 있으면 그것부터 내려놓는다. except: 남겨 둘 카드 id
function loseCards(g, s, n, fx, except) {
  for (let i = 0; i < n; i++) {
    const pool = s.hand.map((id, k) => k).filter(k => s.hand[k] !== except);
    if (!pool.length) break;
    const devil = pool.find(k => C(s.hand[k]).name === '악마의 서');
    g.down.push(takeOut(s, devil ?? pool[rnd(pool.length)]));
  }
  checkDeath(g, s, fx);
}
// 피해: 방어의 펜던트(이번 바퀴 첫 공격 -1) → 소울하트 → 손패 순서
function hurt(g, s, n, fx, why) {
  if (!s.alive) return;
  if (fieldHas(s, '방어의 펜던트') && s.hitsRound === 0 && why === 'attack') n = Math.max(0, n - 1);
  if (why === 'attack') s.hitsRound++;
  for (const f of s.field) if (C(f.card).name === '던전') f.dmg += n;
  const soul = Math.min(s.soul, n); s.soul -= soul;
  fx.push({ kind: 'hit', target: s.id, amount: n });
  const holdsCross = has(s, '성스러운 십자가');
  loseCards(g, s, n - soul, fx);
  if (!s.alive && holdsCross) { // 성스러운 십자가: 지닌 채 쓰러지면 모두에게 2 피해
    say(g, `${s.name}이(가) 지닌 성스러운 십자가가 빛나며 모두에게 피해 2를 입힙니다!`);
    for (const o of alive(g)) hurt(g, o, 2, fx, 'cross');
  }
}
function checkDeath(g, s, fx) {
  if (!s.alive || hp(s) > 0) return;
  s.alive = false;
  say(g, `${s.name}이(가) 쓰러졌습니다. 정체는 ${roleName(s)}였습니다.`);
  fx.push({ kind: 'death', target: s.id, role: s.eater ? 'eater' : s.role });
  checkWin(g, fx);
}
const roleName = s => (s.eater ? '별을 먹는 괴물' : s.role === 'demon' ? '마왕군' : '용사 파티');
function checkWin(g, fx) {
  if (g.over) return;
  const a = alive(g).filter(s => !s.eater);
  if (!a.some(s => s.role === 'demon')) g.over = { winner: 'hero' };
  else if (!a.some(s => s.role === 'hero')) g.over = { winner: 'demon' };
  if (g.over) { g.pending = null; g.queue = []; say(g, g.over.winner === 'hero' ? '마왕군이 모두 쓰러졌습니다. 용사 파티의 승리!' : '용사 파티가 모두 쓰러졌습니다. 마왕군의 승리!'); fx?.push({ kind: 'over' }); }
}
// 악마의 서는 들키면 지닌 사람이 쓰러진다 (관심법, 공개, 불공정 거래로 손패를 보였을 때)
function exposeDevil(g, t, fx) {
  if (!has(t, '악마의 서')) return false;
  say(g, `${t.name}의 손에서 악마의 서가 발각되었습니다! ${t.name}은(는) 쓰러집니다.`);
  g.down.push(...t.hand); t.hand = []; t.soul = 0;
  checkDeath(g, t, fx);
  return true;
}

/* ---------- 카드 사용 ---------- */
// opts: { target, target2, give } (give = 기부로 건넬 내 카드의 손패 번호)
export function useCard(g, id, index, opts = {}) {
  const s = seat(g, id), asTrade = !!opts.asTrade; // asTrade: 거래 턴에 불공정 거래를 거래 대신 쓰는 경우
  if (g.over) return { error: '게임이 끝났습니다.' };
  if (!s || s !== g.seats[g.turn]) return { error: '내 차례가 아닙니다.' };
  if (asTrade) {
    if (g.pending?.kind !== 'trade' || g.pending.stage !== 'offer' || g.pending.who !== id) return { error: '지금은 거래 턴이 아닙니다.' };
    if (C(s.hand[index] ?? 0).name !== '불공정 거래') return { error: '불공정 거래 카드만 거래 대신 쓸 수 있습니다.' };
    g.pending = null;
  } else {
    if (g.phase !== 'action') return { error: '지금은 카드를 쓰는 시간이 아닙니다.' };
    if (g.pending) return { error: '다른 일이 끝나기를 기다리는 중입니다.' };
    if (g.actions <= 0) return { error: `이번 차례에는 카드를 ${ACTIONS_PER_TURN}장까지 쓸 수 있습니다. 차례를 끝내세요.` };
  }
  const cardId = s.hand[index];
  if (cardId === undefined) return { error: '없는 카드입니다.' };
  const c = C(cardId), spec = targetOf(c);
  if (UNUSABLE[c.name]) return { error: UNUSABLE[c.name] };
  if (c.name === '제단 도둑') return { error: '제단 도둑은 헌납한 직후, 제단을 공개하기 전에만 쓸 수 있습니다.' };
  if (HEAL_CARDS.has(c.name) && s.job !== '사제' && g.altar.seals.some(i => C(i).name === '네크로노미콘')) return { error: '제단의 네크로노미콘 때문에 사제가 아니면 치유 카드를 쓸 수 없습니다.' };
  if (isDefense(c)) return { error: '방어 카드는 공격을 받을 때 씁니다.' };
  if (isAttack(c) && g.tree) return { error: '세계수가 자라는 동안에는 공격할 수 없습니다.' };
  const t = seat(g, opts.target), t2 = seat(g, opts.target2);
  if (spec) {
    if (!t || !t.alive) return { error: '대상을 골라 주세요.' };
    if (spec !== 'any' && t === s) return { error: '자신은 고를 수 없습니다.' };
    if (t !== s && blocked(g, s, t)) return { error: `방벽 때문에 ${t.name}에게는 아무것도 할 수 없습니다.` };
    if (isAttack(c) && g.charms.some(x => x.by === t.id && x.target === s.id)) return { error: `${t.name}에게 매혹되어 공격할 수 없습니다.` };
    if (spec === 'two' && (!t2 || !t2.alive || t2 === t)) return { error: '서로 다른 두 사람을 골라 주세요.' };
    if (spec === 'give' && (opts.give === index || s.hand[opts.give] === undefined)) return { error: '건넬 카드를 골라 주세요.' };
  }
  const giftId = spec === 'give' ? s.hand[opts.give] : undefined;

  // 규칙 3: 앞면으로 공개(또는 자기 앞에 놓기/게임에서 제외/상대에게 건넴)하고 바로 1장 뽑기
  takeOut(s, index);
  if (giftId !== undefined) s.hand.splice(s.hand.indexOf(giftId), 1);
  const fx = [{ kind: 'use', by: s.id, card: cardId, target: t?.id, target2: t2?.id }];
  if (PLACE[c.name]) s.field.push({ card: cardId, until: g.round + PLACE[c.name], dmg: 0 });
  else if (REMOVE.has(c.name)) g.removed.push(cardId);
  else if (!['세이렌', '투탕카멘의 가면', '별'].includes(c.name)) g.up.push(cardId);
  draw(g, s, 1, fx); if (!asTrade) g.actions--;
  const ctx = { s, t, t2, cardId, c, giftId };
  if (c.kind === '행동') { // 다른 사람이 거절할 수 있도록 잠깐 기다린다
    g.pending = { kind: 'counter', by: s.id, ctx, endsAt: Date.now() + COUNTER_MS };
    say(g, `${s.name}이(가) ${c.name}을(를) 사용하려 합니다${t ? ` (대상: ${t.name}${t2 ? ', ' + t2.name : ''})` : ''}.`);
    return { fx };
  }
  resolve(g, ctx, fx);
  return { fx };
}

// 카드 효과
function resolve(g, { s, t, t2, cardId, c, giftId }, fx) {
  const n = c.name, line = text => say(g, text);
  if (isAttack(c)) {
    s.attacksTurn++;
    let dmg = n === '양날도끼' ? 2 : 1;
    if (s.attacksTurn === 2 && fieldHas(s, '힘의 펜던트')) dmg++; // 힘의 펜던트: 두 번째 공격 +1
    g.pending = { kind: 'attack', attacker: s.id, target: t.id, card: cardId, dmg, endsAt: Date.now() + REACT_MS };
    line(`${s.name}이(가) ${n}(으)로 ${t.name}을(를) 공격합니다! (피해 ${dmg})`);
    fx.push({ kind: 'attack', by: s.id, target: t.id, card: cardId });
    if (n === '양날도끼') { line(`양날도끼의 반동으로 ${s.name}도 피해 1을 입습니다.`); hurt(g, s, 1, fx, 'self'); }
    return;
  }
  switch (n) {
    case '성경': draw(g, t, 1, fx); line(`${s.name}이(가) 성경으로 ${t.name}을(를) 회복시켰습니다. (+1)`); fx.push({ kind: 'heal', target: t.id, amount: 1 }); break;
    case '치유 물약': s.soul += 2; line(`${s.name}이(가) 치유 물약을 마셨습니다. (소울하트 +2)`); fx.push({ kind: 'heal', target: s.id, amount: 2, soul: true }); break;
    case '부의 재분배': {
      const a = alive(g), most = a.reduce((x, y) => (y.hand.length > x.hand.length ? y : x)), least = a.reduce((x, y) => (y.hand.length < x.hand.length ? y : x));
      if (most === least || most.hand.length === least.hand.length) { line('부의 재분배: 손패 수가 모두 같아 아무 일도 일어나지 않았습니다.'); break; }
      [most.hand, least.hand] = [least.hand, most.hand];
      line(`부의 재분배: ${most.name}과(와) ${least.name}의 손패가 바뀌었습니다.`); fx.push({ kind: 'swap', a: most.id, b: least.id }); break;
    }
    case '도둑질':
      if (!t.hand.length) { line(`${t.name}의 손패가 없어 훔칠 것이 없습니다.`); break; }
      give(g, s, takeOut(t, rnd(t.hand.length)), fx); line(`${s.name}이(가) ${t.name}의 카드 한 장을 훔쳤습니다.`);
      fx.push({ kind: 'steal', by: s.id, target: t.id }); checkDeath(g, t, fx); break;
    case '매혹': g.charms.push({ by: s.id, target: t.id, until: g.round + 1 }); line(`${t.name}이(가) 매혹되어 한 바퀴 동안 ${s.name}을(를) 공격할 수 없습니다.`); fx.push({ kind: 'charm', target: t.id }); break;
    case '영혼 약탈': line(`${t.name}의 소울하트 ${t.soul}개가 모두 소멸했습니다.`); t.soul = 0; fx.push({ kind: 'hit', target: t.id, amount: 0, soul: true }); checkDeath(g, t, fx); break;
    case '불공정 거래':
      if (exposeDevil(g, t, fx)) break;
      if (!t.hand.length || !s.hand.length) { line('불공정 거래: 주고받을 카드가 없어 거래가 이루어지지 않았습니다.'); break; }
      g.pending = { kind: 'choice', type: 'unfair', who: s.id, target: t.id, options: [...t.hand], endsAt: Date.now() + CHOICE_MS };
      line(`${s.name}이(가) ${t.name}과(와) 불공정 거래를 합니다.`); break;
    case '관심법':
      fx.push({ kind: 'peek', to: s.id, target: t.id, cards: [...t.hand] }); line(`${s.name}이(가) ${t.name}의 손패를 몰래 보았습니다.`);
      exposeDevil(g, t, fx); break;
    case '소문내기': t.revealed = true; line(`소문이 퍼졌습니다! ${t.name}의 정체는 ${roleName(t)}입니다.`); fx.push({ kind: 'reveal-role', target: t.id }); break;
    case '파괴!':
      if (!t.field.length) { line(`${t.name}의 앞에 놓인 카드가 없습니다.`); break; }
      g.up.push(...t.field.map(f => f.card)); line(`${t.name}의 앞에 놓인 카드 ${t.field.length}장이 모두 철거되었습니다.`); t.field = [];
      fx.push({ kind: 'break', target: t.id }); break;
    case '부익부 빈익빈': {
      const a = alive(g), most = a.reduce((x, y) => (y.hand.length > x.hand.length ? y : x)), least = a.reduce((x, y) => (y.hand.length < x.hand.length ? y : x));
      line(`부익부 빈익빈: ${least.name}은(는) 카드 한 장을 내려놓고, ${most.name}은(는) 한 장을 뽑습니다.`);
      loseCards(g, least, 1, fx); fx.push({ kind: 'hit', target: least.id, amount: 1 });
      if (most.alive) { draw(g, most, 1, fx); fx.push({ kind: 'heal', target: most.id, amount: 1 }); }
      break;
    }
    case '공개': fx.push({ kind: 'reveal', target: t.id, cards: [...t.hand] }); line(`${t.name}의 손패가 모두에게 공개되었습니다.`); exposeDevil(g, t, fx); break;
    case '기부': give(g, t, giftId, fx); line(`${s.name}이(가) ${t.name}에게 카드 한 장을 건넸습니다.`); fx.push({ kind: 'heal', target: t.id, amount: 1 }); checkDeath(g, s, fx); break;
    case '부활!': {
      const dead = g.seats.filter(x => !x.alive);
      for (const x of dead) { x.alive = true; draw(g, x, 3, fx); fx.push({ kind: 'heal', target: x.id, amount: 3 }); }
      line(dead.length ? `부활! ${dead.map(x => x.name).join(', ')}이(가) 되살아나 카드 3장씩을 뽑았습니다.` : '부활!: 쓰러진 사람이 없습니다.'); break;
    }
    case '정복': {
      const i = t.field.findIndex(f => C(f.card).kind === '장소');
      if (i < 0) { line(`${t.name}의 앞에 장소 카드가 없습니다.`); break; }
      const f = t.field.splice(i, 1)[0]; give(g, s, f.card, fx); line(`${s.name}이(가) ${t.name}의 ${C(f.card).name}을(를) 빼앗았습니다.`); break;
    }
    case '강제': force(g, s, t, fx); break;
    case '성수': {
      const n = g.altar.seals.length; g.up.push(...g.altar.seals); g.altar.seals = [];
      line(n ? `성수가 제단을 정화했습니다! 제물 ${n}장이 버림 더미로 갔습니다.` : '성수를 뿌렸지만 제단에 제물이 없습니다.'); if (n) fx.push({ kind: 'altar', seals: 0 }); break;
    }
    case '암시장': g.market = { until: g.round + 1 }; line(`${s.name}이(가) 암시장을 열었습니다. 한 바퀴 동안 거래를 2번까지 할 수 있습니다.`); break;
    case '투탕카멘의 가면':
      give(g, t, cardId, fx); line(`${t.name}이(가) 투탕카멘의 가면을 받아 카드 두 장을 내려놓습니다.`);
      fx.push({ kind: 'hit', target: t.id, amount: 2 }); loseCards(g, t, 2, fx, cardId); break;
    case '방벽': g.barriers.push({ a: t.id, b: t2.id, until: g.round + 2 }); line(`${t.name}과(와) ${t2.name} 사이에 방벽이 세워졌습니다. (두 바퀴)`); fx.push({ kind: 'charm', target: t.id }, { kind: 'charm', target: t2.id }); break;
    case '힘의 펜던트': case '민첩의 펜던트': case '방어의 펜던트': case '치유의 펜던트':
      line(`${s.name}이(가) ${n}을(를) 앞에 내려놓았습니다. (세 바퀴)${n === '민첩의 펜던트' ? ' 사거리 규칙이 아직 없어 효과는 없습니다.' : ''}`); break;
    case '고블린': line(`${s.name}이(가) 고블린을 앞에 두었습니다. 두 바퀴 동안 차례 시작에 다른 사람의 카드를 가져옵니다.`); break;
    case '던전': line(`${s.name}이(가) 던전에 들어갔습니다. 한 바퀴 동안 피해를 3 미만으로 받으면 보상이 있습니다.`); break;
    case '여명과 황혼의 산':
      line(`${s.name}이(가) 여명과 황혼의 산에 올랐습니다. 손패 3장만 남기고, 다섯 바퀴 뒤 보상을 받습니다.`);
      if (s.hand.length > 3) g.pending = { kind: 'choice', type: 'keep3', who: s.id, options: [...s.hand], endsAt: Date.now() + CHOICE_MS };
      break;
    case '세이렌': draw(g, s, 1, fx); give(g, t, cardId, fx); line(`${s.name}이(가) 카드를 한 장 뽑고 세이렌을 ${t.name}에게 넘겼습니다.`); break;
    case '도깨비': {
      const a = alive(g), hands = a.map(x => x.hand);
      a.forEach((x, i) => { x.hand = hands[(i + g.dir + a.length) % a.length]; }); // 진행 방향의 반대로 한 칸
      line('도깨비가 나타나 모두의 손패가 진행 방향의 반대로 한 칸 옮겨졌습니다!'); fx.push({ kind: 'rotate' }); break;
    }
    case '구미호': {
      const k = s.hand.length; g.down.push(...s.hand); s.hand = []; s.soul += k + 3;
      line(`${s.name}이(가) 구미호의 힘으로 카드 ${k}장을 소울하트로 바꾸고 3개를 더 얻었습니다. (소울하트 +${k + 3})`); fx.push({ kind: 'heal', target: s.id, amount: k + 3, soul: true }); break;
    }
    case '주정뱅이': s.revealed = true; line(`${s.name}이(가) 술에 취해 정체를 밝혔습니다. ${roleName(s)}입니다!`); fx.push({ kind: 'reveal-role', target: s.id }); break;
    case '별을 먹는 괴물':
      s.eater = true; line(`${s.name}이(가) 별을 먹는 괴물을 사용했습니다.`); fx.push({ kind: 'eater', to: s.id });
      if (has(s, '별')) give(g, s, s.hand.splice(s.hand.findIndex(id => C(id).name === '별'), 1)[0], fx); break;
    case '상점': {
      const a = alive(g), picks = [], cards = [];
      for (let i = 0; i < a.length; i++) { ensureDeck(g); if (g.deck.length) cards.push(g.deck.pop()); }
      let i = g.seats.indexOf(s); // 사용한 사람부터 시계 반대 방향으로
      for (let k = 0; k < g.seats.length && picks.length < a.length; k++) { if (g.seats[i].alive) picks.push(g.seats[i].id); i = (i - 1 + g.seats.length) % g.seats.length; }
      g.shop = cards; g.queue = picks;
      line(`상점이 열렸습니다! 카드 ${cards.length}장 중에서 ${s.name}부터 한 장씩 가져갑니다.`);
      nextShopPick(g); break;
    }
    case '주점': g.tavern = { until: g.turnCount + 3, dir: g.dir }; line('주점에서 모두의 직업 카드가 진행 방향의 반대로 한 칸씩 옮겨졌습니다. (3턴 동안)'); fx.push({ kind: 'rotate' }); break;
    case '바다': {
      g.deck = g.shuffle([...g.deck, ...g.up, ...g.down]); g.up = []; g.down = [];
      line('바다가 모든 카드 더미를 휩쓸어 섞었습니다.');
      for (const x of alive(g)) if (has(x, '세이렌')) { line(`세이렌을 지닌 ${x.name}의 소울하트가 사라지고 카드 2장을 잃습니다!`); x.soul = 0; fx.push({ kind: 'hit', target: x.id, amount: 2 }); loseCards(g, x, 2, fx); }
      break;
    }
    case '세계수': g.tree = { until: g.round + 1 }; draw(g, s, 1, fx); line('세계수가 자라났습니다. 한 바퀴 동안 모두 차례 시작에 1장을 더 뽑고, 공격할 수 없습니다.'); break;
    case '대서재': [s.hand, t.hand] = [t.hand, s.hand]; line(`${s.name}과(와) ${t.name}의 손패가 바뀌었습니다.`); fx.push({ kind: 'swap', a: s.id, b: t.id }); checkDeath(g, s, fx); checkDeath(g, t, fx); break;
    case '대성당': {
      const a = alive(g), low = a.reduce((x, y) => (hp(y) < hp(x) ? y : x)), got = [];
      for (const x of a) for (let i = x.hand.length - 1; i >= 0; i--) if (HEAL_CARDS.has(C(x.hand[i]).name)) got.push(takeOut(x, i));
      for (const id of got) give(g, low, id, fx);
      line(got.length ? `대성당: 치유 카드 ${got.length}장(${got.map(id => C(id).name).join(', ')})이 가장 약한 ${low.name}에게 모였습니다.` : '대성당: 아무도 치유 카드를 갖고 있지 않습니다.');
      if (got.length) fx.push({ kind: 'heal', target: low.id, amount: got.length });
      for (const x of a) checkDeath(g, x, fx);
      break;
    }
    case '악마의 숲': g.dir *= -1; g.forceEnd = true; line(`${s.name}이(가) 악마의 숲에 들어섰습니다. 차례가 끝나고 진행 방향이 바뀝니다!`); fx.push({ kind: 'rotate' }); break;
    case '별': {
      s.starUses++; const gain = Math.min(5, s.starUses + 1); s.soul += gain;
      line(`${s.name}이(가) 별의 축복으로 소울하트 ${gain}개를 얻고, 별을 ${t.name}에게 넘겼습니다.`);
      fx.push({ kind: 'heal', target: s.id, amount: gain, soul: true }); give(g, t, cardId, fx); break;
    }
    default: line(`${s.name}이(가) ${n}을(를) 사용했습니다. ${NO_EFFECT[n] || '(이 카드는 아직 효과가 없습니다.)'}`);
  }
  if (!g.pending && g.queue.length === 0) g.shop = null;
}

// 강제: 대상의 손패에서 쓸 수 있는 카드 하나(무작위)를 쓰게 한다. 그 카드의 대상은 강제를 쓴 사람이 고른다
function force(g, s, t, fx) {
  const ok = t.hand.map((id, i) => i).filter(i => { const c = C(t.hand[i]); return !UNUSABLE[c.name] && c.name !== '제단 도둑' && !isDefense(c) && !(isAttack(c) && g.tree); });
  if (!ok.length) { say(g, `${t.name}에게는 쓸 수 있는 카드가 없습니다.`); return; }
  const i = ok[rnd(ok.length)], cardId = t.hand[i], c = C(cardId), spec = targetOf(c);
  const cand = alive(g).filter(x => (spec === 'any' || spec === 'two' || x !== t) && (x === t || !blocked(g, t, x)));
  if (spec && cand.length < (spec === 'two' ? 2 : 1)) { say(g, `${t.name}에게 ${c.name}을(를) 쓰게 하려 했지만 대상이 없습니다.`); return; }
  say(g, `${s.name}이(가) ${t.name}에게 ${c.name}을(를) 쓰게 합니다!`);
  if (!spec) return applyForced(g, s, t, cardId, null, null, fx);
  g.pending = { kind: 'choice', type: 'force', who: s.id, target: t.id, card: cardId, spec, options: cand.map(x => x.id), endsAt: Date.now() + CHOICE_MS };
}
function applyForced(g, s, t, cardId, tt, tt2, fx) {
  const c = C(cardId), spec = targetOf(c), i = t.hand.indexOf(cardId);
  if (i < 0) return;
  takeOut(t, i);
  const giftI = spec === 'give' ? t.hand.length ? rnd(t.hand.length) : -1 : -1;
  if (spec === 'give' && giftI < 0) { g.up.push(cardId); say(g, `${t.name}에게 건넬 카드가 없습니다.`); return; }
  const giftId = giftI >= 0 ? takeOut(t, giftI) : undefined;
  if (PLACE[c.name]) t.field.push({ card: cardId, until: g.round + PLACE[c.name], dmg: 0 });
  else if (REMOVE.has(c.name)) g.removed.push(cardId);
  else if (!['세이렌', '투탕카멘의 가면', '별'].includes(c.name)) g.up.push(cardId);
  draw(g, t, 1, fx);
  fx.push({ kind: 'use', by: t.id, card: cardId, target: tt?.id, target2: tt2?.id });
  resolve(g, { s: t, t: tt, t2: tt2, cardId, c, giftId }, fx);
}

/* ---------- 응답: 방어, 거절, 고르기 ---------- */
// 공격받은 사람의 응답: 방어 카드 index, 또는 null(맞기). 시간이 지나면 서버가 null로 부른다
export function react(g, id, index) {
  const p = g.pending;
  if (!p || p.kind !== 'attack' || p.target !== id) return { error: '응답할 공격이 없습니다.' };
  const t = seat(g, id), a = seat(g, p.attacker), fx = [];
  const cardId = index === null || index === undefined ? undefined : t.hand[index];
  g.pending = null;
  if (cardId !== undefined && isDefense(C(cardId))) {
    takeOut(t, index); g.up.push(cardId); draw(g, t, 1, fx);
    const left = p.dmg - 1; // 방어 카드는 피해 -1 (방패·황실의 방패)
    say(g, `${t.name}이(가) ${C(cardId).name}(으)로 공격을 막았습니다!${left > 0 ? ` (남은 피해 ${left})` : ''}`);
    fx.push({ kind: 'use', by: t.id, card: cardId }, { kind: 'block', target: t.id, by: a.id });
    if (left > 0) hurt(g, t, left, fx, 'attack');
  } else {
    say(g, `${t.name}이(가) 공격을 받았습니다. (피해 ${p.dmg})`);
    hurt(g, t, p.dmg, fx, 'attack');
  }
  afterPending(g, fx);
  return { fx };
}
// 거절: 다른 사람이 쓴 행동 카드를 취소 (그 카드는 돌아가지 않는다)
export function counter(g, id, index) {
  const p = g.pending, s = seat(g, id);
  if (!p || p.kind !== 'counter') return { error: '거절할 카드가 없습니다.' };
  if (p.by === id) return { error: '자신의 카드는 거절할 수 없습니다.' };
  if (!s?.alive || C(s.hand[index] ?? 0).name !== '거절') return { error: '거절 카드가 없습니다.' };
  const cardId = takeOut(s, index), fx = [];
  g.up.push(cardId); draw(g, s, 1, fx); g.pending = null;
  say(g, `${s.name}이(가) 거절했습니다! ${p.ctx.c.name}은(는) 효과 없이 버려집니다.`);
  fx.push({ kind: 'use', by: s.id, card: cardId }, { kind: 'refuse', by: s.id, target: p.by });
  afterPending(g, fx);
  return { fx };
}
// 아무도 거절하지 않으면 (시간이 지나면) 효과를 낸다
export function resolveCounter(g) {
  const p = g.pending;
  if (!p || p.kind !== 'counter') return { error: '없음' };
  g.pending = null; const fx = [];
  resolve(g, p.ctx, fx);
  afterPending(g, fx);
  return { fx };
}
// 고르기: 불공정 거래 { take, give } / 상점 { pick } / 고블린 { target }. 시간이 지나면 auto=true로 무작위
export function choose(g, id, data = {}, auto = false) {
  const p = g.pending;
  if (!p || p.kind !== 'choice' || p.who !== id) return { error: '고를 것이 없습니다.' };
  const s = seat(g, id), fx = [];
  if (p.type === 'unfair') {
    const t = seat(g, p.target);
    let ti = auto ? rnd(t.hand.length) : t.hand.indexOf(p.options[data.take]);
    let gi = auto ? rnd(s.hand.length) : Number(data.give);
    if (ti < 0 || s.hand[gi] === undefined) return { error: '가져올 카드와 줄 카드를 하나씩 골라 주세요.' };
    const got = takeOut(t, ti), gift = takeOut(s, gi);
    give(g, s, got, fx); give(g, t, gift, fx);
    say(g, `불공정 거래 성사: ${s.name}이(가) ${t.name}의 카드를 골라 가져가고, 카드 한 장을 뒷면으로 건넸습니다.`);
    fx.push({ kind: 'steal', by: s.id, target: t.id });
  } else if (p.type === 'shop') {
    const i = auto ? rnd(g.shop.length) : Number(data.pick);
    if (g.shop[i] === undefined) return { error: '가져갈 카드를 골라 주세요.' };
    const got = g.shop.splice(i, 1)[0]; give(g, s, got, fx);
    say(g, `${s.name}이(가) 상점에서 ${C(got).name}을(를) 가져갔습니다.`);
  } else if (p.type === 'force') {
    const pool = p.options.map(x => seat(g, x)).filter(x => x.alive);
    const pickR = () => pool.splice(rnd(pool.length), 1)[0];
    let tt = auto ? pickR() : seat(g, data.target), tt2 = p.spec === 'two' ? (auto ? pickR() : seat(g, data.target2)) : null;
    if (!tt || !p.options.includes(tt.id) || (p.spec === 'two' && (!tt2 || tt2 === tt || !p.options.includes(tt2.id)))) return { error: p.spec === 'two' ? '서로 다른 두 사람을 골라 주세요.' : '대상을 골라 주세요.' };
    g.pending = null;
    applyForced(g, s, seat(g, p.target), p.card, tt, tt2, fx);
    afterPending(g, fx);
    return { fx };
  } else if (p.type === 'keep3') {
    let keep = auto ? s.hand.map((x, i) => i).slice(0, 3) : [...new Set((data.keep || []).map(Number))];
    if (keep.length !== 3 || keep.some(i => s.hand[i] === undefined)) return { error: '남길 카드 3장을 골라 주세요.' };
    const kept = keep.map(i => s.hand[i]);
    g.down.push(...s.hand.filter((x, i) => !keep.includes(i))); s.hand = kept;
    say(g, `${s.name}이(가) 카드 3장만 남기고 나머지를 내려놓았습니다.`);
  } else if (p.type === 'goblin') {
    const others = alive(g).filter(x => x !== s && x.hand.length);
    const t = auto ? others[rnd(others.length)] : seat(g, data.target);
    if (!t || !others.includes(t)) return { error: '카드를 가져올 사람을 골라 주세요.' };
    give(g, s, takeOut(t, rnd(t.hand.length)), fx);
    say(g, `${s.name}의 고블린이 ${t.name}의 카드 한 장을 가져왔습니다.`);
    fx.push({ kind: 'steal', by: s.id, target: t.id }); checkDeath(g, t, fx);
  }
  g.pending = null;
  if (p.type === 'shop') nextShopPick(g);
  afterPending(g, fx);
  return { fx };
}
function nextShopPick(g) {
  while (g.queue.length && g.shop?.length) {
    const who = seat(g, g.queue.shift());
    if (!who.alive) continue;
    g.pending = { kind: 'choice', type: 'shop', who: who.id, options: g.shop, endsAt: Date.now() + CHOICE_MS };
    return;
  }
  if (g.shop?.length) g.up.push(...g.shop);
  g.shop = null; g.queue = [];
}
function afterPending(g, fx = []) {
  if (!g.pending && g.queue.length) nextShopPick(g);
  advance(g, fx);
}

/* ---------- 차례: 행동 → 거래 턴 → 다음 사람. 모두 한 번씩 하면 헌납 ---------- */
// 차례 끝내기: 행동을 마치고 거래 턴으로
export function endTurn(g, id) {
  if (g.over) return { error: '게임이 끝났습니다.' };
  const s = g.seats[g.turn];
  if (s.id !== id) return { error: '내 차례가 아닙니다.' };
  if (g.phase !== 'action') return { error: '이미 차례를 끝냈습니다.' };
  if (g.pending) return { error: '다른 일이 끝나기를 기다리는 중입니다.' };
  const fx = [];
  g.forceEnd = false; g.phase = 'trade'; g.tradesDone = 0; g.tradeOpen = false;
  // 고블린: 거래 턴이 시작될 때 원하는 사람의 카드를 가져온다
  const others = alive(g).filter(x => x !== s && x.hand.length);
  if (s.alive && fieldHas(s, '고블린') && others.length) g.pending = { kind: 'choice', type: 'goblin', who: s.id, options: others.map(x => x.id), endsAt: Date.now() + CHOICE_MS };
  advance(g, fx);
  return { fx };
}
// 기다리는 일이 없을 때 다음 단계로 진행한다
function advance(g, fx) {
  while (!g.over && !g.pending) {
    if (g.phase === 'trade') {
      if (g.tradeOpen) { g.tradeOpen = false; g.tradesDone++; } // 거래 하나(성사/거절/불공정 거래)가 끝났다
      const s = g.seats[g.turn], limit = g.market ? 2 : 1;
      if (s.alive && g.tradesDone < limit && alive(g).some(x => x !== s && !blocked(g, s, x))) {
        g.pending = { kind: 'trade', stage: 'offer', who: s.id, endsAt: Date.now() + TRADE_MS }; g.tradeOpen = true;
        say(g, `${s.name}의 거래 턴입니다.`); fx.push({ kind: 'trade-turn', id: s.id });
        return;
      }
      finishTurn(g, fx); continue;
    }
    if (g.phase === 'reveal') { revealAltar(g, fx); continue; }
    return; // 행동 중(사람을 기다림)
  }
}
function finishTurn(g, fx) {
  const s = g.seats[g.turn];
  if (!g.played.includes(s.id)) g.played.push(s.id);
  if (alive(g).every(x => g.played.includes(x.id))) return startOffering(g, fx); // 라운드 끝 → 헌납
  nextTurn(g, fx);
}
function nextTurn(g, fx) {
  let next = g.turn;
  do next = (next + g.dir + g.seats.length) % g.seats.length; while (!g.seats[next].alive);
  g.turn = next;
  startTurn(g, fx);
}
function startTurn(g, fx) {
  const s = g.seats[g.turn];
  g.phase = 'action'; g.actions = ACTIONS_PER_TURN; g.turnCount++; s.attacksTurn = 0;
  if (g.tavern && g.turnCount >= g.tavern.until) { g.tavern = null; say(g, '주점이 문을 닫아 모두 원래 직업으로 돌아갔습니다.'); }
  const n = g.tree ? 2 : 1;
  draw(g, s, n, fx); // 차례를 시작할 때 1장 (세계수가 있으면 1장 더)
  say(g, `${s.name}의 차례입니다. (카드 ${n}장 뽑음)`);
  fx.push({ kind: 'turn', id: s.id, drew: n });
}
function startRound(g, fx) {
  g.round++; g.played = []; say(g, `라운드 ${g.round}이 시작되었습니다.`);
  g.charms = g.charms.filter(x => x.until > g.round);
  g.barriers = g.barriers.filter(x => x.until > g.round);
  if (g.tree && g.tree.until <= g.round) { g.tree = null; say(g, '세계수가 시들었습니다.'); }
  if (g.market && g.market.until <= g.round) { g.market = null; say(g, '암시장이 문을 닫았습니다.'); }
  for (const s of g.seats) {
    s.hitsRound = 0;
    if (!s.alive) continue;
    if (fieldHas(s, '치유의 펜던트')) { draw(g, s, 1, fx); fx.push({ kind: 'heal', target: s.id, amount: 1 }); say(g, `${s.name}의 치유의 펜던트가 빛납니다. (+1)`); }
    for (const f of [...s.field]) {
      if (f.until > g.round) continue;
      s.field.splice(s.field.indexOf(f), 1);
      const n = C(f.card).name;
      if (n === '던전' && f.dmg < 3) { give(g, s, f.card, fx); draw(g, s, 2, fx); say(g, `${s.name}이(가) 던전을 무사히 빠져나왔습니다! 던전을 돌려받고 2장을 뽑습니다.`); fx.push({ kind: 'heal', target: s.id, amount: 2 }); continue; }
      if (n === '여명과 황혼의 산') {
        draw(g, s, 5, fx); const jobs = g.seats.filter(x => !x.alive && x.job).map(x => x.job);
        say(g, `${s.name}이(가) 여명과 황혼의 산에서 내려와 카드 5장${jobs.length ? `과 쓰러진 사람들의 직업(${jobs.join(', ')})` : ''}을 얻었습니다.`);
        fx.push({ kind: 'heal', target: s.id, amount: 5 });
      } else say(g, `${s.name}의 ${n}이(가) 수명을 다했습니다.`);
      g.up.push(f.card);
    }
  }
}

/* ---------- 거래 턴 (규칙 4): 원하는 상대에게 뒷면 카드 1장. 무슨 카드라고 말할 수 있다(거짓말 가능) ---------- */
const cleanClaim = c => (CARDS.some(x => x.name === c) ? c : ''); // 말한 카드 이름 (없거나 이상하면 "말없이")
const tradable = id => C(id).name !== '악마의 서'; // 악마의 서는 거래할 수 없다
export function tradeOffer(g, id, { target, index, claim } = {}) {
  const p = g.pending;
  if (!p || p.kind !== 'trade' || p.stage !== 'offer' || p.who !== id) return { error: '지금은 거래를 제안할 수 없습니다.' };
  const s = seat(g, id), t = seat(g, target), cardId = s.hand[index];
  if (!t || !t.alive || t === s) return { error: '거래할 상대를 골라 주세요.' };
  if (blocked(g, s, t)) return { error: `방벽 때문에 ${t.name}과(와) 거래할 수 없습니다.` };
  if (cardId === undefined) return { error: '내밀 카드를 손패에서 골라 주세요.' };
  if (!tradable(cardId)) return { error: '악마의 서는 거래할 수 없습니다.' };
  if (!t.hand.some(tradable)) return { error: `${t.name}에게는 거래할 수 있는 카드가 없습니다.` };
  const said = cleanClaim(claim);
  g.pending = { kind: 'trade', stage: 'answer', who: t.id, from: s.id, card: cardId, claim: said, endsAt: Date.now() + ANSWER_MS };
  say(g, `${s.name}이(가) ${t.name}에게 ${said ? `"${said}"라며` : '말없이'} 카드 1장을 내밀어 거래를 제안합니다.`);
  return { fx: [{ kind: 'offer', by: s.id, target: t.id }] };
}
export function tradeSkip(g, id) {
  const p = g.pending;
  if (!p || p.kind !== 'trade' || p.stage !== 'offer' || p.who !== id) return { error: '지금은 거래 턴이 아닙니다.' };
  g.pending = null; g.tradeOpen = false; g.tradesDone = 99;
  say(g, `${seat(g, id).name}이(가) 거래하지 않고 차례를 마쳤습니다.`);
  const fx = []; advance(g, fx); return { fx };
}
export function tradeAnswer(g, id, { accept, index, claim } = {}) {
  const p = g.pending;
  if (!p || p.kind !== 'trade' || p.stage !== 'answer' || p.who !== id) return { error: '답할 거래가 없습니다.' };
  const t = seat(g, id), s = seat(g, p.from), fx = [];
  if (accept) {
    const myId = t.hand[index];
    if (myId === undefined) return { error: '대신 내밀 카드를 손패에서 골라 주세요.' };
    if (!tradable(myId)) return { error: '악마의 서는 거래할 수 없습니다.' };
    const si = s.hand.indexOf(p.card);
    if (si >= 0) {
      const said = cleanClaim(claim);
      takeOut(s, si); takeOut(t, index); g.pending = null;
      give(g, s, myId, fx); give(g, t, p.card, fx);
      say(g, `${t.name}이(가) ${said ? `"${said}"라며` : '말없이'} 카드를 내밀어 거래가 성사되었습니다.`);
      fx.push({ kind: 'traded', to: s.id, got: myId, claim: said, with: t.id }, { kind: 'traded', to: t.id, got: p.card, claim: p.claim, with: s.id }, { kind: 'trade-done', a: s.id, b: t.id });
      advance(g, fx); return { fx };
    }
  }
  g.pending = null;
  say(g, `${t.name}이(가) 거래를 거절했습니다.`);
  fx.push({ kind: 'refuse', by: t.id, target: s.id });
  advance(g, fx); return { fx };
}

/* ---------- 헌납 (규칙 5) ---------- */
function startOffering(g, fx) {
  g.phase = 'offering';
  const need = alive(g).filter(x => x.hand.some(tradable)).map(x => x.id); // 바칠 카드가 있는 사람은 모두 의무
  say(g, `라운드 ${g.round}이 끝났습니다. 헌납: 모두 카드 1장을 골라 제단에 바칩니다.`);
  fx.push({ kind: 'offering' });
  if (!need.length) { g.phase = 'reveal'; g.altar.placed = []; return; }
  g.pending = { kind: 'offering', need, picks: {}, endsAt: Date.now() + OFFER_MS };
}
export function offer(g, id, index, auto = false) {
  const p = g.pending;
  if (!p || p.kind !== 'offering') return { error: '지금은 헌납 시간이 아닙니다.' };
  const fx = [];
  const pickFor = (sid, i) => {
    const s = seat(g, sid), ok = s.hand.filter(tradable);
    const cardId = i === null ? ok[rnd(ok.length)] : s.hand[i];
    if (cardId === undefined) return '바칠 카드를 골라 주세요.';
    if (!tradable(cardId)) return '악마의 서는 내려놓을 수 없습니다.';
    p.picks[sid] = cardId; fx.push({ kind: 'offered', by: sid }); return '';
  };
  if (auto) { for (const sid of p.need) if (p.picks[sid] === undefined) pickFor(sid, null); } // 시간이 지나면 남은 사람은 무작위로
  else {
    if (!p.need.includes(id)) return { error: '바칠 카드가 없습니다.' };
    if (p.picks[id] !== undefined) return { error: '이미 바칠 카드를 골랐습니다.' };
    const e = pickFor(id, index); if (e) return { error: e };
  }
  if (p.need.every(x => p.picks[x] !== undefined)) placeAltar(g, fx);
  return { fx };
}
// 신호에 맞춰 동시에 내려놓고 섞는다. 공개 전 잠깐 동안 제단 도둑을 쓸 수 있다
function placeAltar(g, fx) {
  const p = g.pending, cards = [];
  for (const [sid, cardId] of Object.entries(p.picks)) { const s = seat(g, sid), i = s.hand.indexOf(cardId); if (i >= 0) cards.push(takeOut(s, i)); }
  g.altar.placed = g.shuffle(cards);
  say(g, `모두 동시에 카드 ${cards.length}장을 제단에 바쳤습니다. 섞어서 공개합니다.`);
  fx.push({ kind: 'placed', count: cards.length });
  g.phase = 'reveal';
  g.pending = { kind: 'thief', endsAt: Date.now() + THIEF_MS };
}
export function thief(g, id, index) {
  const p = g.pending, s = seat(g, id);
  if (!p || p.kind !== 'thief') return { error: '지금은 제단 도둑을 쓸 수 없습니다.' };
  if (!s?.alive || C(s.hand[index] ?? 0).name !== '제단 도둑') return { error: '제단 도둑 카드가 없습니다.' };
  if (!g.altar.placed.length) return { error: '제단에 카드가 없습니다.' };
  const fx = [], cardId = takeOut(s, index);
  g.up.push(cardId); draw(g, s, 1, fx);
  const got = g.altar.placed.splice(rnd(g.altar.placed.length), 1)[0];
  give(g, s, got, fx); g.pending = null;
  say(g, `${s.name}이(가) 제단 도둑으로 공개 직전의 제단에서 카드 한 장을 슬쩍했습니다!`);
  fx.push({ kind: 'use', by: s.id, card: cardId }, { kind: 'traded', to: s.id, got, claim: '', thief: true });
  advance(g, fx); return { fx };
}
export function endThief(g) {
  if (g.pending?.kind !== 'thief') return { error: '없음' };
  g.pending = null; const fx = []; advance(g, fx); return { fx };
}
function revealAltar(g, fx) {
  const placed = g.altar.placed; g.altar.placed = [];
  const seals = placed.filter(id => C(id).kind === '제물');
  g.up.push(...placed.filter(id => C(id).kind !== '제물'));
  g.altar.seals.push(...seals);
  say(g, placed.length ? `제단 공개: ${placed.map(id => C(id).name).join(', ')}${seals.length ? ` → 제물 ${seals.length}장이 제단에 남아 봉인이 진행됩니다!` : ''}` : '제단에 바쳐진 카드가 없습니다.');
  if (placed.some(id => C(id).name === '몽마의 돌')) { // 몽마의 돌: 제물이 있으면 모두 쫓아내고, 없으면 뒷면 버림에서 하나 불러온다
    if (g.altar.seals.length) { say(g, '몽마의 돌이 제단의 제물을 모두 버림 더미로 쫓아냈습니다.'); g.up.push(...g.altar.seals); g.altar.seals = []; }
    else {
      const i = g.down.findIndex(id => C(id).kind === '제물');
      if (i >= 0) { g.altar.seals.push(g.down.splice(i, 1)[0]); say(g, '몽마의 돌이 뒷면 버림 더미에서 제물 한 장을 제단으로 불러왔습니다!'); }
    }
  }
  fx.push({ kind: 'altar', cards: placed, seals: g.altar.seals.length, goal: SEAL_GOAL });
  if (g.altar.seals.length >= SEAL_GOAL) {
    g.over = { winner: 'demon', seal: true }; g.pending = null;
    say(g, '봉인 의식이 완성되었습니다! 마왕군의 승리!'); fx.push({ kind: 'over' }); return;
  }
  for (const s of alive(g)) draw(g, s, 1, fx); // 모두 1장씩 보충
  startRound(g, fx);
  nextTurn(g, fx);
}

/* ---------- 화면에 보낼 정보 ---------- */
// 한 사람에게 보낼 게임 정보 (남의 손패, 숨겨진 진영, 남이 고를 선택지는 보내지 않는다)
export function viewFor(g, id) {
  const me = seat(g, id), p = g.pending, n = g.seats.length;
  const jobOf = i => (g.tavern ? g.seats[(i + g.tavern.dir + n) % n].job : g.seats[i].job); // 주점: 진행 방향의 반대로 한 칸
  let pending = null;
  if (p?.kind === 'attack') pending = { kind: 'attack', attacker: p.attacker, target: p.target, card: p.card, dmg: p.dmg };
  if (p?.kind === 'counter') pending = { kind: 'counter', by: p.by, card: p.ctx.cardId, target: p.ctx.t?.id };
  if (p?.kind === 'choice') pending = { kind: 'choice', type: p.type, who: p.who, target: p.target, card: p.type === 'force' ? p.card : undefined, spec: p.spec,
    options: p.who === id || p.type === 'shop' ? p.options : undefined };
  if (p?.kind === 'trade') pending = { kind: 'trade', stage: p.stage, who: p.who, from: p.from, claim: p.claim };
  if (p?.kind === 'offering') pending = { kind: 'offering', need: p.need, done: Object.keys(p.picks), mine: p.picks[id] ?? null };
  if (p?.kind === 'thief') pending = { kind: 'thief' };
  if (pending) pending.left = Math.max(0, p.endsAt - Date.now());
  return {
    round: g.round, turn: g.seats[g.turn].id, phase: g.phase, actions: g.actions, actionsMax: ACTIONS_PER_TURN, dir: g.dir, tree: !!g.tree, tavern: !!g.tavern,
    market: !!g.market, played: g.played, altar: { seals: g.altar.seals, goal: SEAL_GOAL, placed: g.altar.placed.length },
    deck: g.deck.length, up: g.up.at(-1) ?? null, down: g.down.length,
    players: g.seats.map((s, i) => ({
      id: s.id, name: s.name, hand: s.hand.length, soul: s.soul, alive: s.alive, job: jobOf(i),
      role: !s.alive || s.revealed || g.over || s === me ? (s.eater ? 'eater' : s.role) : undefined,
      field: s.field.map(f => ({ card: f.card, left: f.until - g.round })),
      charmed: g.charms.some(x => x.target === s.id), walled: g.barriers.some(x => x.a === s.id || x.b === s.id),
    })),
    hand: me ? me.hand : [], pending, log: g.log.slice(-6), over: g.over,
  };
}
