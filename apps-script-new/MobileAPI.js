/**
 * MobileAPI.js (신시스템) — iOS 뉴FD7 앱 진입점
 * Script ID: 1DC8llpWYz2ZvzsqVCaz60qomATwxP_CBzuHBitCf0uQT5NbBF-n7IHdZ
 *
 * 모든 함수는 JSON.stringify 된 문자열을 반환 (GAS scripts.run API 특성상)
 */

// ══════════════════════════════════════════════════════
//  포트폴리오 읽기 (앱 실행 시 즉시 호출)
// ══════════════════════════════════════════════════════

function newMobileGetPortfolio() {
  try {
    const ss       = SpreadsheetApp.getActiveSpreadsheet();
    const posSheet = ss.getSheetByName(NS.POSITION);
    const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);

    if (!posSheet) {
      return JSON.stringify({ success: false, error: '*보유현황* 없음. updatePositionFromLedger 먼저 실행하세요.' });
    }

    const posRows = posSheet.getLastRow() >= 2
      ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 23).getValues()
          .filter(r => String(r[1]) !== '합계' && String(r[0]) !== '합계' && Number(r[6]) > 0)
      : [];

    const pnlRows = (pnlSheet && pnlSheet.getLastRow() >= 2)
      ? pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
          .filter(r => r[0] && String(r[2]) !== '합계')
      : [];

    const buyDateMap = _mGetBuyDates(ss);
    const fx         = _mGetFxRates(ss);
    const holdings   = posRows.map(r => _mMapHolding(r, buyDateMap));

    // ── 요약 계산 ──
    const totalBuy = posRows.reduce((s, r) => s + (Number(r[8])  || 0), 0);
    const totalCur = posRows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
    const opProfit = totalCur - totalBuy;
    const opRate   = totalBuy > 0 ? opProfit / totalBuy * 100 : 0;

    const cfProfit = pnlRows.reduce((s, r) => s + (Number(r[12]) || 0), 0);
    const cfBuy    = pnlRows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
    const cfRate   = cfBuy > 0 ? cfProfit / cfBuy * 100 : 0;

    const totProfit = opProfit + cfProfit;
    const totRate   = totalBuy > 0 ? totProfit / totalBuy * 100 : 0;

    // ── 오늘 수익 (등락 × 수량) ──
    const dayChange = posRows.reduce((s, r) => s + (Number(r[15]) || 0) * (Number(r[6]) || 0), 0);
    const prevCur   = totalCur - dayChange;
    const dayPct    = prevCur > 0 ? dayChange / prevCur * 100 : 0;

    const isMarketDay = _mIsMarketDay();

    const summary = {
      totalBuy,
      totalCurrent: totalCur,
      totalProfit:  opProfit,
      profitRate:   opRate,
      trendTotalProfit:      totProfit,
      totalProfitRate:       totRate,
      confirmedProfit:       cfProfit,
      confirmedProfitRate:   cfRate,
      trendOperatingProfit:  opProfit,
      operatingProfitRate:   opRate,
      dayChangAmount:  dayChange,
      dayChangePct:    (dayPct >= 0 ? '+' : '') + dayPct.toFixed(2) + '%',
      prevDayChangAmount: null,
      prevDayChangePct:   null,
      isMarketDay,
    };

    const byCategory = _mGroupBy(posRows, 2, totalCur);
    const byAccount  = _mGroupBy(posRows, 4, totalCur);

    return JSON.stringify({
      success: true,
      updatedAt: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      usdRate: fx.usd,
      gbpRate: fx.gbp,
      summary,
      byCategory,
      byAccount,
      holdings,
    });
  } catch (e) {
    Logger.log('newMobileGetPortfolio 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  현재가 갱신 (빠른 갱신: 가격 + 등락 + 52주)
// ══════════════════════════════════════════════════════

function newMobileUpdateCurrentPrice() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateFxRates(ss);
    updateNewCurrentPrice(ss);
    updatePositionFromLedger();
    return newMobileGetPortfolio();
  } catch (e) {
    Logger.log('newMobileUpdateCurrentPrice 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  히스토리 갱신 (1M~1Y 포함, 1~2분 소요)
// ══════════════════════════════════════════════════════

function newMobileUpdateHistory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateFxRates(ss);
    updateNewStockHistory(ss);
    updatePositionFromLedger();
    return newMobileGetPortfolio();
  } catch (e) {
    Logger.log('newMobileUpdateHistory 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  전체 갱신 (환율 + 현재가 + 보유현황)
// ══════════════════════════════════════════════════════

function newMobileUpdateAll() {
  try {
    updateAllNew();
    return newMobileGetPortfolio();
  } catch (e) {
    Logger.log('newMobileUpdateAll 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  참고지표 (신시스템 미구현 — 빈 목록 반환)
// ══════════════════════════════════════════════════════

function newMobileGetIndicators() {
  return JSON.stringify({
    success: true,
    updatedAt: null,
    indicators: [],
  });
}

// ══════════════════════════════════════════════════════
//  수익 히스토리 (*현재가_이력* 기반 근사 계산)
//  현재 보유수량 × 과거 가격으로 포트폴리오 가치 추산
// ══════════════════════════════════════════════════════

function newMobileGetProfitHistory() {
  try {
    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const posSheet  = ss.getSheetByName(NS.POSITION);
    const histSheet = ss.getSheetByName(NS.PRICE_HISTORY);

    if (!posSheet || !histSheet ||
        histSheet.getLastRow() < 3 || histSheet.getLastColumn() < 2) {
      return JSON.stringify({ success: true, entries: [] });
    }

    const posRows = posSheet.getLastRow() >= 2
      ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 11).getValues()
          .filter(r => String(r[1]) !== '합계' && Number(r[6]) > 0)
      : [];

    if (posRows.length === 0) return JSON.stringify({ success: true, entries: [] });

    // 종목코드 → 보유수량 맵 (현재 기준)
    const qtyMap = {};
    posRows.forEach(r => {
      const code = _normCode(String(r[0]));
      if (!code || NS.KIS_SKIP.includes(String(r[2]))) return;
      if (!qtyMap[code]) qtyMap[code] = 0;
      qtyMap[code] += Number(r[6]) || 0;
    });

    const totalBuy = posRows.reduce((s, r) => s + (Number(r[8]) || 0), 0);

    const lastCol  = histSheet.getLastColumn() - 1;
    const codes    = histSheet.getRange(1, 2, 1, lastCol).getValues()[0].map(c => _normCode(String(c)));
    const dataRows = histSheet.getLastRow() - 1;
    const dates    = histSheet.getRange(2, 1, dataRows, 1).getValues();
    const prices   = histSheet.getRange(2, 2, dataRows, lastCol).getValues();

    const entries = [];
    for (let i = 0; i < dataRows; i++) {
      const raw     = dates[i][0];
      const dateStr = raw instanceof Date
        ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
        : String(raw).slice(0, 10);
      if (!dateStr || dateStr.length < 10) continue;

      let totalCur = 0;
      codes.forEach((code, j) => {
        if (!code || !qtyMap[code]) return;
        const price = Number(prices[i][j]) || 0;
        if (price > 0) totalCur += price * qtyMap[code];
      });
      if (totalCur <= 0) continue;

      entries.push({ date: dateStr, totalProfit: Math.round(totalCur - totalBuy) });
    }

    return JSON.stringify({ success: true, entries });
  } catch (e) {
    Logger.log('newMobileGetProfitHistory 오류: ' + e);
    return JSON.stringify({ success: true, entries: [] });
  }
}

// ── 내부 헬퍼 ─────────────────────────────────────────

function _mMapHolding(r, buyDateMap) {
  const code   = String(r[0] || '');
  const name   = String(r[1] || '');
  const broker = String(r[3] || '');
  const acct   = String(r[4] || '');
  const key    = code + '||' + name + '||' + broker + '||' + acct;

  return {
    code,
    name,
    category:    String(r[2] || ''),
    broker,
    accountType: acct,
    quantity:    Number(r[6])  || 0,
    buyPrice:    Number(r[7])  || 0,
    currentPrice: Number(r[9]) || 0,
    opBuy:       Number(r[8])  || 0,
    opCurrent:   Number(r[10]) || 0,
    opProfit:    Number(r[11]) || 0,
    profitRate:  Number(r[12]) || 0,
    change:      Number(r[15]) || 0,
    changePct:   _mFmtPct(r[16]),
    m1:  _mParseRateNum(r[17]),
    m3:  _mParseRateNum(r[18]),
    m6:  _mParseRateNum(r[19]),
    y1:  _mParseRateNum(r[20]),
    high52: Number(r[21]) || 0,
    low52:  Number(r[22]) || 0,
    buyDate: buyDateMap[key] || null,
  };
}

function _mParseRateNum(val) {
  if (!val || val === '-') return 0;
  const v = parseFloat(String(val).replace('%', ''));
  return isNaN(v) ? 0 : v;
}

function _mFmtPct(val) {
  if (!val || val === '-') return '0%';
  const s = String(val).trim();
  return s.startsWith('+') || s.startsWith('-') ? s : '+' + s;
}

function _mGetBuyDates(ss) {
  const map    = {};
  const ledger = ss.getSheetByName(NS.LEDGER);
  if (!ledger || ledger.getLastRow() < 2) return map;

  const rows = ledger.getRange(2, 1, ledger.getLastRow() - 1, 12).getValues();
  rows.forEach(row => {
    if (String(row[1]) !== '매수') return;
    const date   = row[0] instanceof Date
      ? Utilities.formatDate(row[0], 'Asia/Seoul', 'yyyy-MM-dd')
      : String(row[0]).slice(0, 10);
    const code   = String(row[2] || '');
    const name   = String(row[3] || '');
    const broker = String(row[5] || '');
    const acct   = String(row[6] || '');
    const key    = code + '||' + name + '||' + broker + '||' + acct;
    if (!map[key]) map[key] = date;
  });
  return map;
}

function _mGetFxRates(ss) {
  try {
    const sheet = ss.getSheetByName(NS.SETTINGS);
    if (!sheet) return { usd: 1400, gbp: 1700 };
    return {
      usd: Number(sheet.getRange(2, 2).getValue()) || 1400,
      gbp: Number(sheet.getRange(3, 2).getValue()) || 1700,
    };
  } catch (e) { return { usd: 1400, gbp: 1700 }; }
}

function _mIsMarketDay() {
  const now     = new Date();
  const tz      = 'Asia/Seoul';
  const weekday = parseInt(Utilities.formatDate(now, tz, 'u')); // 1=월, 7=일
  if (weekday >= 6) return false;
  const hhmm = parseInt(Utilities.formatDate(now, tz, 'HHmm'), 10);
  return hhmm >= 900 && hhmm <= 1530;
}

function _mGroupBy(posRows, colIdx, totalCur) {
  const map = {};
  posRows.forEach(r => {
    const key = String(r[colIdx] || '기타');
    if (!map[key]) map[key] = { buy: 0, current: 0, profit: 0, count: 0 };
    map[key].buy     += Number(r[8])  || 0;
    map[key].current += Number(r[10]) || 0;
    map[key].profit  += Number(r[11]) || 0;
    map[key].count++;
  });
  const result = {};
  Object.entries(map).forEach(([k, v]) => {
    result[k] = {
      buy:       v.buy,
      current:   v.current,
      profit:    v.profit,
      count:     v.count,
      profitRate: v.buy > 0 ? v.profit / v.buy * 100 : 0,
      pct:        totalCur > 0 ? v.current / totalCur * 100 : 0,
    };
  });
  return result;
}
