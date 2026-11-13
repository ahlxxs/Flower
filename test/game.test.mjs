// 게임 진행 로직 점검 (브라우저 없이). 실행: npm run test:game
import assert from 'node:assert/strict';
import { CARDS } from '../cards.js';
import { newGame, useCard, react, endTurn, viewFor, HAND_START, ACTIONS_PER_TURN } from '../game.js';

const id = name => CARDS.find(c => c.name === name).id;
const players = [{ id: 'a', name: 'A', role: 'hero' }, { id: 'b', name: 'B', role: 'demon' }, { id: 'c', name: 'C', role: 'hero' }];
const fresh = () => {
  const g = newGame(players, a => a); // 섞지 않음 → 결과가 늘 같다
  g.seats.forEach(s => { s.hand = [id('검'), id('방패'), id('꽃'), id('성경'), id('검')]; }); // 손패를 정해 둔다
  return g;
};

// 시작: 모두 5장, 남의 손패는 안 보임
let g = newGame(players, a => a);
assert.equal(g.seats.every(s => s.hand.length === HAND_START), true);
const v = viewFor(g, 'a');
assert.equal(v.hand.length, HAND_START);
assert.equal(v.players.find(p => p.id === 'b').role, undefined, '살아 있는 사람의 진영은 안 보임');

// 공격 → 맞기: 대상 손패 -1, 공격자는 카드 쓰고 1장 뽑아 그대로 5장
g = fresh();
assert.ok(useCard(g, 'b', 0, 'a').error, '내 차례가 아니면 못 씀');
assert.ok(useCard(g, 'a', 0, 'a').error, '자신은 공격 못 함');
let r = useCard(g, 'a', 0, 'b');
assert.ok(!r.error, r.error);
assert.equal(g.seats[0].hand.length, 5);
assert.equal(g.pending.target, 'b');
assert.ok(useCard(g, 'a', 0, 'c').error, '응답을 기다리는 동안 못 씀');
r = react(g, 'b', null);
assert.equal(g.seats[1].hand.length, 4);
assert.equal(g.down.length, 1, '잃은 카드는 뒷면 버림');
assert.ok(r.fx.some(f => f.kind === 'hit'));
assert.equal(useCard(g, 'a', g.seats[0].hand.indexOf(id('성경')), 'c').error, undefined, '성경은 공격 뒤에도 사용 가능');
assert.ok(useCard(g, 'a', 0, 'c').error, `한 차례에 ${ACTIONS_PER_TURN}장까지`);

// 공격 → 방어
g = fresh();
useCard(g, 'a', 0, 'b');
r = react(g, 'b', 1); // 방패
assert.ok(r.fx.some(f => f.kind === 'block'));
assert.equal(g.seats[1].hand.length, 5, '막으면 잃지 않고, 방패를 쓴 뒤 1장 뽑음');
assert.ok(useCard(g, 'a', 0, 'c').error, '공격은 한 차례에 한 번');

// 방어 카드는 내 차례에 못 씀, 차례 넘기기
g = fresh();
assert.ok(useCard(g, 'a', 1).error);
endTurn(g, 'a');
assert.equal(viewFor(g, 'a').turn, 'b');

// 쓰러짐과 승리: 마왕군 B가 손패 1장일 때 맞으면 → 용사 파티 승리, 진영 공개
g = fresh();
g.seats[1].hand = [id('꽃')];
useCard(g, 'a', 0, 'b'); r = react(g, 'b', null);
assert.equal(g.seats[1].alive, false);
assert.ok(r.fx.some(f => f.kind === 'death'));
assert.deepEqual(g.over, { winner: 'hero' });
assert.equal(viewFor(g, 'c').players.find(p => p.id === 'b').role, 'demon');

// 덱이 비면 버림 더미를 섞어 되돌린다
g = fresh();
g.up.push(...g.deck); g.deck = [];
useCard(g, 'a', 2);
assert.ok(g.deck.length > 0 && g.seats[0].hand.length === 5);

console.log('PASS game.js 점검 모두 통과');
