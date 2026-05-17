/**
 * StockMetrics.js — 종목별 지표 단일 계산 (신시스템 v2)
 *
 *  *종목지표* 시트 = 종목별 지표(당일등락·1주/1달 손익·1M~1Y%·52주)의 단일 소스.
 *  computeStockMetrics() 가 *현재가_이력* + *보유현황* + *거래_원장*으로 한 번 계산해 기록.
 *  앱(_mMapHolding)·시트(buildDashboard)는 _readStockMetrics()로 읽기만 한다.
 *
 *  AS-IS: _mCalcExtras(MobileAPI) + _calcExtraColumns·_calcTodayProfit(Dashboard) — 3개 중복 계산
 *  TO-BE: computeStockMetrics 1개 → *종목지표* → 양쪽 읽기
 */

// *종목지표* 시트 생성 (헤더만)
function _setupStockMetricsSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(NS.STOCK_METRICS);
  if (sh) return sh;
  sh = ss.insertSheet(NS.STOCK_METRICS);
  sh.getRange(1, 1, 1, 15).setValues([[
    '종목코드', '종목명', '증권사', '계좌',
    '당일등락', '당일등락률', '당일손익', '1주손익', '1달손익',
    '1M%', '3M%', '6M%', '1Y%', '52주최고', '52주최저',
  ]]).setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sh.setFrozenRows(1);
  return sh;
}

/**
 * 종목별 지표를 계산해 *종목지표* 시트에 기록.
 * 입력이 바뀌는 함수(updatePositionFromLedger)가 끝에 호출 → 항상 최신 유지.
 */
function computeStockMetrics(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const priceHistSheet = ss.getSheetByName(NS.PRICE_HISTORY);
  const posSheet       = ss.getSheetByName(NS.POSITION);
  const ledgerSheet    = ss.getSheetByName(NS.LEDGER);
  const sh = _setupStockMetricsSheet(ss);

  if (!posSheet || posSheet.getLastRow() < 2) {
    if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 15).clearContent();
    return;
  }
  const posRows = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 15).getValues()
    .filter(r => String(r[0]) !== '합계' && String(r[1]) !== '합계' && Number(r[6]) > 0);

  // ── *현재가_이력* 컨텍스트 (비거래일 행 필터링) ──
  let dates = [], prices = [], todayIdx = -1, prevIdx = -1;
  const codeColMap = {};
  if (priceHistSheet && priceHistSheet.getLastRow() >= 2 && priceHistSheet.getLastColumn() >= 2) {
    const lastRow = priceHistSheet.getLastRow();
    const lastCol = priceHistSheet.getLastColumn();
    priceHistSheet.getRange(1, 2, 1, lastCol - 1).getValues()[0].forEach((c, i) => {
      const nc = _normCode(String(c));
      if (nc) codeColMap[nc] = i;
    });
    const datesRaw  = priceHistSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const allDates  = datesRaw.map(r => r[0] instanceof Date
      ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd')
      : String(r[0]).slice(0, 10));
    const allPrices = priceHistSheet.getRange(2, 2, lastRow - 1, lastCol - 1).getValues();
    for (let i = 0; i < allDates.length; i++) {
      if (_isTradingDateStr(allDates[i])) { dates.push(allDates[i]); prices.push(allPrices[i]); }
    }
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] === today) todayIdx = i;
      else if (dates[i] < today) prevIdx = i;
    }
    // 오늘 행 없으면(비거래일) 마지막 거래일을 today로
    if (todayIdx === -1 && dates.length > 0) {
      todayIdx = dates.length - 1;
      prevIdx  = todayIdx - 1;
    }
  }

  const findNDaysAgo = (n) => {
    if (todayIdx < 0) return -1;
    const targetMs = new Date(dates[todayIdx]).getTime() - n * 86400000;
    let best = -1;
    for (let i = 0; i < dates.length; i++) {
      const ms = new Date(dates[i]).getTime();
      if (ms <= targetMs && (best === -1 || ms > new Date(dates[best]).getTime())) best = i;
    }
    return best;
  };
  const w1Idx = findNDaysAgo(7),  m1Idx = findNDaysAgo(30), m3Idx = findNDaysAgo(90),
        m6Idx = findNDaysAgo(180), y1Idx = findNDaysAgo(365);

  // ── *거래_원장* → (코드‖증권사‖계좌)별 거래 시계열 ──
  const txByKey = {};
  if (ledgerSheet && ledgerSheet.getLastRow() >= 2) {
    ledgerSheet.getRange(2, 1, ledgerSheet.getLastRow() - 1, 10).getValues().forEach(r => {
      const d = r[0] instanceof Date
        ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd')
        : String(r[0]).slice(0, 10);
      const type = String(r[1] || '').trim();
      const code = _normCode(String(r[2] || ''));
      const broker = String(r[5] || ''), acct = String(r[6] || ''), qty = Number(r[7]) || 0;
      if (!code || !d || qty === 0) return;
      const sign = type === '매수' ? 1 : type === '매도' ? -1 : 0;
      if (sign === 0) return;
      const amt = Number(r[9]) || (Number(r[8]) || 0) * qty;
      const k = code + '||' + broker + '||' + acct;
      (txByKey[k] = txByKey[k] || []).push({ date: d, qty: qty * sign, amt: amt * sign });
    });
    Object.keys(txByKey).forEach(k => txByKey[k].sort((a, b) => (a.date < b.date ? -1 : 1)));
  }
  const qtyAtDate = (k, ds) => {
    let q = 0;
    for (const t of (txByKey[k] || [])) { if (t.date <= ds) q += t.qty; else break; }
    return q;
  };
  const netInvestedSince = (k, ds) => {
    let a = 0;
    for (const t of (txByKey[k] || [])) { if (t.date > ds) a += t.amt; }
    return a;
  };

  // ── 종목별 계산 ──
  const blank = v => (v === null || v === undefined ? '' : v);
  const out = posRows.map(row => {
    const code = _normCode(String(row[0])), name = String(row[1] || '');
    const broker = String(row[3] || ''), acct = String(row[4] || '');
    const key = code + '||' + broker + '||' + acct;
    const curQty = Number(row[6]) || 0;
    const colIdx = codeColMap[code];
    if (colIdx === undefined || todayIdx < 0) {
      return [code, name, broker, acct, '', '', '', '', '', '', '', '', '', '', ''];
    }
    const tPrice = Number(prices[todayIdx][colIdx]) || 0;
    const pPrice = prevIdx >= 0 ? (Number(prices[prevIdx][colIdx]) || 0) : 0;
    const change    = (tPrice > 0 && pPrice > 0) ? (tPrice - pPrice) : null;
    const changePct = (change !== null && pPrice > 0) ? (change / pPrice * 100) : null;
    const todayPnl  = (change !== null) ? change * curQty : null;

    // 정확한 기간 손익 = 오늘 평가금액 − N일전 평가금액 − 기간 내 순매수금액
    const pnlAt = (idx) => {
      if (idx === -1 || tPrice <= 0) return null;
      const pastQty   = qtyAtDate(key, dates[idx]);
      const pastPrice = Number(prices[idx][colIdx]) || 0;
      if (pastQty > 0 && pastPrice <= 0) return null;
      return tPrice * curQty - pastPrice * pastQty - netInvestedSince(key, dates[idx]);
    };
    const pctAt = (idx) => {
      if (idx === -1 || tPrice <= 0) return null;
      const past = Number(prices[idx][colIdx]) || 0;
      if (past <= 0) return null;
      return (tPrice - past) / past * 100;
    };

    // 52주 고·저 (1년치 범위, 없으면 전체)
    let high52 = 0, low52 = 0;
    for (let i = (y1Idx !== -1 ? y1Idx : 0); i <= todayIdx; i++) {
      const p = Number(prices[i][colIdx]) || 0;
      if (p > 0) { if (p > high52) high52 = p; if (low52 === 0 || p < low52) low52 = p; }
    }

    return [
      code, name, broker, acct,
      blank(change), blank(changePct), blank(todayPnl),
      blank(pnlAt(w1Idx)), blank(pnlAt(m1Idx)),
      blank(pctAt(m1Idx)), blank(pctAt(m3Idx)), blank(pctAt(m6Idx)), blank(pctAt(y1Idx)),
      high52, low52,
    ];
  });

  // ── *종목지표* 시트 기록 (전체 clear 후 재기록 → 판 종목 자동 정리) ──
  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 15).clearContent();
  if (out.length > 0) sh.getRange(2, 1, out.length, 15).setValues(out);
  Logger.log('computeStockMetrics 완료: ' + out.length + '종목');
}

/**
 * *종목지표* 시트 → Map(코드‖증권사‖계좌 → 지표 객체).
 * 시트가 없거나 비었으면 computeStockMetrics 1회 실행 (안전망).
 */
function _readStockMetrics(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(NS.STOCK_METRICS);
  if (!sh || sh.getLastRow() < 2) {
    computeStockMetrics(ss);
    sh = ss.getSheetByName(NS.STOCK_METRICS);
  }
  const map = new Map();
  if (!sh || sh.getLastRow() < 2) return map;
  const num = v => (v === '' || v === null || v === undefined) ? null : Number(v);
  sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues().forEach(r => {
    const key = _normCode(String(r[0])) + '||' + String(r[2] || '') + '||' + String(r[3] || '');
    map.set(key, {
      change:   num(r[4]),  changePct: num(r[5]),  todayPnl: num(r[6]),
      w1Pnl:    num(r[7]),  m1Pnl:     num(r[8]),
      m1Pct:    num(r[9]),  m3Pct:     num(r[10]), m6Pct:    num(r[11]), y1Pct: num(r[12]),
      high52:   num(r[13]) || 0, low52: num(r[14]) || 0,
    });
  });
  return map;
}
