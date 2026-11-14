// 로그인 점검: 회원가입, 아이디 기억, 비밀번호 확인, 시도 제한, 게스트, 초대 링크, 로그아웃, 배경 음악. 실행: npm run test:login
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync } = require('node:fs'); const { tmpdir } = require('node:os'); const { join } = require('node:path');
const U = 'http://localhost:3123', DATA = mkdtempSync(join(tmpdir(), 'arcana-')), sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3123', DATA_DIR: DATA }, stdio: 'ignore' });
let failed = 0;
const ok = (c, l) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + l); };
(async () => {
  await sleep(800);
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const errs = [];
  const tab = async ctx => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const ready = p => p.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 15000 });
  const isOpen = p => p.evaluate(() => document.getElementById('loginDlg').open);
  const ctxA = await b.newContext();

  // 1. 처음 접속: 로그인 창이 제일 먼저, 배경 음악도 흐른다
  let a = await tab(ctxA); await a.goto(U); await ready(a);
  ok(await isOpen(a), '처음 접속하면 로그인 창이 먼저 뜸');
  await a.keyboard.press('Tab'); await sleep(1500);
  ok(!(await a.evaluate(() => bgm.paused)), '로그인 창에서도 배경 음악');

  // 2. 회원가입
  await a.click('#lgToggle');
  await a.fill('#lgId', 'Hero_01'); await a.fill('#lgPw', 'abc123'); await a.fill('#lgPw2', 'abc999'); await a.fill('#lgNick', '용사');
  await a.click('#lgSubmit'); await sleep(200);
  ok((await a.textContent('#lgErr')).includes('일치하지 않습니다'), '비밀번호 확인이 다르면 거절');
  await a.fill('#lgPw2', 'abc123'); await a.click('#lgSubmit'); await sleep(600);
  ok(!(await isOpen(a)) && (await a.textContent('#meBtn')).includes('용사'), '가입 → 로그인 완료, 오른쪽 위에 내 프로필');
  const saved = readFileSync(join(DATA, 'profiles.json'), 'utf8');
  ok(saved.includes('"login":"hero_01"') && !saved.includes('abc123'), '비밀번호 원문은 저장하지 않음 (해시만)');

  // 3. 같은 탭 새로고침은 다시 묻지 않음
  await a.reload(); await ready(a); await sleep(300);
  ok(!(await isOpen(a)) && (await a.textContent('#meBtn')).includes('용사'), '같은 탭 새로고침: 로그인 유지');

  // 4. 새로 접속(같은 브라우저, 새 탭): 아이디는 채워져 있고 비밀번호를 물음
  await a.close(); a = await tab(ctxA); await a.goto(U); await ready(a);
  ok(await isOpen(a) && (await a.inputValue('#lgId')) === 'hero_01', '새로 접속: 기억한 아이디가 채워진 로그인 창');
  ok(!(await a.textContent('#meBtn')).includes('용사'), '비밀번호 전에는 로그인 안 된 상태');
  await a.fill('#lgPw', 'wrong1'); await a.click('#lgSubmit'); await sleep(400);
  ok((await a.textContent('#lgErr')).includes('맞지 않습니다'), '틀린 비밀번호 거절');
  await a.fill('#lgPw', 'abc123'); await a.click('#lgSubmit'); await sleep(500);
  ok(!(await isOpen(a)) && (await a.textContent('#meBtn')).includes('용사'), '맞는 비밀번호로 로그인 → 내 프로필');

  // 5. 다른 곳에서 같은 아이디로 가입 → 거절, 틀린 비밀번호 5번 → 잠시 잠김
  const ctxB = await b.newContext(); const c = await tab(ctxB); await c.goto(U); await ready(c);
  ok((await c.inputValue('#lgId')) === '', '다른 브라우저에는 아이디가 기억되어 있지 않음');
  await c.click('#lgToggle'); await c.fill('#lgId', 'hero_01'); await c.fill('#lgPw', 'abc123'); await c.fill('#lgPw2', 'abc123'); await c.fill('#lgNick', '가짜');
  await c.click('#lgSubmit'); await sleep(400);
  ok((await c.textContent('#lgErr')).includes('이미 사용 중인 아이디'), '중복 아이디 거절');
  await c.click('#lgToggle');
  for (let i = 0; i < 6; i++) { await c.fill('#lgPw', 'nope' + i + 'xx'); await c.click('#lgSubmit'); await sleep(250); }
  ok((await c.textContent('#lgErr')).includes('너무 많습니다'), '5번 틀리면 잠시 로그인 막힘');

  // 6. 게스트 + 초대 링크: 로그인 창 → 게스트로 시작 → 바로 참가 창
  await a.click('.cta'); await a.click('#form .btn:not(.ghost)'); await a.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  const code = await a.textContent('#roomCode');
  const ctxC = await b.newContext(); const g = await tab(ctxC); await g.goto(U + '/?room=' + code); await ready(g);
  ok(await isOpen(g) && !(await g.evaluate(() => document.getElementById('dlg').open)), '초대 링크도 로그인 창이 먼저');
  await g.click('#lgGuest'); await sleep(300);
  ok(await g.evaluate(() => document.getElementById('dlg').open && document.getElementById('code').value.length === 5), '게스트로 시작 → 바로 참가 창 (코드 채워짐)');
  await g.fill('#name', '나그네'); await g.click('#form .btn:not(.ghost)'); await g.waitForSelector('#lobby:not([hidden])'); await sleep(1500);
  ok((await a.textContent('#seats')).includes('나그네'), '게스트가 방에 들어옴');

  // 7. 로그아웃 → 로그인 창
  await a.click('#meBtn'); await a.click('#logoutBtn'); await sleep(300);
  ok(await isOpen(a) && !(await a.textContent('#meBtn')).includes('용사'), '로그아웃하면 로그인 창');
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' / '));
  await b.close();
})().catch(e => { console.error(e); failed++; }).finally(() => { server.kill(); process.exit(failed ? 1 : 0); });
