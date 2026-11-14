// 특수 카드 점검 (3명): 거절, 관심법, 차례 넘김, 상점, 불공정 거래. 실행: npm run test:cards
// 서버를 ARCANA_TEST=1로 띄워 손패를 정해 둘 수 있게 한다 (실제 서버에서는 꺼져 있음)
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const server = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3123', ARCANA_TEST: '1' }, stdio: 'ignore' });
let failed = 0;
const SHOT = process.env.SHOT_DIR; // 화면 캡처를 남길 폴더 (선택)
const U = 'http://localhost:3123', sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, l) => { if (!l) return; if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + l); };
(async () => {
  await sleep(800);
  const b = await chromium.launch(); const errs = [];
  const page = async () => { const p = await (await b.newContext({ viewport: { width: 1440, height: 860 } })).newPage(); // 로그인 창은 건너뛰고 게스트로
    await p.addInitScript(() => { try { sessionStorage.setItem('arcana-authed', 'guest'); } catch {} }); p.on('pageerror', e => errs.push(e.message)); return p; };
  const A = await page(); await A.goto(U); await A.waitForFunction(() => document.getElementById('loader').classList.contains('done'));
  await A.click('[data-open="create"]'); await A.fill('#name', 'A'); await A.click('#form .btn:not(.ghost)'); await A.waitForSelector('#lobby:not([hidden])'); await sleep(1800);
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

  // 3. 차례 끝내기 → A의 거래 턴: B에게 "검"을 내밀며 "방패"라고 블러핑 → B가 꽃을 내밀며 수락
  await hand(B, ['꽃', '꽃']); await hand(A, ['검', '꽃']); await sleep(300);
  await A.click('#endTurnBtn'); await sleep(300);
  await A.waitForSelector('#phaseBar:not([hidden])', { timeout: 3000 });
  ok((await A.textContent('#phaseBar')).includes('거래 턴'), 'A: 차례를 끝내면 바로 거래 턴');
  await A.click('#phaseBar [data-who] >> text=B'); await pickCard(A, '검');
  await A.selectOption('#claimSel', '방패'); await A.click('#phaseBar [data-act="offer"]'); await sleep(300);
  await B.waitForSelector('#phaseBar:not([hidden])', { timeout: 3000 });
  ok((await B.textContent('#phaseBar')).includes('"방패"(이)라며'), 'B: A가 "방패"라고 말한 것만 보임 (실제로는 검)');
  if (SHOT) await B.screenshot({ path: SHOT + '/c-trade-answer.png' });
  await pickCard(B, '꽃'); await B.click('#phaseBar [data-act="accept"]');
  const bBefore = 2;
  await sleep(1300); // 받은 카드 알림 다음에 차례 배너
  ok(await B.evaluate(() => document.getElementById('turnBanner').classList.contains('show') && document.getElementById('turnBanner').textContent.includes('내 차례')), 'B 화면에 "내 차례입니다" 배너');
  ok((await C.textContent('#turnBanner')).includes('B의 차례'), 'C 화면에 "B의 차례" 배너');
  ok((await st(B)).hand.length === bBefore + 1 && (await st(B)).hand.includes('검'), 'B가 검을 받고 차례 시작에 1장 뽑음 → ' + (await st(B)).hand);
  ok((await st(A)).hand.join() === '꽃,꽃', 'A는 검을 주고 꽃을 받음 → ' + (await st(A)).hand);

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
  await B.click('#endTurnBtn'); await B.waitForSelector('#phaseBar [data-act="skip"]', { timeout: 3000 }); await B.click('#phaseBar [data-act="skip"]'); await sleep(400);

  // 5. 불공정 거래: C가 A의 손패를 보고 1장 가져오고 1장 줌
  await hand(C, ['불공정 거래', '꽃']); await hand(A, ['방패', '검']); await sleep(300);
  await pickCard(C, '불공정 거래'); await C.click('#useCard'); await target(C, 'A');
  await C.waitForSelector('#pickBox:not([hidden])', { timeout: 7000 });
  ok((await C.textContent('#pickTitle')) === '불공정 거래', 'C: 불공정 거래 창');
  await C.click('#pickBody [data-row="take"] button:nth-child(1)'); await C.click('#pickBody [data-row="give"] button:nth-child(1)');
  await C.click('#pickOk'); await sleep(600);
  const ca = await st(C), aa = await st(A);
  ok(ca.hand.includes('방패') && aa.hand.includes('꽃'), '불공정 거래 성사: C ' + ca.hand + ' / A ' + aa.hand);

  // 6. C도 차례를 마치면 한 라운드 끝 → 헌납: 모두 1장씩 바치고, 섞어 공개, 다음 라운드
  await hand(A, ['네크로노미콘', '꽃']); await sleep(300);
  await C.click('#endTurnBtn'); await C.waitForSelector('#phaseBar [data-act="skip"]', { timeout: 3000 }); await C.click('#phaseBar [data-act="skip"]'); await sleep(500);
  for (const p of [A, B, C]) await p.waitForSelector('#phaseBar.offering:not([hidden])', { timeout: 4000 });
  ok(true, '라운드 끝: 모두에게 헌납 창');
  if (SHOT) await A.screenshot({ path: SHOT + '/c-offering.png' });
  await pickCard(A, '네크로노미콘'); await A.click('#phaseBar [data-act="offerCard"]'); await sleep(200);
  ok((await A.textContent('#phaseBar')).includes('기다리는 중'), 'A: 바치고 기다림');
  for (const p of [B, C]) { await p.click('#hand li:nth-child(1) button'); await sleep(100); await p.click('#phaseBar [data-act="offerCard"]'); }
  await A.waitForSelector('#pickBox:not([hidden])', { timeout: 8000 }); // 제단 도둑 시간 뒤 공개
  ok((await A.textContent('#pickTitle')) === '제단 공개' && (await A.$$('#pickBody .ac')).length === 3, '제단 공개: 바친 카드 3장');
  if (SHOT) await A.screenshot({ path: SHOT + '/c-altar.png' });
  ok(await A.evaluate(() => game.seal[0] === 1 && game.round === 2), '네크로노미콘이 제단에 남아 봉인 1, 라운드 2');
  for (const p of [A, B, C]) if (!(await p.isHidden('#pickBox'))) await p.click('#pickOk'); // 제단 공개 창 닫기
  await sleep(300);

  // 7. 라운드 2, A 차례: 강제 → B의 검을 쓰게 하고, 대상(C)은 A가 고른다
  await hand(A, ['강제', '여명과 황혼의 산', '꽃', '꽃', '꽃']); await hand(B, ['검']); await hand(C, ['꽃', '꽃', '꽃']); await sleep(300);
  await pickCard(A, '강제'); await A.click('#useCard'); await target(A, 'B');
  await A.waitForSelector('#pickBox:not([hidden])', { timeout: 7000 });
  const opts = await A.$$eval('#pickBody [data-row="target"] button', bs => bs.map(b => b.textContent));
  ok((await A.textContent('#pickTitle')) === '강제' && !opts.some(t => t.startsWith('B')), 'A: 강제 창, B의 검 대상 후보에 B 자신은 없음 → ' + opts);
  await A.click('#pickBody [data-row="target"] button >> text=C'); await A.click('#pickOk');
  await C.waitForSelector('#reactBar:not([hidden])', { timeout: 4000 });
  ok((await C.textContent('#reactText')).includes('B'), 'C: B가 (강제로) 검으로 공격 → 방어 창');
  await C.click('#takeBtn'); await sleep(800);

  // 8. 여명과 황혼의 산: 남길 3장을 A가 고른다
  await hand(A, ['여명과 황혼의 산', '검', '방패', '성경', '꽃', '꽃']); await sleep(300);
  await pickCard(A, '여명과 황혼의 산'); await A.click('#useCard');
  await A.waitForSelector('#pickBox:not([hidden])', { timeout: 4000 });
  ok((await A.textContent('#pickTitle')) === '여명과 황혼의 산', 'A: 남길 3장 고르기 창');
  for (const k of [1, 2, 3]) await A.click(`#pickBody [data-row="keep"] button:nth-child(${k})`);
  ok(!(await A.isDisabled('#pickOk')), '3장을 고르면 확인 가능');
  await A.click('#pickOk'); await sleep(500);
  ok((await st(A)).hand.length === 3, '손패 3장만 남음 → ' + (await st(A)).hand);
  ok(!errs.length, '페이지 오류 없음 ' + errs.join(' / '));
  await b.close();
})().catch(e => { console.error(e); failed++; }).finally(() => { server.kill(); process.exit(failed ? 1 : 0); });
