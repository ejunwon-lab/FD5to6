// 전체 갱신·푸시·발송·환율·락·매매 기록 입력 시험 (2026-11-21 점검 반영). 실행: node scripts/gas-tests/test_update_and_send.js [-v]
const fs = require('fs'), path = require('path');
const { makeEnv, checker } = require('./harness');
const { check, done } = checker();
const FILES = ['NewSystem.js', 'MarketClose.js', 'Telegram.js', 'Main.js'];
const T = hm => '2026-11-23T' + hm + ':00+09:00';   // 월요일(거래일)

// 텔레그램 API 흉내: mode = 'ok' | 'md400'(서식 있으면 400, 없으면 200) | 'down'(500)
function tg(mode) {
  return (url, env) => {
    if (url.indexOf('/sendMessage') < 0) return { code: 404, body: '{}' };
    const body = JSON.parse(env.lastPayload || '{}');
    env.sent = (env.sent || []).concat([body]);
    if (mode === 'down') return { code: 500, body: '{"ok":false}' };
    if (mode === 'md400' && body.parse_mode) return { code: 400, body: '{"ok":false,"description":"can\'t parse entities"}' };
    return { code: 200, body: '{"ok":true}' };
  };
}
function env(opts) {
  opts = opts || {};
  const e = makeEnv({ now: opts.now || T('10:00'), sheets: opts.sheets || {}, files: FILES, fetch: tg(opts.tg || 'ok') });
  // 발송 본문을 흉내 서버가 볼 수 있게
  const realFetch = e.ctx.UrlFetchApp.fetch;
  e.ctx.UrlFetchApp.fetch = (u, o) => { e.lastPayload = o && o.payload; return realFetch(u, o); };
  e.ctx._tgToken = () => (opts.noToken ? null : 'TOKEN');
  e.ctx._tgChatIds = () => ['c1', 'c2'];
  e.calls = [];
  const stub = (name, fn) => { e.ctx[name] = (...a) => { e.calls.push(name); return fn ? fn(...a) : undefined; }; };
  stub('updateFxRates'); stub('updateNewPriceHistory', () => { if (e.failAt === '가격') throw new Error('토큰_발급 실패: [EGW00103]'); });
  stub('logToTrendSheet'); stub('buildDashboard'); stub('_writeDashboardStatus');
  e.ctx.updatePositionFromLedger = o => { e.calls.push('updatePositionFromLedger:' + JSON.stringify(o || null)); if (!(o && o.skipDashboard === true)) e.ctx.buildDashboard(); };
  e.ctx.newMobileGetPortfolio = () => JSON.stringify({ success: true, summary: { trendTotalProfit: 1, totalProfitRate: 1.5, dayChangAmount: 2, dayChangePct: '+0.10%', priceAsOfDate: '2026-11-23' } });
  e.ctx.mcTick = () => ({});
  return e;
}

// ── A. updateAllNew ──
let e = env();
check('A1 성공: true 반환', e.run('updateAllNew()'), true);
check('A1 단계 순서, 대시보드는 한 번, 보유현황에는 skipDashboard', e.calls,
  ['updateFxRates', 'updateNewPriceHistory', 'updatePositionFromLedger:{"skipDashboard":true}', 'logToTrendSheet', 'buildDashboard']);
check('A1 소요 시간 로그 한 줄', e.logs.filter(l => /^updateAllNew 소요: 환율 [\d.]+s · 가격 [\d.]+s · 보유현황 [\d.]+s · 추이 [\d.]+s · 대시보드 [\d.]+s · 합계 [\d.]+s$/.test(l)).length, 1);
e = env(); e.failAt = '가격';
check('A2 가격 단계 실패: false 반환, 뒤 단계는 안 돎, 대시보드 2행에 실패 기록', [e.run('updateAllNew()'), e.calls], [false, ['updateFxRates', 'updateNewPriceHistory', '_writeDashboardStatus']]);
check('A2 실패 사유 보관 + 로그에 단계 이름', [e.run('_lastUpdateError'), e.logs.some(l => /updateAllNew 오류: .*\[가격 단계 · 그 전까지 환율 /.test(l))], ['토큰_발급 실패: [EGW00103]', true]);
check('A2 다음 성공 뒤에는 사유가 지워짐', (e.failAt = null, [e.run('updateAllNew()'), e.run('_lastUpdateError')]), [true, '']);
const srcNS = fs.readFileSync(path.join(__dirname, '..', '..', 'apps-script-v2', 'NewSystem.js'), 'utf8');
check('A3 실제 updatePositionFromLedger 끝: 건너뛰기 조건이 있고, 조건 없는 대시보드 호출은 없음',
  [/if \(!\(opts && opts\.skipDashboard === true\)\) buildDashboard\(\);\n\}/.test(srcNS), /\n  buildDashboard\(\);\n\}/.test(srcNS)], [true, false]);

// ── B. tgPushPnL ──
e = env();
check('B1 정상: sent, 두 곳에 발송, 경고 줄 없음', [e.run('tgPushPnL()'), e.sent.length, e.sent.some(m => /갱신 실패/.test(m.text))], ['sent', 2, false]);
check('B1 18분 안의 다음 신호는 건너뜀', e.run('tgPushPnL()'), 'skip-dedup');
e = env(); e.failAt = '가격';
check('B2 갱신 실패: sent-stale', e.run('tgPushPnL()'), 'sent-stale');
check('B2 맨 위에 경고 줄, 사유의 서식 기호(_ [ ])는 빠짐', e.sent[0].text.split('\n').slice(0, 2), ['💼 *포트폴리오 손익*', '⚠️ *갱신 실패*: 아래 숫자는 직전 값 (토큰 발급 실패:  EGW00103 )']);
e = env({ tg: 'md400' });
check('B3 서식 해석 실패(400): 서식 없이 다시 보내 도착 → sent', [e.run('tgPushPnL()'), e.sent.map(m => !!m.parse_mode)], ['sent', [true, false, true, false]]);
e = env({ tg: 'down' });
check('B4 텔레그램 불통: error:send (보냈다고 기록하지 않음)', e.run('tgPushPnL()'), 'error:send');
e = env({ noToken: true });
check('B5 토큰 없음: error:send', e.run('tgPushPnL()'), 'error:send');
e = env({ now: T('17:00') }); check('B6 장외: 기존 그대로 skip-offhours', e.run('tgPushPnL()'), 'skip-offhours');
check('B7 _tgAnySent', [e.run('_tgAnySent(null)'), e.run('_tgAnySent("[]")'), e.run('_tgAnySent(\'[{"chatId":"a","status":500},{"chatId":"b","status":200}]\')'), e.run('_tgAnySent("깨진 글")')], [false, false, true, false]);

// ── C. 백업 발송: 갱신 실패 푸시도 '보냄'으로 보고 끊김 알림 ──
e = env({ now: T('10:26') }); e.failAt = '가격'; e.store.set('tg_lastPushEpoch', String(new Date(T('09:40')).getTime()));
check('C1 백업 발송 결과와 끊김 알림 1통', [e.run('tgChainFallback()'), e.sent.filter(m => /GitHub 푸시 신호가 끊겨/.test(m.text)).length], ['fallback:sent-stale', 2]);

// ── D. 애프터마켓 알림: 도착했을 때만 '보냄' ──
function amEnv(mode) {
  const rows = [['날짜', '000001'], ['2026-11-20 15:40:00', 1000], ['2026-11-23 15:40:00', 1010]];
  const pos = [['종목코드', '종목명', '분류', '증권사', '계좌', '보유기간', '보유수량'], ['000001', '가나전자', '국내주식', 'A', '종합', '', 3]];
  const x = makeEnv({ now: T('20:05'), sheets: { '*현재가_이력*': rows, '*보유현황*': pos }, files: FILES,
    fetch: (url, en) => /api\/stock\/000001\/basic/.test(url) ? { code: 200, body: '{"closePrice":"1,020"}' } : tg(en.tgMode)(url, en) });
  const rf = x.ctx.UrlFetchApp.fetch; x.ctx.UrlFetchApp.fetch = (u, o) => { x.lastPayload = o && o.payload; return rf(u, o); };
  x.ctx._tgToken = () => 'TOKEN'; x.ctx._tgChatIds = () => ['c1']; x.tgMode = mode;
  return x;
}
e = amEnv('down');
check('D1 발송 실패: send-fail, 날짜 표시를 지움(다음 신호에 재시도)', [e.run('mcAfterMarketAlert()'), e.store.has('am_alert_date')], ['send-fail', false]);
e.tgMode = 'ok';
check('D2 다음 신호: 발송 → sent, 그 뒤는 done', [e.run('mcAfterMarketAlert()'), e.store.get('am_alert_date'), e.run('mcAfterMarketAlert()')], ['sent', '2026-11-23', 'done']);
e = amEnv('md400');
check('D3 서식 해석 실패여도 글자로 도착 → sent', e.run('mcAfterMarketAlert()'), 'sent');

// ── E. 환율: 조회 실패 시 직전 값 유지 ──
function fxEnv(result) {
  const x = makeEnv({ now: T('10:00'), sheets: { '*설정*': [['항목', '값'], ['USD/KRW', 1385.5], ['GBP/KRW', 1811.2]] }, files: ['NewSystem.js'] });
  x.book.onFormula = f => result(f);
  return x;
}
e = fxEnv(f => /USDKRW/.test(f) ? '#N/A' : 1820.4);
e.run('updateFxRates(SpreadsheetApp.getActiveSpreadsheet())');
check('E1 달러 조회 실패: 직전 값 유지, 파운드는 새 값', [e.sheet('*설정*').d[1][1], e.sheet('*설정*').d[2][1], e.logs.some(l => /환율 조회 실패\(USD\) — 직전 값 유지/.test(l))], [1385.5, 1820.4, true]);
e = fxEnv(() => 'Loading...'); e.sheet('*설정*').d[1][1] = ''; e.sheet('*설정*').d[2][1] = 0;
e.run('updateFxRates(SpreadsheetApp.getActiveSpreadsheet())');
check('E2 직전 값도 없을 때만 고정값', [e.sheet('*설정*').d[1][1], e.sheet('*설정*').d[2][1]], [1400, 1700]);
e = fxEnv(f => /USDKRW/.test(f) ? 1390.1 : 1815.0); e.run('updateFxRates(SpreadsheetApp.getActiveSpreadsheet())');
check('E3 정상: 새 값, 실패 로그 없음', [e.sheet('*설정*').d[1][1], e.sheet('*설정*').d[2][1], e.logs.some(l => /환율 조회 실패/.test(l))], [1390.1, 1815, false]);

// ── F. 17:30 갱신의 락 ──
e = env({ now: T('17:30') }); e.ctx._cleanupLegacyEmailProps = () => { e.calls.push('cleanup'); return 0; };
e.run('scheduledDailyUpdate()');
check('F1 락을 잡고 갱신 → 풀고 → 정리', [e.calls.filter(c => /^update|cleanup/.test(c)).length > 2, e.calls[e.calls.length - 1], e.lockReleases], [true, 'cleanup', 1]);
e = env({ now: T('17:30') }); e.lockBusy = true; e.ctx._cleanupLegacyEmailProps = () => { e.calls.push('cleanup'); return 0; };
e.run('scheduledDailyUpdate()');
check('F2 다른 갱신 중: 갱신은 건너뛰고 정리만', [e.calls, e.logs.some(l => /scheduledDailyUpdate: 다른 갱신 처리 중/.test(l))], [['cleanup'], true]);

// ── G. 매매 기록 입력 검증 ──
function tradeEnv() {
  const ledger = [['날짜', '구분', '종목코드', '종목명', '분류', '증권사', '계좌', '수량', '단가', '금액', '수수료', '메모']];
  const pos = [['종목코드', '종목명', '분류', '증권사', '계좌', '보유기간', '보유수량']];
  const x = makeEnv({ now: T('10:00'), sheets: { '*거래_원장*': ledger, '*보유현황*': pos }, files: ['NewSystem.js'] });
  x.ctx.updatePositionFromLedger = () => {};
  return x;
}
const base = { type: '매수', code: '000001', name: '가나전자', category: '국내주식', broker: '삼성증권', account: 'ISA', qty: 3, price: 1000 };
const add = (x, over) => { x.ctx.__t = Object.assign({}, base, over); return x.run('_appendTradeRow(__t)'); };
e = tradeEnv();
check('G1 정상 매수: 기록', [add(e, {}).success, e.sheet('*거래_원장*').d.length], [true, 2]);
check('G2 수식 꼴 종목코드 거부', add(e, { code: '=IMPORTXML("http://x","//a")' }).error, 'bad_code');
check('G3 영숫자 6자리·영문 티커는 허용(대문자로 맞춤), 점이 든 꼴은 거부', [add(e, { code: '0005a0', name: '나다ETF', category: '국내ETF' }).success, add(e, { code: 'aapl', name: '사과', category: '해외주식' }).trade.code, add(e, { code: 'brk.b', name: '버크셔', category: '해외주식' }).error], [true, 'AAPL', 'bad_code']);
check('G4 틀린 날짜는 오늘로 바꾸지 않고 거부', [add(e, { date: '11월 23일쯤' }).error, e.sheet('*거래_원장*').d.length], ['bad_date', 4]);
check('G5 목록에 없는 분류 거부', add(e, { category: '=1+1', qty: 7 }).error, 'bad_category');
const r5 = add(e, { name: '=HYPERLINK("http://x")', memo: '+82 연락', orderNo: 'A1', code: '000002' });
const last = e.sheet('*거래_원장*').d[e.sheet('*거래_원장*').d.length - 1];
check('G6 수식으로 읽힐 이름·메모는 글자로(앞에 \')', [r5.success, last[3], last[11]], [true, '\'=HYPERLINK("http://x")', '주문번호:A1 / +82 연락']);
check('G7 입금 메모도 같은 처리', (add(e, { type: '입금', amount: 5, memo: '@메모' }), e.sheet('*거래_원장*').d.slice(-1)[0][11]), '\'@메모');
e.lockBusy = false;

// ── H. 큐 입구 삭제 ──
e = env(); e.ctx.handleTelegramWebhook = () => 'W';
check('H1 addMarketReport 요청은 기본 분기로(처리 함수 없음)', [e.run('doPost({ parameter: {}, postData: { contents: \'{"action":"addMarketReport","secret":"x","body":"=1+1"}\' } })'), typeof e.ctx._tgHandleMarketReportPost], ['W', 'undefined']);

done('갱신·발송 시험');
