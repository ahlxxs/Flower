// 친구 점검: 신청 → 실시간 알림 → 수락 → 접속·방 표시 → 방 참가 → 삭제. 실행: npm run test:friends
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs'); const { tmpdir } = require('node:os'); const { join } = require('node:path');
const U = 'http://localhost:3124', DATA = mkdtempSync(join(tmpdir(), 'arcana-')), sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3124', DATA_DIR: DATA }, stdio: 'ignore' });
let failed = 0;
const ok = (c, l) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + l); };
(async () => {
  await sleep(800);
  const b = await chromium.launch(); const errs = [];
  const page = async () => { const p = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const ready = p => p.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 15000 });
  const signup = async (p, id, nick) => {
    await p.goto(U); await ready(p); await p.waitForSelector('#loginDlg[open]'); await p.click('#lgToggle');
    await p.fill('#lgId', id); await p.fill('#lgPw', 'secret12'); await p.fill('#lgPw2', 'secret12'); await p.fill('#lgNick', nick); await p.click('#lgSubmit'); await sleep(600);
  };
  const friendsTab = async p => { if (!(await p.evaluate(() => document.getElementById('profile').open))) { await p.click('#hmProfile'); await p.waitForSelector('#profile[open]'); } await p.click('[data-ptab="friends"]'); await sleep(400); };
  const A = await page(), B = await page();
  await signup(A, 'frienda', '친구A'); await signup(B, 'friendb', '친구B');

  // 1. 잘못된 신청
  await friendsTab(A);
  await A.fill('#fName', '없는사람'); await A.click('#fAdd'); await sleep(300);
  ok((await A.textContent('#fMsg')).includes('없습니다'), '없는 닉네임은 거절');
  await A.fill('#fName', '친구A'); await A.click('#fAdd'); await sleep(300);
  ok((await A.textContent('#fMsg')).includes('자기 자신'), '나 자신은 거절');

  // 2. 신청 → 상대에게 바로 알림 → 수락
  await A.fill('#fName', '친구B'); await A.click('#fAdd'); await sleep(500);
  ok((await A.textContent('#fMsg')).includes('보냈습니다') && (await A.textContent('#fLists')).includes('보낸 신청'), 'A: 신청 보냄, 보낸 신청 목록');
  ok((await B.textContent('#titleToast')).includes('친구A님이 친구 신청'), 'B: 신청 알림이 바로 뜸');
  await friendsTab(B);
  ok((await B.textContent('#fBadge')) === '1' && (await B.textContent('#fLists')).includes('받은 신청'), 'B: 친구 탭에 받은 신청 1');
  await B.click('[data-fact="accept"]'); await sleep(500);
  ok((await B.textContent('#fLists')).includes('친구A') && (await B.textContent('#fLists')).includes('접속 중'), 'B: 수락 → 친구 목록에 A (접속 중)');
  ok((await A.textContent('#titleToast')).includes('친구가 되었습니다') && (await A.textContent('#fLists')).includes('친구B'), 'A: 친구가 됐다는 알림, 목록에 B');

  // 3. A가 방을 만들면 B의 친구 목록에 방 코드 → 참가
  await A.click('[data-close="profile"]'); await A.click('[data-open="create"]'); await A.click('#form .btn:not(.ghost)'); await A.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  const code = await A.textContent('#roomCode');
  await B.click('[data-ptab="mine"]'); await friendsTab(B);
  ok((await B.textContent('#fLists')).includes('방 ' + code), 'B: A가 있는 방 코드가 보임 → ' + code);
  await B.click('[data-fact="join"]'); await sleep(300);
  ok(await B.evaluate(c => document.getElementById('dlg').open && document.getElementById('code').value === c, code), 'B: 참가 누르면 그 방 코드로 참가 창');
  await B.click('#form .btn:not(.ghost)'); await B.waitForSelector('#lobby:not([hidden])'); await sleep(1500);
  ok((await A.textContent('#seats')).includes('친구B'), 'B가 친구 방에 들어옴');

  // 4. 다른 사람 기록에서 친구 표시, 삭제는 두 번 눌러야
  await A.click('.seat[data-name="친구B"]'); await A.waitForSelector('#profile[open]'); await sleep(300);
  ok((await A.textContent('#pRecord .lp-sec')).includes('✦ 친구'), 'A: 친구의 기록에 "친구" 표시');
  await A.click('[data-ptab="friends"]'); await sleep(300);
  await A.click('[data-fact="remove"]'); await sleep(200);
  ok((await A.textContent('#fLists')).includes('친구B'), '삭제는 한 번 누르면 확인만');
  await A.click('[data-fact="remove"]'); await sleep(500);
  ok(!(await A.textContent('#fLists')).includes('친구B'), 'A: 두 번 누르면 삭제');
  await B.click('.seat[data-name="친구A"]'); await B.waitForSelector('#profile[open]'); await sleep(300);
  ok(!!(await B.$('[data-befriend="친구A"]')), 'B 쪽에서도 친구가 끊겨 "친구 신청" 버튼이 다시 보임');
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' / '));
  await b.close();
})().catch(e => { console.error(e); failed++; }).finally(() => { server.kill(); process.exit(failed ? 1 : 0); });
