const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
// 프로필(원정 기록부) 점검: 임시 저장 폴더로 서버를 띄우고 브라우저 여러 개로 확인한다. 실행: npm run test:profiles
const { mkdtempSync } = require('node:fs'); const { tmpdir } = require('node:os'); const { join } = require('node:path');
const U = 'http://localhost:3123', DATA = mkdtempSync(join(tmpdir(), 'arcana-')), sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, l) => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + l); };
const start = () => spawn('node', ['server.js'], { env: { ...process.env, PORT: '3123', DATA_DIR: DATA, ARCANA_TEST: '1' }, stdio: 'ignore' });
(async () => {
  let srv = start(); await sleep(800);
  const b = await chromium.launch(); const errs = [];
  const page = async (w = 1440, h = 860) => { const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const ready = p => p.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 15000 });
  const signup = async (p, id, nick) => {
    await p.waitForSelector('#loginDlg[open]'); await p.click('#lgToggle');
    await p.fill('#lgId', id); await p.fill('#lgPw', 'secret12'); await p.fill('#lgPw2', 'secret12'); await p.fill('#lgNick', nick);
    await p.click('#lgSubmit'); await sleep(500);
  };
  const guest = async p => { await p.waitForSelector('#loginDlg[open]'); await p.click('#lgGuest'); await sleep(200); };

  // 1. 회원가입 → 프로필 꾸미기
  const a = await page(); await a.goto(U); await ready(a);
  await signup(a, 'arin', '용사아린');
  ok(!(await a.evaluate(() => document.getElementById('loginDlg').open)), '회원가입하면 로그인 창이 닫힘');
  await a.click('#meBtn'); await sleep(300);
  ok(await a.evaluate(() => !document.getElementById('loader').classList.contains('done') && !document.getElementById('profile').open), '기록부를 열면 먼저 로딩 화면');
  await a.waitForSelector('#profile[open]'); await sleep(300);
  ok((await a.textContent('#pRecord')).includes('LEVEL') && (await a.textContent('.lp-tag .lv')) === '1', '새 계정은 1레벨');
  await a.fill('#pIntro', '봉인은 내가 막는다.');
  await a.click('[name=pEmblem][value=blade] + .o-em'); await a.click('[name=pColor][value=crimson] + .o-c'); await a.click('[name=pSkin][value=ebony] + .o-t'); await a.click('[name=pBanner][value=gold] + .o-t'); await a.click('[name=pTBanner][value=sakura] + .o-tb');
  ok((await a.getAttribute('.lp-rec', 'data-skin')) === 'ebony' && (await a.textContent('.lp-intro')).includes('봉인은 내가'), '꾸미는 대로 기록부가 바로 바뀜');
  await a.click('#pSave'); await sleep(500);
  ok((await a.textContent('#pMsg')) === '저장했습니다.', '프로필 만들기');
  ok((await a.textContent('#meBtn')).includes('용사아린'), '오른쪽 위에 내 프로필 표시');
  await a.click('[data-close="profile"]');

  // 2. 다른 기기에서 같은 닉네임으로 가입 → 거절, 그다음 게스트로
  const g = await page(390, 800); await g.goto(U); await ready(g);
  await signup(g, 'other', '용사아린');
  ok((await g.textContent('#lgErr')).includes('이미 다른 사람'), '중복 닉네임 거절');
  await g.click('#lgGuest'); await sleep(200);

  // 3. 게스트도 검색 → 보기
  await g.click('#meBtn'); await g.waitForSelector('#profile[open]'); await sleep(200); await g.fill('#pSearch', '용사'); await sleep(600);
  ok((await g.textContent('#pResults')).includes('용사아린'), '닉네임 일부로 검색');
  await g.click('#pResults button'); await sleep(400);
  ok((await g.textContent('#pRecord')).includes('봉인은 내가 막는다.') && (await g.textContent('#pRecord')).includes('용사아린의 기록'), '검색 결과 눌러 그 사람의 기록부 보기');
  ok((await g.getAttribute('.lp-rec', 'data-skin')) === 'ebony' && !!(await g.$('.pbanner.pb-gold')) && !!(await g.$('.tbanner.tb-sakura')), '가죽 재질·프로필 배너·칭호 배너도 저장됨');
  await g.click('[data-close="profile"]');

  // 4. 방: 프로필 사용자가 만들고, 게스트가 참가 → 서로 눌러 보기
  await a.click('.cta'); await sleep(200);
  ok(await a.evaluate(() => document.getElementById('name').readOnly && document.getElementById('name').value === '용사아린'), '프로필 닉네임으로 입장 (고정)');
  await a.click('#form .btn:not(.ghost)'); await a.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  const code = await a.textContent('#roomCode');
  await g.click('.cta.join'); await g.fill('#name', '용사아린'); await g.fill('#code', code); await g.click('#form .btn:not(.ghost)'); await sleep(2200);
  ok((await g.textContent('#err')).includes('프로필로 등록된'), '게스트는 등록된 닉네임을 못 씀');
  await g.fill('#name', '나그네'); await g.click('#form .btn:not(.ghost)'); await g.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  await g.click('.seat[data-name="용사아린"]'); await g.waitForSelector('#profile[open]'); await sleep(200);
  ok(await g.evaluate(() => document.getElementById('profile').open) && (await g.textContent('#pRecord')).includes('봉인은 내가 막는다.'), '대기실에서 프로필 사용자 눌러 기록부 보기');
  await g.click('[data-close="profile"]');
  await a.click('.seat[data-name="나그네"]'); await a.waitForSelector('#profile[open]'); await sleep(200);
  ok((await a.textContent('#pRecord')).includes('게스트'), '게스트는 게스트 기록');
  await a.click('[data-close="profile"]');

  // 4-1. 한 판이 끝나면 전적과 경험치가 쌓임 (용사 승리로 바로 끝냄)
  await g.click('#action'); await sleep(300); await a.click('#action'); await a.waitForSelector('#reveal:not([hidden])', { timeout: 15000 }); await sleep(1300); await a.click('#rvOk');
  const myRole = await a.evaluate(() => game.role || game.players[0].role);
  await a.evaluate(() => send({ type: 'debugOver', winner: 'hero' })); await sleep(800);
  const gain = myRole === 'hero' ? 110 : 50, lvAfter = myRole === 'hero' ? '2' : '1'; // 1→2레벨에 60 필요
  ok((await a.textContent('#overMe')).includes(`경험치 +${gain}`), `게임 결과 화면에 얻은 경험치 (${myRole}) → ` + await a.textContent('#overMe'));
  await a.evaluate(() => document.getElementById('meBtn').click()); await a.waitForSelector('#profile[open]'); await sleep(200);
  ok((await a.textContent('.lp-tag .lv')) === lvAfter && (await a.textContent('.lp-sub')).includes('1판 참가'), `기록부: 레벨 ${lvAfter}, 1판 참가 → ` + await a.textContent('.lp-xp'));
  await a.click('[data-close="profile"]'); await a.evaluate(() => send({ type: 'backToLobby' })); await sleep(800);

  // 5. 수정 → 서버 재시작 후에도 유지
  await a.click('#meBtn'); await a.waitForSelector('#profile[open]'); await sleep(200); await a.fill('#pIntro', '수정된 소개말'); await a.click('[name=pColor][value=violet] + .o-c'); await a.click('#pSave'); await sleep(1200);
  srv.kill(); await sleep(300); srv = start(); await sleep(1000);
  const c = await page(); await c.goto(U); await ready(c); await guest(c);
  await c.click('#meBtn'); await c.waitForSelector('#profile[open]'); await sleep(200); await c.click('[data-ptab="find"]'); await c.fill('#pSearch', '아린'); await sleep(600);
  await c.click('#pResults button'); await sleep(400);
  ok((await c.textContent('#pRecord')).includes('수정된 소개말') && (await c.textContent('.lp-sub')).includes('1판 참가'), '수정 내용과 전적이 서버 재시작 뒤에도 남아 있음');

  // 6. 도감: 칭호 목록·조건, 카드, 숨겨진 칭호 "반짝 반짝" 얻고 달기
  const d = await page(); await d.goto(U); await ready(d);
  await d.waitForSelector('#loginDlg[open]'); await d.fill('#lgId', 'arin'); await d.fill('#lgPw', 'secret12'); await d.click('#lgSubmit'); await sleep(600);
  await d.click('#codexBtn'); await sleep(400);
  ok(await d.evaluate(() => !document.getElementById('loader').classList.contains('done')), '도감도 로딩 화면 뒤에 열림'); await d.waitForSelector('#codex[open]'); await sleep(300);
  ok((await d.$$('#cxTitles li')).length === 25 && (await d.textContent('#cxTitles')).includes('부서지지 않는 신념'), '도감: 칭호 25개와 조건');
  ok((await d.textContent('#cxTitles')).includes('???') && !(await d.textContent('#cxTitles')).includes('반짝 반짝'), '숨겨진 칭호는 ???');
  await d.click('[data-ctab="cards"]'); await sleep(300);
  ok((await d.$$('#cxCards .ac')).length === 61, '도감: 카드 61종');
  await d.click('[data-close="codex"]'); await sleep(300);
  await d.evaluate(() => sealCycle(50)); await sleep(800);              // 마법진이 겹치는 순간을 앞당김
  ok((await d.textContent('#titleToast')).includes('반짝 반짝'), '홈에서 마법진이 겹치는 걸 보면 숨겨진 칭호 획득 알림');
  await d.click('#codexBtn'); await d.waitForSelector('#codex[open]'); await sleep(200);
  await d.click('[data-wear="sparkle"]'); await sleep(500);
  ok((await d.textContent('#cxTitles')).includes('달고 있음'), '도감에서 바로 칭호 달기');
  await d.click('[data-close="codex"]'); await d.click('#meBtn'); await d.waitForSelector('#profile[open]'); await sleep(200);
  ok((await d.textContent('.lp-tag .tt')) === '반짝 반짝' && (await d.$eval('#pTitle', s => s.value)) === 'sparkle', '기록부에도 단 칭호가 보이고 고를 수 있음');
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' / '));
  await b.close(); srv.kill(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); spawn('fuser', ['-k', '3123/tcp']); setTimeout(() => process.exit(1), 300); });
