/**
 * MarketClose.js — 정규장 종가 마감 기록 잠금 · 마감 시장 숫자 · 애프터마켓 알림 (2026-11-14)
 *
 * 배경: 2026-09-14 거래소 애프터마켓(16:00~20:00) 개설. 다음 거래일 기준가는 정규장 종가(15:30)라
 *   하루 마감 기록과 마감 리포트는 정규장 종가를 써야 한다.
 *   설계: docs/plans/2026-11-14-정규장종가-마감기록-애프터마켓알림.md
 *
 *  1) 잠금  — 정규장 마감 +5~29분(평소 15:35~15:59)의 갱신 값을 그날 국내 종목 종가로 잠근다.
 *             잠긴 뒤에는 updateNewPriceHistory가 그날 행의 국내 종목 칸을 덮어쓰지 않는다.
 *             창을 놓치면 네이버 분봉의 정규장 마감 값으로 채운다.
 *  2) 시장  — 같은 시간대에 업종 등락·급등락 순위·지수를 받아 속성 한 칸에 둔다 (마감 리포트가 17:05에 사용).
 *  3) 알림  — 애프터마켓 종료(20:00) 뒤 보유 원화 종목 전부의 변화율(정규장 종가 대비)을 하루 1통 보낸다.
 *  4) 대조  — 다음 거래일 장중 첫 갱신에서 "어제 기록 = 오늘 기준가"를 확인한다.
 *
 * 진입점 mcTick() — 5분 신호(_tgHandlePushPost)와 30분 시계(scheduledHourlyUpdate)가 부른다. 단계마다 자체 try/catch.
 */

const MC = {
  CLOSE_MIN: 15 * 60 + 30,          // 정규장 마감 15:30
  LOCK_FROM: 5,                     // 마감 +5분부터 잠금 창 (종가 단일가 체결·시세 반영 여유)
  LOCK_TO: 29,                      // 마감 +29분까지 (+30분에 애프터마켓 시작)
  // 정규장 마감이 늦는 날(분). 수능일은 10:00~16:30, 애프터마켓 17:00 시작. 해마다 거래소 공지 뒤 추가.
  SHIFT_MIN: { '2026-11-19': 60 },
  FALLBACK_TRIES: 3,                // 창을 놓친 뒤 네이버 분봉 보충용 전체 갱신 — 하루 최대 횟수
  FIX_MAX_GAP: 0.15,                // 아침 대조에서 기준가로 고치는 최대 차이(15%) — 넘으면 개수만 기록
  MARKET_UNTIL: 18 * 60 + 30,       // 시장 숫자 수집을 시도하는 마지막 시각
  AM_ALERT_FROM: 20 * 60 + 3,       // 애프터마켓 종료(20:00) 뒤 알림 시도 시작
  AM_ALERT_TO: 21 * 60,
  HELD_CATS: ['국내주식', '국내ETF'],
  PROP_LOCK: 'kr_close_lock',       // {date, at, via:'kis'|'naver'|'kis+naver', skip:[code]} — 상태(한 칸 덮어쓰기)
  PROP_TRY: 'kr_close_try',         // {date, n}
  PROP_CHECK: 'kr_close_check',     // {date, prevDate, total, match, fixed, prevLocked}
  PROP_MARKET: 'kr_market_close',   // {date, at, late, index, sectors, up, down}
  PROP_AM_ALERT: 'am_alert_date',   // yyyy-MM-dd
  UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ── 시각·상태 도우미 ─────────────────────────────────────────

function _mcNow() {
  const now = new Date(), tz = 'Asia/Seoul';
  return {
    date: Utilities.formatDate(now, tz, 'yyyy-MM-dd'),
    mins: Number(Utilities.formatDate(now, tz, 'H')) * 60 + Number(Utilities.formatDate(now, tz, 'm')),
    hhmm: Utilities.formatDate(now, tz, 'HH:mm'),
  };
}
function _mcCloseMin(dateStr) { return MC.CLOSE_MIN + (MC.SHIFT_MIN[dateStr] || 0); }
function _mcHHMM(mins) { return ('0' + Math.floor(mins / 60)).slice(-2) + ('0' + (mins % 60)).slice(-2); }
function _mcIsDomestic(code) { return !!code && !/^[A-Z]+$/.test(String(code)); }   // _fetchPricesFromKIS와 같은 구분
function _mcProps() { return PropertiesService.getScriptProperties(); }
function _mcReadJson(key) {
  try { const raw = _mcProps().getProperty(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function _mcLockOf(dateStr) { const l = _mcReadJson(MC.PROP_LOCK); return (l && l.date === dateStr) ? l : null; }
function _mcNum(s) { const n = Number(String(s == null ? '' : s).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function _mcDateStr(raw) {
  return raw instanceof Date ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd') : String(raw).slice(0, 10);
}
/** dateStr 바로 앞 거래일 (주말·휴장일 건너뜀). 2주 안에 없으면 null. */
function _mcPrevTradingDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00+09:00');
  for (let i = 0; i < 14; i++) {
    d.setDate(d.getDate() - 1);
    const s = Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
    if (_isTradingDateStr(s)) return s;
  }
  return null;
}

// ── 네이버 공개 API ─────────────────────────────────────────

/** 여러 주소를 한 번에 받아 JSON으로 — 실패한 칸은 null. */
function _mcFetchJsonAll(urls) {
  if (!urls.length) return [];
  let res;
  try {
    res = UrlFetchApp.fetchAll(urls.map(u => ({ url: u, muteHttpExceptions: true, headers: { 'User-Agent': MC.UA } })));
  } catch (e) {
    Logger.log('네이버 fetchAll 실패: ' + e);
    return urls.map(() => null);
  }
  return res.map(r => {
    try { return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null; } catch (e) { return null; }
  });
}

/**
 * 분봉에서 정규장 마감 값(마감 시각까지의 마지막 체결가)을 읽는다 — 실행 시각과 무관하게 정규장 종가.
 * @return {{closes: Object<string, number>, failed: string[]}} failed = 응답 자체를 못 받은 종목 (체결 없음과 구분)
 */
function _mcNaverRegularCloses(codes, dateStr) {
  const out = { closes: {}, failed: [] };
  if (!codes.length) return out;
  const ymd = dateStr.replace(/-/g, ''), c = _mcCloseMin(dateStr);
  const from = ymd + _mcHHMM(c - 120), to = ymd + _mcHHMM(c + 9), cut = to + '59';
  const data = _mcFetchJsonAll(codes.map(code =>
    'https://api.stock.naver.com/chart/domestic/item/' + encodeURIComponent(code) + '/minute?startDateTime=' + from + '&endDateTime=' + to));
  data.forEach((bars, i) => {
    if (!Array.isArray(bars)) { out.failed.push(codes[i]); return; }
    let lastAt = '', last = 0;
    bars.forEach(b => {
      const at = String((b && b.localDateTime) || ''), p = Number(b && b.currentPrice) || 0;
      if (p > 0 && at <= cut && at >= lastAt) { lastAt = at; last = p; }
    });
    if (last > 0) out.closes[codes[i]] = last;
  });
  return out;
}

/** /basic 의 표시가 — {code: price}. 20:00 이후에는 애프터마켓 종료가 (errors.md 2026-11-14). */
function _mcNaverBasicPrices(codes) {
  const out = {};
  const data = _mcFetchJsonAll(codes.map(code => 'https://m.stock.naver.com/api/stock/' + encodeURIComponent(code) + '/basic'));
  data.forEach((d, i) => { const p = d ? _mcNum(d.closePrice) : 0; if (p > 0) out[codes[i]] = p; });
  return out;
}

/** 업종 등락·급등락 순위·지수 — 못 받으면 null (다음 신호에서 재시도). */
function _mcFetchMarket() {
  const B = 'https://m.stock.naver.com/api/';
  const r = _mcFetchJsonAll([
    B + 'stocks/industry?page=1&pageSize=100',
    B + 'stocks/up?page=1&pageSize=10',
    B + 'stocks/down?page=1&pageSize=10',
    B + 'index/KOSPI/basic', B + 'index/KOSPI/integration',
    B + 'index/KOSDAQ/basic', B + 'index/KOSDAQ/integration',
  ]);
  const groups = (r[0] && r[0].groups) || [];
  if (!groups.length || !r[3]) return null;
  const movers = d => ((d && d.stocks) || []).slice(0, 10)
    .map(s => [String(s.stockName), String(s.itemCode), _mcNum(s.fluctuationsRatio)]);
  const index = (basic, integ) => {
    if (!basic) return null;
    const val = ((integ && integ.totalInfos) || []).filter(x => x.code === 'accumulatedTradingValue')[0];
    return {
      close: _mcNum(basic.closePrice), change: _mcNum(basic.compareToPreviousClosePrice),
      pct: _mcNum(basic.fluctuationsRatio), value: val ? String(val.value) : null,
    };
  };
  return {
    index: { KOSPI: index(r[3], r[4]), KOSDAQ: index(r[5], r[6]) },
    sectors: groups.map(g => [String(g.name), _mcNum(g.changeRate)]).sort((a, b) => b[1] - a[1]),
    up: movers(r[1]),
    down: movers(r[2]),
  };
}

// ── 1) 마감 기록 잠금 ───────────────────────────────────────

/**
 * updateNewPriceHistory가 오늘 행에 쓸 값을 정한다 — 정규장 마감 뒤에는 국내 종목 칸을 정규장 종가로 고정.
 * @param {string[]} codes    *현재가_이력* 헤더의 종목코드 (열 순서)
 * @param {Array} freshRow    KIS 조회 + 직전가 대체까지 끝난 새 값 (열 순서)
 * @param {Array} todayRow    오늘 행에 이미 있는 값 (없으면 [])
 * @param {string[]} carried  이번 조회가 실패해 직전가로 대체된 코드
 * @return {{row: Array, note: string}}
 */
function mcApplyCloseLock(codes, freshRow, todayRow, carried) {
  const t = _mcNow();
  const closeMin = _mcCloseMin(t.date);
  if (t.mins < closeMin + MC.LOCK_FROM) return { row: freshRow, note: 'pre-close' };
  const isDom = codes.map(_mcIsDomestic);

  // 이미 잠긴 날 — 국내 종목 칸은 오늘 행의 값을 유지 (잠금에서 제외된 칸·비어 있던 칸만 새 값)
  const lock = _mcLockOf(t.date);
  if (lock) {
    const skip = lock.skip || [];
    return {
      row: freshRow.map((v, i) => (isDom[i] && skip.indexOf(codes[i]) < 0 && Number(todayRow[i]) > 0) ? todayRow[i] : v),
      note: 'locked-keep',
    };
  }

  const domCodes = codes.filter(_mcIsDomestic);
  if (domCodes.length === 0) return { row: freshRow, note: 'no-domestic' };
  const carriedSet = {};
  (carried || []).forEach(c => { carriedSet[c] = true; });
  const inWindow = t.mins <= closeMin + MC.LOCK_TO;
  // 창 안: KIS 새 값이 곧 정규장 종가 — 조회에 실패한 종목만 네이버 분봉으로 보충.
  // 창을 놓침: 애프터마켓 시작 뒤의 KIS 값은 정규장 종가가 아닐 수 있어 국내 종목 전부를 네이버 분봉 값으로.
  const need = inWindow ? domCodes.filter(c => carriedSet[c]) : domCodes;
  const nv = need.length ? _mcNaverRegularCloses(need, t.date) : { closes: {}, failed: [] };
  const skip = [];
  let fromKis = 0, fromNaver = 0;
  const row = freshRow.map((v, i) => {
    const code = codes[i];
    if (!isDom[i]) return v;
    if (inWindow && !carriedSet[code]) { fromKis++; return v; }
    if (nv.closes[code] > 0) { fromNaver++; return nv.closes[code]; }
    if (carriedSet[code]) skip.push(code);   // KIS도 네이버도 값이 없는 칸(상장폐지 등) — 잠금에서 제외
    return v;
  });
  // 창을 놓쳤는데 네이버 응답 자체가 실패한 종목이 있으면 잠그지 않는다 (정규장 종가가 아닌 값이 굳는 것 방지)
  const incomplete = !inWindow && nv.failed.some(c => !carriedSet[c]);
  const filled = fromKis + fromNaver;
  if (filled === 0 || incomplete) {
    Logger.log('closeLock: 잠금 보류 (' + t.hhmm + (inWindow ? ' 창 안' : ' 창 놓침') + ', 채움 ' + filled + '/' + domCodes.length + ')');
    return { row: row, note: 'unlocked' };
  }
  const via = fromKis > 0 ? (fromNaver > 0 ? 'kis+naver' : 'kis') : 'naver';
  _mcProps().setProperty(MC.PROP_LOCK, JSON.stringify({ date: t.date, at: t.hhmm, via: via, skip: skip }));
  Logger.log('closeLock: ' + t.date + ' ' + t.hhmm + ' 잠금 (' + via + ', 국내 ' + filled + '/' + domCodes.length + ', 제외 ' + skip.length + ')');
  return { row: row, note: 'locked-now' };
}

/**
 * 잠금 창 안(또는 창을 놓친 뒤)인데 아직 잠기지 않았으면 전체 갱신 1회 — 잠금은 updateNewPriceHistory 안에서 일어난다.
 * @return {string} 'n/a' | 'locked' | 'locked-now' | 'not-locked' | 'gave-up' | 'skip-lock'
 */
function mcEnsureCloseSnapshot() {
  const t = _mcNow();
  const closeMin = _mcCloseMin(t.date);
  if (t.mins < closeMin + MC.LOCK_FROM) return 'n/a';
  if (!_mIsTradingDay()) return 'n/a';
  if (_mcLockOf(t.date)) return 'locked';
  if (t.mins > closeMin + MC.LOCK_TO) {
    // 창을 놓친 뒤의 보충은 하루 몇 번만 — 5분 신호마다 전체 갱신이 도는 것을 막는다
    const tr = _mcReadJson(MC.PROP_TRY);
    const n = (tr && tr.date === t.date) ? (Number(tr.n) || 0) : 0;
    if (n >= MC.FALLBACK_TRIES) return 'gave-up';
    _mcProps().setProperty(MC.PROP_TRY, JSON.stringify({ date: t.date, n: n + 1 }));
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return 'skip-lock';
  try {
    Logger.log('closeLock: 마감 기록용 전체 갱신 (' + t.hhmm + ')');
    updateAllNew();
  } finally {
    lock.releaseLock();
  }
  return _mcLockOf(t.date) ? 'locked-now' : 'not-locked';
}

// ── 2) 마감 시장 숫자 ───────────────────────────────────────

/** @return {string} 'n/a' | 'have' | 'saved' | 'saved-late' | 'fail' */
function mcEnsureMarketSnapshot() {
  const t = _mcNow();
  const closeMin = _mcCloseMin(t.date);
  if (t.mins < closeMin + MC.LOCK_FROM || t.mins > MC.MARKET_UNTIL) return 'n/a';
  if (!_mIsTradingDay()) return 'n/a';
  const cur = _mcReadJson(MC.PROP_MARKET);
  if (cur && cur.date === t.date) return 'have';
  const snap = _mcFetchMarket();
  if (!snap) return 'fail';
  snap.date = t.date;
  snap.at = t.hhmm;
  snap.late = t.mins > closeMin + MC.LOCK_TO;   // 애프터마켓 시작 뒤에 받은 값 — 리포트가 그렇게 밝힌다
  let json = JSON.stringify(snap);
  if (unescape(encodeURIComponent(json)).length > 8000) {   // 속성 한 칸 9KB 한도 — 업종을 위·아래 15개로 줄임
    snap.sectors = snap.sectors.slice(0, 15).concat(snap.sectors.slice(-15));
    json = JSON.stringify(snap);
  }
  _mcProps().setProperty(MC.PROP_MARKET, json);
  Logger.log('marketClose: ' + t.date + ' ' + t.hhmm + ' 저장 (업종 ' + snap.sectors.length + ', 순위 ' + snap.up.length + '/' + snap.down.length + (snap.late ? ', 늦음' : '') + ')');
  return snap.late ? 'saved-late' : 'saved';
}

/**
 * 보유 원화 종목(여러 계좌에 있으면 한 줄)의 마감 기록 — 마감 리포트·애프터마켓 알림용. 수량·금액 없음.
 * @return {{date: ?string, locked: boolean, closeHHMM: ?string, items: Array<{code, name, close, changePct}>}}
 */
function mcKrCloseTable(ss) {
  const out = { date: null, locked: false, closeHHMM: null, items: [] };
  const pos = ss.getSheetByName(NS.POSITION), ph = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!pos || pos.getLastRow() < 2 || !ph || ph.getLastRow() < 2 || ph.getLastColumn() < 2) return out;
  const names = {}, order = [];
  pos.getRange(2, 1, pos.getLastRow() - 1, 15).getValues().forEach(r => {
    if (String(r[0]) === '합계' || String(r[1]) === '합계' || !(Number(r[6]) > 0)) return;
    if (MC.HELD_CATS.indexOf(String(r[2] || '').trim()) < 0) return;
    const code = _normCode(String(r[0]));
    if (!code || names[code]) return;
    names[code] = String(r[1] || code);
    order.push(code);
  });
  const lastRow = ph.getLastRow(), lastCol = ph.getLastColumn();
  const codes = ph.getRange(1, 2, 1, lastCol - 1).getValues()[0].map(_normCode);
  const n = Math.min(lastRow - 1, 2);
  const rows = ph.getRange(lastRow - n + 1, 1, n, lastCol).getValues();
  const last = rows[rows.length - 1], prev = rows.length > 1 ? rows[0] : null;
  out.date = _mcDateStr(last[0]);
  out.locked = !!_mcLockOf(out.date);
  out.closeHHMM = _mcHHMM(_mcCloseMin(out.date));
  order.forEach(code => {
    const i = codes.indexOf(code);
    const close = i >= 0 ? (Number(last[i + 1]) || 0) : 0;
    const p = (i >= 0 && prev) ? (Number(prev[i + 1]) || 0) : 0;
    out.items.push({
      code: code, name: names[code], close: close,
      changePct: (close > 0 && p > 0) ? Math.round((close / p - 1) * 10000) / 100 : null,
    });
  });
  return out;
}

// ── 3) 애프터마켓 알림 ──────────────────────────────────────

/** 변화율 표기 — "+2.8%" / "-0.8%" / "0.0%" (폭 6칸 오른쪽 맞춤). */
function _mcFmtPct(p) {
  const r = Math.round(p * 10) / 10;
  return ((r > 0 ? '+' : '') + r.toFixed(1) + '%').replace('-0.0%', '0.0%').padStart(6);
}

function _mcFormatAmAlert(table, am) {
  const rows = table.items.map(x => {
    const a = Number(am[x.code]) || 0;
    return { name: x.name, pct: (a > 0 && x.close > 0) ? (a / x.close - 1) * 100 : null };
  });
  const ok = rows.filter(r => r.pct !== null).sort((a, b) => b.pct - a.pct);
  const bad = rows.filter(r => r.pct === null);
  const hh = String(table.closeHHMM || '1530');
  const lines = ['🌙 *애프터마켓 마감* — 정규장 종가 대비', '```'];
  ok.forEach(r => lines.push(_mcFmtPct(r.pct) + '  ' + r.name));
  bad.forEach(r => lines.push('  실패  ' + r.name));
  lines.push('```');
  if (!table.locked) lines.push('⚠️ _정규장 종가가 잠기지 않은 날 — 마지막 갱신값 기준_');
  lines.push('_' + table.date + ' · 정규장 ' + hh.slice(0, 2) + ':' + hh.slice(2) + ' → 애프터마켓 20:00 · ' + rows.length + '종목_');
  return lines.join('\n');
}

/**
 * 애프터마켓 종료 뒤 하루 1통 — 보유 원화 종목 전부의 변화율. 크기로 거르지 않고, 조회 실패 종목도 빼지 않는다.
 * @return {string} 'n/a' | 'done' | 'sent' | 'no-holdings' | 'no-close' | 'fail' | 'skip-lock'
 */
function mcAfterMarketAlert() {
  const t = _mcNow();
  if (t.mins < MC.AM_ALERT_FROM || t.mins > MC.AM_ALERT_TO) return 'n/a';
  if (!_mIsTradingDay()) return 'n/a';
  const props = _mcProps();
  if (props.getProperty(MC.PROP_AM_ALERT) === t.date) return 'done';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return 'skip-lock';
  try {
    if (props.getProperty(MC.PROP_AM_ALERT) === t.date) return 'done';
    const table = mcKrCloseTable(SpreadsheetApp.getActiveSpreadsheet());
    if (!table.items.length) return 'no-holdings';
    if (table.date !== t.date) return 'no-close';        // 오늘 행이 없음 — 비교할 정규장 종가가 없다
    const am = _mcNaverBasicPrices(table.items.map(x => x.code));
    if (!table.items.some(x => am[x.code] > 0 && x.close > 0)) return 'fail';   // 전부 실패 — 다음 신호에서 재시도
    props.setProperty(MC.PROP_AM_ALERT, t.date);         // 발송 전에 선점 — 5분 신호·30분 시계 중복 발송 방지
    tgSendMessage(_mcFormatAmAlert(table, am));
    Logger.log('amAlert: ' + t.date + ' ' + t.hhmm + ' 발송 (' + table.items.length + '종목)');
    return 'sent';
  } finally {
    lock.releaseLock();
  }
}

// ── 4) 아침 대조 ────────────────────────────────────────────

/**
 * 장중 첫 갱신에서 1회 — 앞 행(직전 거래일)의 국내 종목 값이 오늘 KIS 기준가와 같은지 센다.
 * 잠기지 않았던 날의 불일치만 기준가로 고친다 (잠긴 날의 불일치는 권리락 등 기준가 조정일 수 있어 개수만 기록).
 */
function mcCloseCheck(sheet, prevRow, codes, prevPrices) {
  const t = _mcNow();
  if (t.mins < 9 * 60 + 5 || t.mins >= _mcCloseMin(t.date)) return null;
  const done = _mcReadJson(MC.PROP_CHECK);
  if (done && done.date === t.date) return null;
  if (!(prevRow >= 2)) return null;
  const base = (typeof KIS_API !== 'undefined' && KIS_API._baseMap) || {};
  const prevDate = _mcDateStr(sheet.getRange(prevRow, 1).getValue());
  if (prevDate !== _mcPrevTradingDate(t.date)) {
    _mcProps().setProperty(MC.PROP_CHECK, JSON.stringify({ date: t.date, prevDate: prevDate, skipped: true }));
    Logger.log('closeCheck: 건너뜀 — 앞 행(' + prevDate + ')이 직전 거래일이 아님');
    return null;
  }
  const prevLocked = !!_mcLockOf(prevDate);
  const fixedRow = prevPrices.slice();
  let total = 0, match = 0, fixed = 0;
  codes.forEach((code, i) => {
    if (!_mcIsDomestic(code)) return;
    const b = Number(base[code]) || 0, p = Number(prevPrices[i]) || 0;
    if (!(b > 0) || !(p > 0)) return;
    total++;
    if (b === p) { match++; return; }
    // 애프터마켓과 정규장 종가의 차이는 몇 % 안쪽 — 그보다 크게 다르면 기준가 조정(권리락·분할)이나 조회 이상으로 보고 손대지 않는다
    if (!prevLocked && Math.abs(b / p - 1) <= MC.FIX_MAX_GAP) { fixedRow[i] = b; fixed++; }
  });
  if (total === 0) return null;   // 이번 실행은 기준가를 못 받음 — 다음 갱신에서 다시
  if (fixed > 0) sheet.getRange(prevRow, 2, 1, fixedRow.length).setValues([fixedRow]);
  const rec = { date: t.date, prevDate: prevDate, total: total, match: match, fixed: fixed, prevLocked: prevLocked };
  _mcProps().setProperty(MC.PROP_CHECK, JSON.stringify(rec));
  Logger.log('closeCheck: ' + prevDate + ' 기록 vs ' + t.date + ' 기준가 — 일치 ' + match + '/' + total +
    (fixed ? ', 기준가로 보정 ' + fixed + '칸' : '') + (prevLocked ? '' : ' [전날 미잠금]'));
  return rec;
}

// ── 진입점 ─────────────────────────────────────────────────

/** 5분 신호·30분 시계에서 호출 — 단계별 상태 문자열 {close, mkt, am}. 어떤 실패도 호출한 쪽에 번지지 않는다. */
function mcTick() {
  const out = {};
  try { out.close = mcEnsureCloseSnapshot(); } catch (e) { out.close = 'error'; Logger.log('mcTick close 오류: ' + e.message); }
  try { out.mkt = mcEnsureMarketSnapshot(); } catch (e) { out.mkt = 'error'; Logger.log('mcTick mkt 오류: ' + e.message); }
  try { out.am = mcAfterMarketAlert(); } catch (e) { out.am = 'error'; Logger.log('mcTick am 오류: ' + e.message); }
  return out;
}
