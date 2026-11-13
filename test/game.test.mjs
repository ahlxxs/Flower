// 게임 진행 로직 점검 (브라우저 없이). 실행: npm run test:game
import assert from 'node:assert/strict';
import { CARDS } from '../cards.js';
import { newGame, useCard, react, counter, resolveCounter, choose, endTurn, viewFor, HAND_START } from '../game.js';

const id = name => { const c = CARDS.find(c => c.name === name); assert.ok(c, name); return c.id; };
const names = s => s.hand.map(i => CARDS[i].name);
const players = [{ id: 'a', name: 'A', role: 'hero', job: '용사' }, { id: 'b', name: 'B', role: 'demon', job: '도적' }, { id: 'c', name: 'C', role: 'hero', job: '사제' }];
// 섞지 않는 덱 + 손패를 정해 둔 게임
function fresh(hands = {}) {
  const g = newGame(players, a => a);
  const base = ['꽃', '꽃', '꽃', '꽃', '꽃'];
  g.seats.forEach(s => { s.hand = (hands[s.id] || base).map(id); });
  return g;
}
const A = g => g.seats[0], B = g => g.seats[1], Cc = g => g.seats[2];
const use = (g, who, name, opts) => { const s = g.seats.find(x => x.id === who); const r = useCard(g, who, s.hand.indexOf(id(name)), opts); return r; };
let passed = 0; const t = (label, fn) => { fn(); passed++; };

t('시작: 각자 5장, 첫 사람은 차례 시작 1장 더, 남의 진영은 안 보임', () => {
  const g = newGame(players, a => a);
  assert.equal(A(g).hand.length, HAND_START + 1);
  assert.equal(B(g).hand.length, HAND_START);
  assert.equal(viewFor(g, 'a').players[1].role, undefined);
  assert.equal(viewFor(g, 'a').players[0].role, 'hero', '내 진영은 보임');
});
t('차례 넘기기: 다음 사람이 1장 뽑음', () => {
  const g = fresh(); endTurn(g, 'a');
  assert.equal(viewFor(g, 'a').turn, 'b'); assert.equal(B(g).hand.length, 6);
});
t('공격 → 맞기 / 방어 → 막기', () => {
  let g = fresh({ a: ['검', '검', '꽃', '꽃', '꽃'] });
  assert.ok(use(g, 'a', '검', { target: 'a' }).error, '자신 공격 불가');
  assert.ok(!use(g, 'a', '검', { target: 'b' }).error);
  react(g, 'b', null); assert.equal(B(g).hand.length, 4); assert.equal(g.down.length, 1);
  assert.ok(!use(g, 'a', '검', { target: 'c' }).error, '공격 횟수 제한 없음 (행동 2번 안)');
  g = fresh({ a: ['검', '꽃', '꽃', '꽃', '꽃'], b: ['방패', '꽃', '꽃', '꽃', '꽃'] });
  use(g, 'a', '검', { target: 'b' }); react(g, 'b', 0); assert.equal(B(g).hand.length, 5);
});
t('소울하트가 피해를 먼저 받는다 (치유 물약)', () => {
  const g = fresh({ a: ['치유 물약', '꽃', '꽃', '꽃', '꽃'], b: ['검', '꽃', '꽃', '꽃', '꽃'] });
  use(g, 'a', '치유 물약'); assert.equal(A(g).soul, 2);
  endTurn(g, 'a'); use(g, 'b', '검', { target: 'a' }); react(g, 'a', null);
  assert.equal(A(g).soul, 1); assert.equal(A(g).hand.length, 5);
});
t('행동 카드는 거절로 막을 수 있다', () => {
  const g = fresh({ a: ['도둑질', '꽃', '꽃', '꽃', '꽃'], b: ['거절', '꽃', '꽃', '꽃', '꽃'] });
  use(g, 'a', '도둑질', { target: 'b' }); assert.equal(g.pending.kind, 'counter');
  assert.ok(counter(g, 'a', 0).error, '자기 카드는 거절 불가');
  counter(g, 'b', 0); assert.equal(g.pending, null); assert.equal(B(g).hand.length, 5, '훔쳐지지 않음 (거절 쓰고 1장 뽑음)');
});
t('도둑질 / 영혼 약탈 / 매혹', () => {
  let g = fresh({ a: ['도둑질', '꽃', '꽃', '꽃', '꽃'] });
  use(g, 'a', '도둑질', { target: 'b' }); resolveCounter(g);
  assert.equal(A(g).hand.length, 6); assert.equal(B(g).hand.length, 4);
  g = fresh({ a: ['영혼 약탈', '꽃', '꽃', '꽃', '꽃'] }); B(g).soul = 3;
  use(g, 'a', '영혼 약탈', { target: 'b' }); resolveCounter(g); assert.equal(B(g).soul, 0);
  g = fresh({ a: ['매혹', '꽃', '꽃', '꽃', '꽃'], b: ['검', '꽃', '꽃', '꽃', '꽃'] });
  use(g, 'a', '매혹', { target: 'b' }); resolveCounter(g); endTurn(g, 'a');
  assert.ok(use(g, 'b', '검', { target: 'a' }).error, '매혹한 사람을 공격 못 함');
});
t('관심법은 나에게만, 공개는 모두에게, 악마의 서는 들키면 쓰러짐', () => {
  let g = fresh({ a: ['관심법', '꽃', '꽃', '꽃', '꽃'] });
  use(g, 'a', '관심법', { target: 'b' }); const r = resolveCounter(g);
  assert.ok(r.fx.some(f => f.kind === 'peek' && f.to === 'a' && f.cards.length === 5));
  g = fresh({ a: ['공개', '꽃', '꽃', '꽃', '꽃'], b: ['악마의 서', '꽃', '꽃', '꽃', '꽃'] });
  use(g, 'a', '공개', { target: 'b' }); resolveCounter(g);
  assert.equal(B(g).alive, false); assert.deepEqual(g.over, { winner: 'hero' });
});
t('부의 재분배 / 부익부 빈익빈 / 대서재 / 도깨비', () => {
  let g = fresh({ a: ['부의 재분배', '꽃', '꽃', '꽃', '꽃', '꽃', '꽃'], b: ['검'] });
  use(g, 'a', '부의 재분배'); resolveCounter(g);
  assert.equal(B(g).hand.length, 7); assert.equal(A(g).hand.length, 1);
  g = fresh({ a: ['부익부 빈익빈', '꽃', '꽃', '꽃', '꽃', '꽃', '꽃'], b: ['검', '꽃'] });
  use(g, 'a', '부익부 빈익빈'); resolveCounter(g);
  assert.equal(B(g).hand.length, 1); assert.equal(A(g).hand.length, 8);
  g = fresh({ a: ['대서재', '꽃'], b: ['검', '검', '검'] });
  use(g, 'a', '대서재', { target: 'b' }); assert.deepEqual(names(A(g)), ['검', '검', '검']);
  g = fresh({ a: ['도깨비', '꽃'], b: ['검'], c: ['방패'] });
  use(g, 'a', '도깨비'); assert.deepEqual(names(A(g)), ['검'], 'A는 B의 손패를'); assert.equal(Cc(g).hand.length, 2, 'C는 A의 손패(꽃 + 방금 뽑은 1장)를'); assert.deepEqual(names(B(g)), ['방패'], 'B는 C의 손패를');
});
t('기부 / 투탕카멘의 가면 / 세이렌 / 별', () => {
  let g = fresh({ a: ['기부', '검', '꽃'] });
  const r = useCard(g, 'a', 0, { target: 'b', give: 1 }); assert.ok(!r.error, r.error); resolveCounter(g);
  assert.ok(names(B(g)).includes('검')); assert.ok(!names(A(g)).includes('검'));
  g = fresh({ a: ['투탕카멘의 가면', '꽃'] });
  use(g, 'a', '투탕카멘의 가면', { target: 'b' });
  assert.ok(names(B(g)).includes('투탕카멘의 가면')); assert.equal(B(g).hand.length, 4);
  g = fresh({ a: ['세이렌', '꽃'] });
  use(g, 'a', '세이렌', { target: 'c' }); assert.ok(names(Cc(g)).includes('세이렌')); assert.equal(A(g).hand.length, 3);
  g = fresh({ a: ['별', '꽃'] });
  use(g, 'a', '별', { target: 'b' }); assert.equal(A(g).soul, 2); assert.ok(names(B(g)).includes('별'));
});
t('별을 먹는 괴물: 별을 얻으면 즉시 승리', () => {
  const g = fresh({ a: ['별', '꽃'], b: ['별을 먹는 괴물', '꽃'] });
  B(g).eater = true; // (괴물을 이미 쓴 상태)
  use(g, 'a', '별', { target: 'b' });
  assert.deepEqual(g.over, { winner: 'eater', id: 'b' });
});
t('펜던트·던전은 앞에 놓이고 기간이 지나면 처리된다', () => {
  const g = fresh({ a: ['치유의 펜던트', '던전', '꽃', '꽃', '꽃'] });
  use(g, 'a', '치유의 펜던트'); use(g, 'a', '던전');
  assert.equal(A(g).field.length, 2);
  const before = A(g).hand.length;
  endTurn(g, 'a'); endTurn(g, 'b'); endTurn(g, 'c'); // 한 바퀴
  assert.equal(A(g).field.length, 1, '던전은 한 바퀴 뒤 끝남');
  assert.ok(A(g).hand.length >= before + 1 + 1 + 2 + 1, '펜던트 +1, 던전 돌려받음 + 2장, 차례 시작 +1');
});
t('파괴! / 정복', () => {
  let g = fresh({ a: ['파괴!', '꽃'], b: ['꽃'] }); B(g).field.push({ card: id('힘의 펜던트'), until: 9, dmg: 0 });
  use(g, 'a', '파괴!', { target: 'b' }); resolveCounter(g); assert.equal(B(g).field.length, 0);
  g = fresh({ a: ['정복', '꽃'], b: ['꽃'] }); B(g).field.push({ card: id('던전'), until: 9, dmg: 0 });
  use(g, 'a', '정복', { target: 'b' }); resolveCounter(g); assert.ok(names(A(g)).includes('던전'));
});
t('상점: 사용한 사람부터 한 장씩 고른다', () => {
  const g = fresh({ a: ['상점', '꽃'] });
  use(g, 'a', '상점'); assert.equal(g.pending.type, 'shop'); assert.equal(g.pending.who, 'a');
  assert.equal(g.shop.length, 3);
  choose(g, 'a', { pick: 0 }); assert.equal(g.pending.who, 'c', '시계 반대 방향 다음 사람');
  choose(g, 'c', {}, true); choose(g, 'b', {}, true); assert.equal(g.pending, null);
});
t('불공정 거래: 상대 카드를 보고 골라 가져오고 내 카드를 준다', () => {
  const g = fresh({ a: ['불공정 거래', '꽃'], b: ['검', '방패'] });
  use(g, 'a', '불공정 거래', { target: 'b' }); resolveCounter(g);
  assert.equal(g.pending.type, 'unfair'); assert.deepEqual(g.pending.options.map(i => CARDS[i].name), ['검', '방패']);
  assert.equal(viewFor(g, 'b').pending.options, undefined, '상대에게는 선택지가 안 보임');
  choose(g, 'a', { take: 1, give: 0 });
  assert.ok(names(A(g)).includes('방패')); assert.ok(names(B(g)).includes('꽃'));
});
t('악마의 숲: 차례가 끝나고 방향이 바뀐다 / 세계수: 공격 불가', () => {
  let g = fresh({ a: ['악마의 숲', '꽃'] });
  use(g, 'a', '악마의 숲'); assert.equal(g.forceEnd, true); assert.equal(g.dir, -1);
  endTurn(g, 'a'); assert.equal(viewFor(g, 'a').turn, 'c', '반대 방향');
  g = fresh({ a: ['세계수', '검', '꽃'] });
  use(g, 'a', '세계수'); assert.ok(use(g, 'a', '검', { target: 'b' }).error);
});
t('성스러운 십자가: 지닌 채 쓰러지면 모두에게 2 피해', () => {
  const g = fresh({ a: ['검', '꽃'], b: ['성스러운 십자가'], c: ['꽃', '꽃', '꽃'] });
  use(g, 'a', '검', { target: 'b' }); react(g, 'b', null);
  assert.equal(B(g).alive, false); assert.equal(Cc(g).hand.length, 1);
});
t('강제: 대상이 쓸 수 있는 카드를 쓰게 된다', () => {
  const g = fresh({ a: ['강제', '꽃'], b: ['치유 물약'] });
  use(g, 'a', '강제', { target: 'b' }); resolveCounter(g);
  assert.equal(B(g).soul, 2, 'B가 치유 물약을 썼다');
});
t('부활!: 쓰러진 사람이 3장을 들고 돌아온다', () => {
  const g = fresh({ a: ['부활!', '꽃'] }); Cc(g).alive = false; Cc(g).hand = [];
  use(g, 'a', '부활!'); resolveCounter(g); assert.equal(Cc(g).alive, true); assert.equal(Cc(g).hand.length, 3);
});
t('덱이 비면 버림 더미를 섞어 되돌린다', () => {
  const g = fresh({ a: ['꽃', '꽃'] }); g.up.push(...g.deck); g.deck = [];
  use(g, 'a', '꽃'); assert.ok(g.deck.length > 0 && A(g).hand.length === 2);
});
console.log(`PASS game.js 점검 ${passed}개 모두 통과`);
