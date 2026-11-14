// 레벨 계산 점검. 실행: npm run test:xp
import assert from 'node:assert/strict';
process.env.DATA_DIR = (await import('node:fs')).mkdtempSync((await import('node:os')).tmpdir() + '/arcana-xp-');
delete process.env.DATABASE_URL;
const { levelOf, xpNeed, save, recordGame, publicView, getByKey } = await import('../profiles.js');
let sum = 0; for (let lv = 1; lv < 20; lv++) sum += xpNeed(lv);
assert.equal(sum, 2508);                                     // 20레벨까지 약 33판
assert.equal(levelOf(0).lv, 1); assert.equal(levelOf(59).lv, 1); assert.equal(levelOf(60).lv, 2);
assert.equal(levelOf(2508).lv, 20); assert.equal(levelOf(2507).lv, 19);
for (let lv = 1; lv < 98; lv++) assert.ok(xpNeed(lv + 1) > xpNeed(lv), 'gets harder at ' + lv);
assert.ok(xpNeed(40) > 5 * xpNeed(19));                       // 20레벨 이후 급격히 어려워짐
assert.equal(levelOf(1e12).lv, 99);
const { profile } = save(null, { nickname: '시험용' });
assert.equal(recordGame(profile.key, { camp: 'hero', win: true, survived: true }), 110);
assert.equal(recordGame(profile.key, { camp: 'demon', win: false, survived: false }), 40);
const v = publicView(getByKey(profile.key));
assert.deepEqual([v.stats.heroGames, v.stats.heroWins, v.stats.demonGames, v.stats.demonWins, v.stats.xp, v.level.lv, v.stats.streak, v.stats.bestStreak], [1, 1, 1, 0, 150, 3, 0, 1]);
assert.deepEqual(v.stats.recent, ['h1', 'd0']);
console.log('PASS 레벨·경험치 점검 모두 통과');
process.exit(0);
