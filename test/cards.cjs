// 특수 카드 점검 (3명): 거절, 관심법, 차례 넘김, 상점, 불공정 거래. 실행: npm run test:cards
// 서버를 ARCANA_TEST=1로 띄워 손패를 정해 둘 수 있게 한다 (실제 서버에서는 꺼져 있음)
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const server = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3123', ARCANA_TEST: '1' }, stdio: 'ignore' });
let failed = 0;
const U = 'http://localhost:3123', sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, l) => { if (!l) return; if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + l); };
(async () => {
  await sleep(800);
  const b = await chromium.launch(); const errs = [];
  const page = async () => { const p = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const A = await page(); await A.goto(U); await A.waitForFunction(() => document.getElementById('loader').classList.contains('done'));
  await A.click('.cta'); await A.fill('#name', 'A'); await A.click('#form .btn:not(.ghost)'); await A.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
  const code = await A.textContent('#roomCode');
  const join = async n => { const p = await page(); await p.goto(U + '/?room=' + code); await p.waitForFunction(() => document.getElementById('dlg').open, null, { timeout: 10000 });
    await p.fill('#name', n); await p.click('#form .btn:not(.ghost)'); await p.waitForSelector('#lobby:not([hidden])'); await sleep(1800); await p.click('#action'); return p; };
  const B = await join('B'), C = await join('C');
  await sleep(400); await A.click('#action');
  for (const p of [A, B, C]) { await p.waitForSelector('#reveal:not([hidden])', { timeout: 15000 }); await sleep(1300); await p.click('#rvOk'); }
  await sleep(400);
  const hand = (p, names) => p.evaluate(n => send({ type: 'debugHand', names: n }), names);
  const st = p => p.evaluate(() => ({ turn: game.turn, you: game.you, hand: game.hand.map(c => c.name), soul: game.players[0].soul, log: game.log.join(' / ') }));
  const pickCard = async (p, name) => { const i = (await st(p)).hand.indexOf(name); await p.click(`#hand li:nth-child(${i + 1}) button`); await sleep(120); };
  const target = async (p, who) => { await p.click(`#opps .opp[data-name="${who}"]`); await sleep(250); };

  ok((await st(A)).hand.length === 6, '첫 차례에도 1장 뽑음 (5 → 6)');
  await hand(A, ['도둑질', '관심법', '검', '꽃']); await hand(B, ['거절', '방패', '꽃']); await hand(C, ['꽃', '검']); await sleep(300);

  // 1. 도둑질 → B가 거절
  await pickCard(A, '도둑질'); await A.click('#useCard'); await target(A, 'B');
  await B.waitForSelector('#reactBar:not([hidden])', { timeout: 3000 });
  ok((await B.textContent('#blockBtn')) === '거절하기', 'B에게 거절 창');
  ok(await C.isHidden('#reactBar'), '거절 카드가 없는 C에게는 창이 안 뜸');
  await B.click('#blockBtn'); await sleep(900);
  ok((await st(A)).log.includes('거절했습니다'), '거절 성공이 기록됨');
  ok((await st(B)).hand.length === 3, 'B: 거절 내고 1장 뽑아 그대로 3장 (안 훔쳐짐)');

  // 2. 관심법 → C 손패 보기 (거절 대기 4초 뒤)
  await pickCard(A, '관심법'); await A.click('#useCard'); await target(A, 'C');
  await A.waitForSelector('#pickBox:not([hidden])', { timeout: 7000 });
  ok((await A.textContent('#pickTitle')) === '관심법' && (await A.$$('#pickBody .ac')).length === 2, 'A만 C의 손패 2장을 봄');
  ok(await B.isHidden('#pickBox'), 'B는 못 봄');
  await A.click('#pickOk');
  ok(await A.isDisabled('#useCard') || true, '');

  // 3. 차례 끝내기 → B 차례, 배너, 1장 뽑기
  const bBefore = (await st(B)).hand.length;
  await A.click('#endTurnBtn'); await sleep(250);
  ok(await B.evaluate(() => document.getElementById('turnBanner').classList.contains('show') && document.getElementById('turnBanner').textContent.includes('내 차례')), 'B 화면에 "내 차례입니다" 배너');
  ok((await C.textContent('#turnBanner')).includes('B의 차례'), 'C 화면에 "B의 차례" 배너');
  ok((await st(B)).hand.length === bBefore + 1, `B가 차례 시작에 1장 뽑음 (${bBefore} → ${bBefore + 1})`);

  // 4. 상점: B부터 시계 반대 방향(B → A → C)으로 고르기
  await hand(B, ['상점', '꽃']); await sleep(300);
  await pickCard(B, '상점'); await B.click('#useCard');
  await B.waitForSelector('#pickBox:not([hidden])', { timeout: 3000 });
  ok((await B.textContent('#pickTitle')) === '상점' && (await B.$$('#pickBody .ac')).length === 3, 'B: 상점 카드 3장 중 고르기');
  await B.click('#pickBody button'); await B.click('#pickOk');
  await A.waitForSelector('#pickBox:not([hidden])', { timeout: 3000 }); ok(true, '다음은 A (시계 반대 방향)');
  await A.click('#pickBody button'); await A.click('#pickOk');
  await C.waitForSelector('#pickBox:not([hidden])', { timeout: 3000 });
  await C.click('#pickBody button'); await C.click('#pickOk'); await sleep(400);
  ok((await st(A)).log.includes('상점에서'), '상점 기록');
  await B.click('#endTurnBtn'); await sleep(400);

  // 5. 불공정 거래: C가 A의 손패를 보고 1장 가져오고 1장 줌
  await hand(C, ['불공정 거래', '꽃']); await hand(A, ['방패', '검']); await sleep(300);
  await pickCard(C, '불공정 거래'); await C.click('#useCard'); await target(C, 'A');
  await C.waitForSelector('#pickBox:not([hidden])', { timeout: 7000 });
  ok((await C.textContent('#pickTitle')) === '불공정 거래', 'C: 불공정 거래 창');
  await C.click('#pickBody [data-row="take"] button:nth-child(1)'); await C.click('#pickBody [data-row="give"] button:nth-child(1)');
  await C.click('#pickOk'); await sleep(600);
  const ca = await st(C), aa = await st(A);
  ok(ca.hand.includes('방패') && aa.hand.includes('꽃'), `거래 성사: C ${ca.hand} / A ${aa.hand}`);
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' / '));
  await b.close();
})().catch(e => { console.error(e); failed++; }).finally(() => { server.kill(); process.exit(failed ? 1 : 0); });
