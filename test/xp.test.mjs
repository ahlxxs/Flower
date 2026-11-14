// 레벨 계산 점검. 실행: npm run test:xp
import assert from 'node:assert/strict';
process.env.DATA_DIR = (await import('node:fs')).mkdtempSync((await import('node:os')).tmpdir() + '/arcana-xp-');
delete process.env.DATABASE_URL;
const { levelOf, xpNeed, save, recordGame, publicView, getByKey, titlesOf, codexOf, setTitle, setFlag, TITLES, signup, bannersOf, BANNERS } = await import('../profiles.js');
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
// 칭호
const names = () => titlesOf(getByKey(t.key)).map(x => x.name);
const { profile: t } = save(null, { nickname: '칭호시험' });
assert.equal(TITLES.length, 25); assert.equal(new Set(TITLES.map(x => x.name)).size, 25);
assert.deepEqual(names(), ['새내기 모험가']);
for (let i = 0; i < 10; i++) recordGame(t.key, { camp: 'hero', win: true, survived: true, job: '궁수', hand: 3 });
assert.ok(names().includes('백발백중') && !names().includes('선지자'));
recordGame(t.key, { camp: 'demon', win: true, survived: true, job: '도적', hand: 10, sealWin: true, heroDeaths: 1 });
assert.ok(names().includes('완전무결') && !names().includes('종말 구도자'));     // 용사가 죽었으면 종말 구도자 아님
recordGame(t.key, { camp: 'demon', win: true, survived: true, job: '도적', hand: 1, soul: 0, sealWin: true, heroDeaths: 0 });
assert.ok(names().includes('종말 구도자') && names().includes('게임 체인저'));
recordGame(t.key, { camp: 'hero', win: false, survived: false, hand: 0 });          // 죽은 채 끝나면 게임 체인저 조건 아님 (이미 얻음)
for (let i = 0; i < 2; i++) recordGame(t.key, { camp: 'hero', win: false, survived: false });
assert.ok(names().includes('나 안삐졌어'));
let cx = codexOf(getByKey(t.key)); assert.equal(cx.find(x => x.id === 'sparkle').name, '???'); assert.equal(cx.find(x => x.id === 'seer').cur, 0);
assert.ok(setTitle(t.key, 'sparkle').error);
assert.ok(setFlag(t.key, 'sparkle')); assert.ok(!setFlag(t.key, 'sparkle')); assert.ok(!setFlag(t.key, 'doom')); // 클라이언트가 켤 수 있는 건 sparkle만
assert.equal(setTitle(t.key, 'sparkle').profile.title, 'sparkle');
assert.equal(publicView(getByKey(t.key)).title, '반짝 반짝');
// 배너 잠금과 관리자 계정
assert.deepEqual(bannersOf(getByKey(t.key)), ['none']);                                   // 일반 계정: 배너 전부 잠김
assert.equal(save(t.key, { nickname: '칭호시험', banner: 'gold', tbanner: 'planet' }).profile.banner, 'none');
const adm = signup({ login: 'lliooli', password: 'secret12', nickname: '관리자' }).profile;
assert.equal(titlesOf(adm).length, TITLES.length); assert.equal(bannersOf(adm).length, BANNERS.length);
assert.ok(codexOf(adm).every(x => x.got) && codexOf(adm).find(x => x.id === 'sparkle').name === '반짝 반짝');
save(adm.key, { nickname: '관리자', banner: 'planet', tbanner: 'crow' });
assert.deepEqual([publicView(adm).banner, publicView(adm).tbanner], ['planet', 'crow']);
assert.equal(setTitle(adm.key, 'legend').profile.title, 'legend');
console.log('PASS 레벨·경험치·칭호·배너 점검 모두 통과');
process.exit(0);
