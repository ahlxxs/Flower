// 맵(배경) 점검: 홈에서 번갈아 바뀜, 방장이 고르면 모두의 대기실·게임 배경이 바뀜. 실행: npm run test:maps
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs'); const { tmpdir } = require('node:os'); const { join } = require('node:path');
const U = 'http://localhost:3125', DATA = mkdtempSync(join(tmpdir(), 'arcana-')), sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3125', DATA_DIR: DATA }, stdio: 'ignore' });
let failed = 0;
const ok = (c, l) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + l); };
(async () => {
  await sleep(800);
  const b = await chromium.launch(); const errs = [];
  const page = async () => { const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } }); await ctx.addInitScript(() => sessionStorage.setItem('arcana-authed', 'guest'));
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.clock.install(); return p; };
  const ready = p => p.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 15000 });
  const map = p => p.evaluate(() => document.getElementById('frame').dataset.map);
  const shown = (p, m) => p.evaluate(m => [...document.querySelectorAll('#mapBack img.on, #mapFront img.on')].filter(i => i.complete && i.naturalWidth && i.src.includes('/maps/' + m + '-')).length === 2 && document.querySelectorAll('#mapBack img').length === 1, m);
  const A = await page(), B = await page();
  await A.goto(U); await ready(A); await B.goto(U); await ready(B);

  // 1. 홈: 20초마다 다음 맵
  const m0 = await map(A); await A.clock.runFor(20500); const m1 = await map(A); await A.clock.runFor(20000); const m2 = await map(A);
  ok(m0 === 'forest' && m1 === 'redcloud' && m2 === 'moongeese', `홈에서 맵이 번갈아 바뀜 → ${m0} → ${m1} → ${m2}`);

  // 2. 방장이 맵을 고르면 둘 다 바뀌고, 손님은 못 고름
  await A.clock.runFor(1000);
  await A.click('[data-open="create"]'); await A.fill('#name', '방장'); await A.click('#form .btn:not(.ghost)'); await A.waitForSelector('#lobby:not([hidden])'); await A.clock.runFor(2500);
  const code = await A.textContent('#roomCode');
  ok(await map(A) === 'forest' && (await A.$$('#mapPick .mp:not(:disabled)')).length === 25, '방을 만들면 기본 맵(깊은 숲), 방장은 맵 25개 중 고를 수 있음');
  await B.click('[data-open="join"]'); await B.fill('#name', '손님'); await B.fill('#code', code); await B.click('#form .btn:not(.ghost)'); await B.waitForSelector('#lobby:not([hidden])'); await B.clock.runFor(2500);
  ok((await B.$$('#mapPick .mp:disabled')).length === 25 && (await B.textContent('#mapNote')).includes('방장'), '손님은 맵을 고를 수 없음');
  await A.click('#mapPick [data-map="swamp"]'); await sleep(2300); // 바뀌는 연출(1.8초)은 실제 시간으로 흐른다
  ok(await map(A) === 'swamp' && await map(B) === 'swamp' && await shown(B, 'swamp'), '방장이 "보랏빛 늪"을 고르면 둘 다 그 배경 (이전 그림은 지워짐)');
  await B.clock.runFor(30000);
  ok(await map(B) === 'swamp', '대기실에서는 맵이 저절로 바뀌지 않음');

  // 3. 게임을 시작해도 같은 맵
  await B.click('#action'); await sleep(300); await A.click('#action'); await A.clock.runFor(9000); await B.clock.runFor(9000);
  ok(await A.evaluate(() => document.getElementById('frame').dataset.view) === 'game' && await map(A) === 'swamp' && await map(B) === 'swamp', '게임 화면에서도 같은 맵');
  const names = Object.keys(await A.evaluate(() => MAPS));
  const bad = await A.evaluate(async names => (await Promise.all(names.flatMap(n => ['back', 'front'].map(async p => [n + '-' + p, (await fetch(`/maps/${n}-${p}.svg`)).status])))).filter(([, s]) => s !== 200), names);
  ok(names.length === 25 && !bad.length, '맵 그림 50개 모두 받을 수 있음 ' + bad.join(' '));
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' / '));
  await b.close();
})().catch(e => { console.error(e); failed++; }).finally(() => { server.kill(); process.exit(failed ? 1 : 0); });
