const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
// 프로필 점검: 임시 저장 폴더로 서버를 띄우고 브라우저 여러 개로 확인한다. 실행: npm run test:profiles
const { mkdtempSync } = require('node:fs'); const { tmpdir } = require('node:os'); const { join } = require('node:path');
const U = 'http://localhost:3123', DATA = mkdtempSync(join(tmpdir(), 'arcana-')), sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, l) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + l); };
const start = () => spawn('node', ['server.js'], { env: { ...process.env, PORT: '3123', DATA_DIR: DATA }, stdio: 'ignore' });
(async () => {
  let srv = start(); await sleep(800);
  const b = await chromium.launch(); const errs = [];
  const page = async (w = 1440, h = 860) => { const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const ready = p => p.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 15000 });

  // 1. 프로필 만들기
  const a = await page(); await a.goto(U); await ready(a);
  await a.click('#meBtn'); await sleep(200);
  await a.fill('#pName', '용사아린'); await a.fill('#pIntro', '봉인은 내가 막는다.');
  await a.click('[name=pEmblem][value=sword] + .medal'); await a.click('[name=pColor][value=crimson] + .swatch');
  await a.click('#pSave'); await sleep(500);
  ok((await a.textContent('#pMsg')) === '저장했습니다.', '프로필 만들기');
  ok((await a.textContent('#meBtn')).includes('용사아린'), '오른쪽 위에 내 프로필 표시');
  await a.click('[data-close="profile"]');

  // 2. 다른 기기에서 같은 닉네임으로 프로필 → 거절, 게스트로 그 닉네임 → 거절
  const g = await page(390, 800); await g.goto(U); await ready(g);
  await g.click('#meBtn'); await g.fill('#pName', '용사아린'); await g.click('#pSave'); await sleep(400);
  ok((await g.textContent('#pMsg')).includes('이미 다른 사람'), '중복 닉네임 거절');
  await g.click('[data-close="profile"]');

  // 3. 검색 → 보기
  await g.click('#meBtn'); await g.click('[data-ptab="find"]'); await g.fill('#pSearch', '용사'); await sleep(600);
  ok((await g.textContent('#pResults')).includes('용사아린'), '닉네임 일부로 검색');
  await g.click('#pResults button'); await sleep(400);
  ok((await g.textContent('#pviewBody')).includes('봉인은 내가 막는다.'), '검색 결과 눌러 프로필 보기');
  await g.click('#pview [data-close="pview"]'); await g.click('[data-close="profile"]');

  // 4. 방: 프로필 사용자가 만들고, 게스트가 참가 → 서로 눌러 보기
  await a.click('.cta'); await sleep(200);
  ok(await a.evaluate(() => document.getElementById('name').readOnly && document.getElementById('name').value === '용사아린'), '프로필 닉네임으로 입장 (고정)');
  await a.click('#form .btn:not(.ghost)'); await a.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  const code = await a.textContent('#roomCode');
  await g.click('.cta.join'); await g.fill('#name', '용사아린'); await g.fill('#code', code); await g.click('#form .btn:not(.ghost)'); await sleep(2200);
  ok((await g.textContent('#err')).includes('프로필로 등록된'), '게스트는 등록된 닉네임을 못 씀');
  await g.fill('#name', '나그네'); await g.click('#form .btn:not(.ghost)'); await g.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  await g.click('.seat[data-name="용사아린"]'); await sleep(400);
  ok((await g.textContent('#pviewBody')).includes('봉인은 내가 막는다.'), '대기실에서 프로필 사용자 눌러 보기');
  await a.click('.seat[data-name="나그네"]'); await sleep(300);
  ok((await a.textContent('#pviewBody')).includes('게스트'), '게스트는 게스트 카드');
  await a.click('#pview [data-close="pview"]');

  // 5. 수정 → 서버 재시작 후에도 유지
  await a.click('#meBtn'); await a.fill('#pIntro', '수정된 소개말'); await a.click('[name=pColor][value=violet] + .swatch'); await a.click('#pSave'); await sleep(1200);
  srv.kill(); await sleep(300); srv = start(); await sleep(1000);
  const c = await page(); await c.goto(U); await ready(c);
  await c.click('#meBtn'); await c.click('[data-ptab="find"]'); await c.fill('#pSearch', '아린'); await sleep(600);
  await c.click('#pResults button'); await sleep(400);
  ok((await c.textContent('#pviewBody')).includes('수정된 소개말'), '수정 내용이 서버 재시작 뒤에도 남아 있음');
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' / '));
  await b.close(); srv.kill(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
