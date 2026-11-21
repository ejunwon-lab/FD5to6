/**
 * CloseBackfill.js — 과거 마감 기록 소급 보정 (일회성, 2026-11-21)
 *
 * *현재가_이력*의 2026-09-14(거래소 애프터마켓 개설일) ~ 2026-11-12 거래일 행에서 국내 종목 칸을
 * 그날 **정규장 종가**로 고친다. 그 기간의 기록은 17:30 갱신 값이라 애프터마켓 진행가가 섞여 있다
 * (11/13 기록은 40칸 중 9칸이 정규장 종가와 달랐다). 11/13부터는 아침 대조·잠금으로 이미 정규장 종가다.
 * 설계: docs/plans/2026-11-21-과거종가-소급보정.md
 *
 *  출처 1) 네이버 일별 시세로 되찾은 정규장 종가 = 다음 거래일의 기준가(다음 날 종가 − 다음 날 전일 대비)
 *  출처 2) KIS 일봉 종가(원주가)
 *  쓰기 전에 두 출처를 "정규장 종가로 확인된 날"(11/13~)의 시트 값과 대조한다. 네이버 쪽이 맞지 않으면 아무것도 쓰지 않는다.
 *  KIS 쪽도 맞으면 두 출처가 같은 값일 때만 쓰고, 아니면 네이버 값만 쓰되 지금 값과 크게 다르면 건너뛴다.
 *  쓰기 전에 시트를 통째로 복사해 숨긴 백업 시트를 만든다.
 *
 * 진입점 cbfTick() — scheduledHourlyUpdate(30분 트리거) 앞머리에서 호출. 상태 속성이 생기면 다시 돌지 않는다.
 * 끝난 뒤에는 이 파일과 호출 한 줄을 지워도 된다.
 */

const CBF = {
  STATE_KEY: 'kr_close_backfill_v1',   // {state:'running'|'done'|'aborted'|'error', at, …} — 한 칸(상태)
  FROM: '2026-09-14',                  // 이 날부터
  VERIFIED_FROM: '2026-11-13',         // 이 날 앞까지 고친다. 이 날부터의 행은 정규장 종가로 확인된 값(검증 기준)
  MIN_VERIFY: 100,                     // 검증에 필요한 최소 대조 칸 수
  PASS: 0.98,                          // 검증 통과 일치율
  CODE_MIN_VERIFY: 3,                  // 종목별: 확인된 날이 이만큼은 있어야 그 종목을 고친다(전부 일치해야 함)
  MAX_GAP: 0.10,                       // 지금 값과 이보다 크게 다르면 건너뜀(기준가 조정·자료 이상 가능성)
  BACKUP_NAME: '*현재가_이력*_보정전_2026-11-21',
};

/** 네이버 일별 시세 → {code: {yyyy-MM-dd: 그날 정규장 종가}} (다음 거래일의 기준가로 되찾음). 못 받은 종목은 빈 객체. */
function _cbfNaverDerived(codes) {
  const rowsOf = {};
  const fetchPage = (list, page) => {
    for (let i = 0; i < list.length; i += 10) {
      const chunk = list.slice(i, i + 10);
      const data = _mcFetchJsonAll(chunk.map(c =>
        'https://m.stock.naver.com/api/stock/' + encodeURIComponent(c) + '/price?pageSize=60&page=' + page));
      data.forEach((arr, j) => {
        if (!Array.isArray(arr)) return;
        const m = rowsOf[chunk[j]] = rowsOf[chunk[j]] || {};
        arr.forEach(x => {
          const d = String((x && x.localTradedAt) || '').slice(0, 10);
          const close = _mcNum(x && x.closePrice);
          if (d.length === 10 && close > 0 && x.compareToPreviousClosePrice != null) {
            m[d] = { close: close, diff: _mcNum(x.compareToPreviousClosePrice) };
          }
        });
      });
      Utilities.sleep(150);
    }
  };
  fetchPage(codes, 1);
  // 첫 쪽(60거래일)이 시작일까지 닿지 않는 종목만 한 쪽 더
  const more = codes.filter(c => {
    const ds = Object.keys(rowsOf[c] || {});
    return ds.length >= 60 && ds.sort()[0] > CBF.FROM;
  });
  if (more.length) fetchPage(more, 2);
  const out = {};
  codes.forEach(c => {
    const m = rowsOf[c] || {}, ds = Object.keys(m).sort(), o = out[c] = {};
    for (let i = 0; i + 1 < ds.length; i++) {
      const next = m[ds[i + 1]];
      const base = Math.round(next.close - next.diff);   // 다음 거래일의 기준가 = 이 날의 정규장 종가
      if (base > 0) o[ds[i]] = base;
    }
  });
  return out;
}

/** KIS 기간별 시세(일봉, 원주가) → {code: {yyyy-MM-dd: 종가}}. 실패한 종목은 빠진다. */
function _cbfKisDailyCloses(codes, fromDate, toDate) {
  const token = KIS_API.getAccessToken();
  const f = fromDate.replace(/-/g, ''), t = toDate.replace(/-/g, '');
  const out = {};
  for (let i = 0; i < codes.length; i += 5) {
    const chunk = codes.slice(i, i + 5);
    const reqs = chunk.map(code => ({
      url: `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}&FID_INPUT_DATE_1=${f}&FID_INPUT_DATE_2=${t}&FID_PERIOD_DIV_CODE=D&FID_ORG_ADJ_PRC=1`,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "authorization": "Bearer " + token,
        "appkey": _kisKeys().key,
        "appsecret": _kisKeys().secret,
        "tr_id": "FHKST03010100"
      },
      method: 'get',
      muteHttpExceptions: true,
    }));
    let res = [];
    try { res = UrlFetchApp.fetchAll(reqs); } catch (e) { Logger.log('backfill: KIS 일봉 묶음 실패 — ' + e); }
    res.forEach((r, j) => {
      try {
        const data = JSON.parse(r.getContentText());
        if (data.rt_cd !== '0' || !Array.isArray(data.output2)) return;
        const m = out[chunk[j]] = {};
        data.output2.forEach(x => {
          const d = String((x && x.stck_bsop_date) || ''), c = parseInt(x && x.stck_clpr, 10);
          if (d.length === 8 && c > 0) m[d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8)] = c;
        });
      } catch (e) { /* 이 종목은 KIS 값 없음 */ }
    });
    Utilities.sleep(280);
  }
  return out;
}

/**
 * 보정 본체. opts.dry 이면 계산만 하고 쓰지 않는다.
 * @return {{state: string, reason?: string, verify?: string, kTrusted?: boolean, days?: number, cells?: number,
 *           changed?: number, same?: number, gap?: number, disagree?: number, nodata?: number, unverified?: number, backup?: boolean}}
 */
function cbfRun(opts) {
  opts = opts || {};
  const out = { state: 'aborted' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!sheet || sheet.getLastRow() < 3 || sheet.getLastColumn() < 2) { out.reason = 'no-sheet'; return out; }
  const lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  const codes = sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0].map(_normCode);
  const all = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();   // 행마다 [날짜, 종목별 값…]
  const dates = all.map(r => _mcDateStr(r[0]));
  const today = _mcNow().date;
  const domIdx = [];
  codes.forEach((c, i) => { if (_mcIsDomestic(c)) domIdx.push(i); });
  const domCodes = domIdx.map(i => codes[i]);
  if (!domCodes.length) { out.reason = 'no-domestic'; return out; }

  const nv = _cbfNaverDerived(domCodes);
  let kis = {};
  try { kis = _cbfKisDailyCloses(domCodes, CBF.FROM, today); } catch (e) { Logger.log('backfill: KIS 일봉 조회 실패 — ' + e); }

  // ── 검증: 정규장 종가로 확인된 날(VERIFIED_FROM ~ 어제)의 시트 값과 대조 ──
  let nCmp = 0, nOk = 0, kCmp = 0, kOk = 0;
  const codeCmp = {}, codeOk = {};
  dates.forEach((d, r) => {
    if (d < CBF.VERIFIED_FROM || d >= today || !_isTradingDateStr(d)) return;
    domIdx.forEach(i => {
      const code = codes[i], cur = Number(all[r][i + 1]) || 0;
      if (!(cur > 0)) return;
      const n = (nv[code] || {})[d], k = (kis[code] || {})[d];
      if (n > 0) {
        nCmp++; codeCmp[code] = (codeCmp[code] || 0) + 1;
        if (n === Math.round(cur)) { nOk++; codeOk[code] = (codeOk[code] || 0) + 1; }
      }
      if (k > 0) { kCmp++; if (k === Math.round(cur)) kOk++; }
    });
  });
  out.verify = 'naver ' + nOk + '/' + nCmp + ' · kis ' + kOk + '/' + kCmp;
  if (nCmp < CBF.MIN_VERIFY || nOk / nCmp < CBF.PASS) { out.reason = 'verify-failed'; return out; }
  const kTrusted = kCmp >= CBF.MIN_VERIFY && kOk / kCmp >= CBF.PASS;   // KIS 일봉 종가 = 정규장 종가로 볼 수 있나
  out.kTrusted = kTrusted;

  // ── 대상: FROM ~ VERIFIED_FROM 앞날의 거래일 행, 국내 종목 칸 ──
  const st = { days: 0, cells: 0, changed: 0, same: 0, gap: 0, disagree: 0, nodata: 0, unverified: 0 };
  const skipped = [];
  let firstR = -1, lastR = -1;
  dates.forEach((d, r) => {
    if (d < CBF.FROM || d >= CBF.VERIFIED_FROM || !_isTradingDateStr(d)) return;
    st.days++;
    domIdx.forEach(i => {
      const code = codes[i], cur = Number(all[r][i + 1]) || 0;
      if (!(cur > 0)) return;                                   // 빈 칸은 그대로
      st.cells++;
      if (!(codeCmp[code] >= CBF.CODE_MIN_VERIFY) || codeOk[code] !== codeCmp[code]) { st.unverified++; return; }
      const n = (nv[code] || {})[d];
      if (!(n > 0)) { st.nodata++; return; }
      if (n === Math.round(cur)) { st.same++; return; }
      if (Math.abs(n / cur - 1) > CBF.MAX_GAP) { st.gap++; skipped.push(d + ' ' + code + ' 차이큼'); return; }
      if (kTrusted && (kis[code] || {})[d] !== n) { st.disagree++; skipped.push(d + ' ' + code + ' 출처불일치'); return; }
      all[r][i + 1] = n;
      st.changed++;
      if (firstR < 0) firstR = r;
      lastR = r;
    });
  });
  Object.keys(st).forEach(k => { out[k] = st[k]; });
  if (skipped.length) Logger.log('backfill: 건너뜀 ' + skipped.length + '칸 — ' + skipped.slice(0, 30).join(', '));

  // ── 쓰기: 백업 시트(보정 전 사본)를 먼저 만들고, 바뀐 행이 든 구간을 한 번에 ──
  out.backup = false;
  if (st.changed > 0 && !opts.dry) {
    if (!ss.getSheetByName(CBF.BACKUP_NAME)) {
      const b = sheet.copyTo(ss);
      b.setName(CBF.BACKUP_NAME);
      b.hideSheet();
      out.backup = true;
    }
    sheet.getRange(firstR + 2, 2, lastR - firstR + 1, lastCol - 1)
      .setValues(all.slice(firstR, lastR + 1).map(row => row.slice(1)));
  }
  out.state = opts.dry ? 'dry' : 'done';
  return out;
}

function _cbfSummary(res) {
  if (!res) return '없음';
  if (res.state !== 'done' && res.state !== 'dry') {
    return res.state + (res.reason ? ' (' + res.reason + ')' : '') + (res.verify ? ' · 검증 ' + res.verify : '');
  }
  return res.state + ' · 검증 ' + res.verify + (res.kTrusted ? ' (두 출처 일치 때만 씀)' : ' (네이버 값만 씀)') +
    ' · 대상 ' + res.days + '일 ' + res.cells + '칸: 바꿈 ' + res.changed + ' · 같음 ' + res.same +
    ' · 차이 큼 ' + res.gap + ' · 출처 불일치 ' + res.disagree + ' · 자료 없음 ' + res.nodata + ' · 미검증 종목 칸 ' + res.unverified +
    (res.backup ? ' · 백업 시트 만듦' : '');
}

/**
 * 30분 트리거에서 호출 — 아직 안 돌았으면 한 번 실행한다.
 * @return {string} 'have'(이미 돎) | 'wait'(거래일 장중·저녁 — 미룸) | 'skip-lock' | 'done' | 'aborted' | 'error'
 */
function cbfTick() {
  const props = _mcProps();
  if (props.getProperty(CBF.STATE_KEY)) return 'have';
  const t = _mcNow();
  if (_mIsTradingDay() && t.mins >= 8 * 60 && t.mins < 20 * 60 + 30) return 'wait';   // 갱신·잠금·알림과 겹치지 않게
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return 'skip-lock';
  try {
    if (props.getProperty(CBF.STATE_KEY)) return 'have';
    const at = t.date + ' ' + t.hhmm;
    // 먼저 표시 — 실행이 중간에 죽어도 30분마다 되풀이하지 않는다
    props.setProperty(CBF.STATE_KEY, JSON.stringify({ state: 'running', at: at }));
    let res;
    try { res = cbfRun({}); } catch (e) { res = { state: 'error', reason: String((e && e.message) || e).slice(0, 150) }; }
    res.at = at;
    props.setProperty(CBF.STATE_KEY, JSON.stringify(res));
    Logger.log('backfill: ' + _cbfSummary(res));
    return res.state;
  } finally {
    lock.releaseLock();
  }
}
