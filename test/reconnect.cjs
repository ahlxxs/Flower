// 재접속 시나리오 점검: 서버를 직접 띄우고 브라우저 여러 개로 확인한다.
// 실행: npm run test:reconnect  (playwright 필요: npm i -D playwright && npx playwright install chromium)
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const server = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3123', GRACE_MS: '15000' }, stdio: 'ignore' });
let failed = 0;
const U = 'http://localhost:3123';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (cond, label) => { if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + label); };
(async () => {
  await sleep(800);
  const b = await chromium.launch(); const errs = [];
  const tab = async ctx => { const p = await ctx.newPage(); // 로그인 창은 건너뛰고 게스트로
    await p.addInitScript(() => { try { sessionStorage.setItem('arcana-authed', 'guest'); } catch {} }); p.on('pageerror', e => errs.push(e.message)); return p; };
  const A = await b.newContext(), B = await b.newContext();
  const a = await tab(A);
  await a.goto(U); await sleep(3300);
  await a.click('.cta'); await a.fill('#name', '방장'); await a.click('#form .btn:not(.ghost)');
  await a.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  const code = await a.textContent('#roomCode');

  // 1. 방장이 새로고침 → 같은 방, 방장 유지
  await a.reload(); await a.waitForSelector('#lobby:not([hidden])', { timeout: 10000 });
  ok(await a.textContent('#roomCode') === code, '방장 새로고침 후 같은 방으로 복귀');
  ok((await a.textContent('#seats')).includes('방장'), '방장 권한 유지');

  // 2. 손님 입장 → 탭 닫기 → 연결 끊김 표시 → 같은 이름으로 다시 들어오면 원래 자리
  let g = await tab(B);
  await g.goto(U + '/?room=' + code); await g.waitForFunction(() => document.getElementById('dlg').open, null, { timeout: 10000 });
  await g.fill('#name', '손님'); await g.click('#form .btn:not(.ghost)'); await g.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  await g.click('#action'); await sleep(300);
  await g.close(); await sleep(400);
  ok((await a.textContent('#seats')).includes('연결 끊김'), '손님 탭을 닫으면 방장 화면에 "연결 끊김"');
  const B2 = await b.newContext(); g = await tab(B2);
  await g.goto(U + '/?room=' + code); await g.waitForFunction(() => document.getElementById('dlg').open, null, { timeout: 10000 });
  await g.fill('#name', '손님'); await g.click('#form .btn:not(.ghost)'); await g.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  ok((await a.$$('#seats .seat:not(.empty)')).length === 2, '같은 이름으로 다시 들어오면 원래 자리 (자리 2개 유지)');
  ok(await g.textContent('#action') === '준비 취소', '준비 상태도 유지');

  // 3. 연결 끊김 → 자동 재연결
  await g.evaluate(() => ws.close()); await sleep(200);
  ok(!(await g.isHidden('#net')), '끊기면 "다시 연결하는 중" 알림');
  await sleep(1500);
  ok(await g.isHidden('#net') && (await a.textContent('#seats')).includes('준비 완료'), '자동 재연결 후 원래 자리');

  // 4. 게임 시작 후 새로고침 → 게임 화면
  await a.click('#action'); await g.waitForSelector('#game:not([hidden])', { timeout: 10000 });
  await g.reload(); await g.waitForSelector('#game:not([hidden])', { timeout: 10000 });
  ok(true, '게임 중 새로고침해도 게임 화면으로 복귀');

  // 5. 같은 토큰의 다른 탭 → 이전 탭에 안내
  const tok = await g.evaluate(() => sessionStorage.getItem('arcana-token'));
  const g2 = await tab(B2); await g2.goto(U); await g2.evaluate(t => sessionStorage.setItem('arcana-token', t), tok); await g2.reload();
  await g2.waitForSelector('#game:not([hidden])', { timeout: 10000 }); await sleep(300);
  ok((await g.textContent('#net')).includes('다른 탭'), '다른 탭이 자리를 가져가면 이전 탭에 안내');

  // 6. 유예 시간(테스트용 15초)이 지나면 끊긴 방장이 빠지고 방장이 넘어감
  await a.close(); await sleep(16500);
  const after = await g2.evaluate(() => room.players.map(p => p.name + (p.host ? '*' : '')).join(','));
  ok(after === '손님*', '유예 시간 후 끊긴 방장 제거 + 방장 이전 → ' + after);
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' / '));
  await b.close();
})().catch(e => { console.error(e); failed++; }).finally(() => { server.kill(); process.exit(failed ? 1 : 0); });
