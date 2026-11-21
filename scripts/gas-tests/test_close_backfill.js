// CloseBackfill.js 시험 — 과거 마감 기록 소급 보정. 실행: node scripts/gas-tests/test_close_backfill.js [-v]
const { makeEnv, checker } = require('./harness');
const { check, done } = checker();
const PH = '*현재가_이력*';
const CODES = ['000001', '000002', '0000A3', 'AAPL'];        // 국내주식 2 · 국내 ETF(영숫자 코드) 1 · 해외 1 (전부 가짜)
const BASE = { '000001': 50000, '000002': 120000, '0000A3': 10000, AAPL: 300000 };

// 거래일 달력(평일) 2026-09-08 ~ 2026-11-23
const DAYS = [];
for (let t = Date.UTC(2026, 8, 8); t <= Date.UTC(2026, 10, 23); t += 86400e3) {
  const d = new Date(t); if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) DAYS.push(d.toISOString().slice(0, 10));
}
const idx = d => DAYS.indexOf(d);
const reg = (c, d) => BASE[c] + idx(d) * (c === '0000A3' ? 5 : 100);                    // 그날 정규장 종가
const drift = (c, d) => (c === '0000A3' ? 0 : [-300, 0, 200][idx(d) % 3]);              // 애프터마켓에서 움직인 폭 (ETF는 0)
const am = (c, d) => reg(c, d) + drift(c, d);                                            // 그날 애프터마켓 종료가(네이버 일별 종가)
const rec = (c, d) => reg(c, d) + (idx(d) % 2 === 0 ? drift(c, d) : 0);                  // 17:30에 적힌 값: 이틀에 한 번 애프터마켓 가격
const fmt = n => Math.round(n).toLocaleString('en-US');
const FROM = '2026-09-14', VER = '2026-11-13', LAST = '2026-11-20';

function buildSheet(mut) {
  const rows = [['날짜'].concat(CODES)];
  DAYS.filter(d => d <= LAST).forEach(d => {
    let vals;
    if (d < FROM) vals = CODES.map(c => reg(c, d) + 7);                                  // 대상 앞: 일부러 다른 값(건드리면 안 됨)
    else if (d < VER) vals = CODES.map(c => c === 'AAPL' ? 300000 + idx(d) : rec(c, d));
    else vals = CODES.map(c => c === 'AAPL' ? 300000 + idx(d) : reg(c, d));              // 확인된 날: 정규장 종가
    rows.push([d + ' 17:30:05'].concat(vals));
    if (d === '2026-09-18') rows.push(['2026-09-19 10:00:00', 1, 2, 3, 4]);              // 토요일 행(있으면 안 되지만 있어도 건드리지 않아야 함)
  });
  if (mut) mut(rows);
  return rows;
}
const rowOf = (rows, d) => rows.find(r => String(r[0]).slice(0, 10) === d);

function fetcher(mode) {   // mode = {naver: 'ok'|'down'|'flat', kis: 'reg'|'am'|'down', corp: [code, date]}
  return (url, env) => {
    let m;
    if ((m = url.match(/api\/stock\/([^/]+)\/price\?pageSize=60&page=(\d)/))) {
      const code = decodeURIComponent(m[1]);
      if (mode.naver === 'down' || !(code in BASE) || m[2] !== '1') return { code: mode.naver === 'down' ? 503 : 200, body: '[]' };
      const list = DAYS.filter(d => d <= LAST).slice(-60).reverse().map(d => {
        const prev = DAYS[idx(d) - 1];
        let base = reg(code, prev);
        if (mode.corp && mode.corp[0] === code && mode.corp[1] === prev) base = Math.round(base * 0.96);   // 기준가 조정(권리락 등)
        if (mode.naver === 'flat') base = am(code, d);                                                     // 전일 대비가 늘 0인 엉터리 자료
        return { localTradedAt: d + 'T16:10:00+09:00', closePrice: fmt(am(code, d)), compareToPreviousClosePrice: fmt(am(code, d) - base) };
      });
      return { code: 200, body: JSON.stringify(list) };
    }
    if ((m = url.match(/inquire-daily-itemchartprice.*FID_INPUT_ISCD=([^&]+)&FID_INPUT_DATE_1=(\d{8})&FID_INPUT_DATE_2=(\d{8}).*FID_ORG_ADJ_PRC=1/))) {
      if (mode.kis === 'down') return { code: 200, body: JSON.stringify({ rt_cd: '1', msg1: '초당 거래건수 초과' }) };
      const code = m[1], f = m[2], t = m[3];
      const out2 = DAYS.filter(d => d.replace(/-/g, '') >= f && d.replace(/-/g, '') <= t && d <= LAST).reverse()
        .map(d => ({ stck_bsop_date: d.replace(/-/g, ''), stck_clpr: String(mode.kis === 'am' ? am(code, d) : reg(code, d)) }));
      return { code: 200, body: JSON.stringify({ rt_cd: '0', output2: out2 }) };
    }
    return { code: 404, body: '{}' };
  };
}
function env(mode, mut, now) {
  const e = makeEnv({ now: now || '2026-11-21T14:56:00+09:00', sheets: { [PH]: buildSheet(mut) }, files: ['NewSystem.js', 'MarketClose.js', 'CloseBackfill.js'],
    fetch: fetcher(Object.assign({ naver: 'ok', kis: 'reg' }, mode || {})) });
  e.run('CBF.MIN_VERIFY = 10');   // 시험 자료는 국내 3종목 × 5일 = 15칸 (운영 기본값 100은 따로 시험)
  return e;
}
// 기대값을 시험 쪽에서 따로 센다
const TARGET = DAYS.filter(d => d >= FROM && d < VER);
const DOM = ['000001', '000002', '0000A3'];
const expectChanged = TARGET.reduce((n, d) => n + DOM.filter(c => rec(c, d) !== reg(c, d)).length, 0);
const expectCells = TARGET.length * DOM.length;

// ── 1. 정상: 두 출처가 모두 정규장 종가 ──
let e = env();
const before = JSON.parse(JSON.stringify(e.sheet(PH).d));
let r = e.run('cbfRun({})');
check('1 결과 상태·검증', [r.state, r.verify, r.kTrusted], ['done', 'naver 15/15 · kis 18/18', true]);
check('1 대상 일수·칸 수', [r.days, r.cells], [TARGET.length, expectCells]);
check('1 바꾼 칸 = 17:30 값이 정규장 종가와 달랐던 칸', [r.changed, r.same, r.gap, r.disagree, r.nodata, r.unverified], [expectChanged, expectCells - expectChanged, 0, 0, 0, 0]);
const now1 = e.sheet(PH).d;
check('1 대상 구간의 국내 칸이 전부 정규장 종가', TARGET.every(d => DOM.every((c, i) => rowOf(now1, d)[i + 1] === reg(c, d))), true);
check('1 해외 칸·날짜 칸은 그대로', TARGET.every(d => rowOf(now1, d)[4] === rowOf(before, d)[4] && rowOf(now1, d)[0] === rowOf(before, d)[0]), true);
check('1 대상 앞(9/14 이전)·토요일 행·확인된 날은 그대로',
  ['2026-09-10', '2026-09-11', '2026-09-19', '2026-11-13', '2026-11-19', '2026-11-20'].every(d => JSON.stringify(rowOf(now1, d)) === JSON.stringify(rowOf(before, d))), true);
check('1 줄 수·머리줄 그대로', [now1.length, now1[0]], [before.length, before[0]]);
const bk = e.sheet('*현재가_이력*_보정전_2026-11-21');
check('1 백업 시트: 보정 전 값 그대로 + 숨김', [!!bk, bk && JSON.stringify(bk.d) === JSON.stringify(before), bk && bk.hidden, r.backup], [true, true, true, true]);
check('1 시트 쓰기는 한 번', e.sheet(PH).writes, 1);
check('1 요청 수: 네이버 3 + KIS 3', [e.fetches.filter(u => /naver/.test(u)).length, e.fetches.filter(u => /kis\.example/.test(u)).length], [3, 3]);

// ── 2. 다시 실행: 바꿀 것 없음, 백업을 새로 만들지 않음 ──
r = e.run('cbfRun({})');
check('2 다시 돌리면 바꿈 0·쓰기 없음·백업 그대로', [r.state, r.changed, r.backup, e.sheet(PH).writes, JSON.stringify(bk.d) === JSON.stringify(before)], ['done', 0, false, 1, true]);

// ── 3. KIS 일봉 종가가 애프터마켓 포함값인 경우: 네이버 값만 씀 ──
e = env({ kis: 'am' });
r = e.run('cbfRun({})');
check('3 KIS는 못 믿는 출처로 판정', [r.state, r.kTrusted, /^naver 15\/15 · kis \d+\/18$/.test(r.verify)], ['done', false, true]);
check('3 그래도 같은 결과(네이버 값으로)', [r.changed, TARGET.every(d => DOM.every((c, i) => rowOf(e.sheet(PH).d, d)[i + 1] === reg(c, d)))], [expectChanged, true]);

// ── 4. 차이가 10% 넘는 칸은 건너뜀 (두 경우 모두) ──
const big = rows => { rowOf(rows, '2026-10-06')[1] = Math.round(reg('000001', '2026-10-06') * 1.2); };
e = env({ kis: 'am' }, big); r = e.run('cbfRun({})');
check('4a 네이버만 쓸 때: 차이 큰 칸 1개 건너뜀·값 그대로', [r.gap, rowOf(e.sheet(PH).d, '2026-10-06')[1]], [1, Math.round(reg('000001', '2026-10-06') * 1.2)]);
check('4a 건너뛴 칸을 로그에 남김', e.logs.some(l => /backfill: 건너뜀 1칸 — 2026-10-06 000001 차이큼/.test(l)), true);
e = env({}, big); r = e.run('cbfRun({})');
check('4b 두 출처일 때도 같음', [r.gap, r.disagree], [1, 0]);

// ── 5. 기준가가 조정된 날(권리락 등): 두 출처 불일치로 건너뜀 ──
const cd = '2026-10-13';   // 이 날의 다음 거래일 기준가가 4% 낮게 조정됨
e = env({ corp: ['000002', cd] }); r = e.run('cbfRun({})');
check('5 KIS를 믿을 수 있으면 불일치 칸은 쓰지 않음', [r.disagree, rowOf(e.sheet(PH).d, cd)[2]], [1, rec('000002', cd)]);
check('5 나머지 칸은 정상 보정', r.changed, expectChanged - (rec('000002', cd) !== reg('000002', cd) ? 1 : 0));

// ── 6. 검증 실패 → 아무것도 쓰지 않음 ──
e = env({ naver: 'down' }); r = e.run('cbfRun({})');
check('6a 네이버 불통: 중단·무변경·백업 없음', [r.state, r.reason, r.verify, e.sheet(PH).writes || 0, !!e.sheet('*현재가_이력*_보정전_2026-11-21')], ['aborted', 'verify-failed', 'naver 0/0 · kis 18/18', 0, false]);
e = env({ naver: 'flat' }); r = e.run('cbfRun({})');
check('6b 네이버 자료가 엉터리(되찾은 값 ≠ 확인된 값): 중단·무변경', [r.state, r.reason, e.sheet(PH).writes || 0], ['aborted', 'verify-failed', 0]);
e = env(); e.run('CBF.MIN_VERIFY = 100'); r = e.run('cbfRun({})');
check('6c 운영 기본값(100칸)에 못 미치면 중단', [r.state, r.reason, e.sheet(PH).writes || 0], ['aborted', 'verify-failed', 0]);

// ── 7. 확인된 날에 어긋난 종목은 그 종목만 통째로 제외 ──
e = env({}, rows => { rowOf(rows, '2026-11-17')[2] += 50; });   // 000002 의 확인된 날 값 하나가 다름(잠금 제외 칸 등)
e.run('CBF.PASS = 0.9');                                         // 전체 관문은 통과시키고 종목별 관문을 본다
r = e.run('cbfRun({})');
const c2 = TARGET.filter(d => rec('000002', d) !== reg('000002', d)).length;
check('7 그 종목 칸은 전부 미검증으로 남기고 다른 종목만 보정', [r.state, r.unverified, r.changed, TARGET.every(d => rowOf(e.sheet(PH).d, d)[2] === rec('000002', d))], ['done', TARGET.length, expectChanged - c2, true]);

// ── 8. 빈 칸은 그대로, KIS 실패·토큰 실패여도 진행 ──
e = env({ kis: 'down' }, rows => { rowOf(rows, '2026-09-21')[2] = ''; rowOf(rows, '2026-09-22')[2] = ''; }); r = e.run('cbfRun({})');
check('8a 빈 칸은 채우지 않음, KIS 전부 실패 → 네이버만', [r.state, r.kTrusted, rowOf(e.sheet(PH).d, '2026-09-21')[2], rowOf(e.sheet(PH).d, '2026-09-22')[2], r.cells], ['done', false, '', '', expectCells - 2]);
e = env(); e.tokenThrow = true; r = e.run('cbfRun({})');
check('8b KIS 토큰 실패 → 네이버만으로 진행', [r.state, r.kTrusted, r.changed], ['done', false, expectChanged]);

// ── 9. 계산만(dry) ──
e = env(); r = e.run('cbfRun({ dry: true })');
check('9 dry: 세기만 하고 쓰지 않음', [r.state, r.changed, e.sheet(PH).writes || 0, !!e.sheet('*현재가_이력*_보정전_2026-11-21')], ['dry', expectChanged, 0, false]);

// ── 10. cbfTick: 한 번만, 장중에는 미룸, 락·오류 처리 ──
e = env();
check('10a 주말 틱: 실행 → done', e.run('cbfTick()'), 'done');
check('10a 상태 속성·로그 한 줄', [e.prop('kr_close_backfill_v1').state, e.prop('kr_close_backfill_v1').changed, e.prop('kr_close_backfill_v1').at, e.logs.filter(l => /^backfill: done · 검증 naver 15\/15/.test(l)).length], ['done', expectChanged, '2026-11-21 14:56', 1]);
const nf = e.fetches.length;
check('10a 다음 틱: 이미 돎 → 조회 없음', [e.run('cbfTick()'), e.fetches.length - nf], ['have', 0]);
e = env({}, null, '2026-11-23T10:26:00+09:00');
check('10b 거래일 장중: 미룸(조회·속성 없음)', [e.run('cbfTick()'), e.fetches.length, e.store.has('kr_close_backfill_v1')], ['wait', 0, false]);
e = env({}, null, '2026-11-23T20:56:00+09:00');
check('10c 거래일 20:30 이후: 실행', e.run('cbfTick()'), 'done');
e = env(); e.lockBusy = true;
check('10d 다른 갱신 중: 건너뛰고 다음 틱에 다시(속성 없음)', [e.run('cbfTick()'), e.store.has('kr_close_backfill_v1')], ['skip-lock', false]);
e = env({ naver: 'down' });
check('10e 검증 실패: aborted 로 기록하고 되풀이하지 않음', [e.run('cbfTick()'), e.prop('kr_close_backfill_v1').reason, e.run('cbfTick()')], ['aborted', 'verify-failed', 'have']);
e = env(); e.run('cbfRun = function () { throw new Error("시트 서비스 오류"); }');
check('10f 실행 중 예외: error 로 기록, 밖으로 던지지 않음', [e.run('cbfTick()'), e.prop('kr_close_backfill_v1').state, e.prop('kr_close_backfill_v1').reason], ['error', 'error', '시트 서비스 오류']);
check('10g 진단용 요약 글', e.run('_cbfSummary(null)'), '없음');

done('소급 보정 시험');
