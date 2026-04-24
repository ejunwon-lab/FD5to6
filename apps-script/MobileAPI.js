/**
 * MobileAPI.gs
 * iOS 앱 전용 API — scripts.run으로 호출되는 진입점
 *
 * 외부(iOS)에서 호출 가능한 함수:
 *   mobileGetPortfolio()    — 현재 데이터 읽기만 (빠름, ~3초)
 *   mobileTriggerUpdate()   — 가격 갱신 후 읽기 (느림, 30~90초)
 */

/**
 * 현재 시트 데이터를 JSON 문자열로 반환 (갱신 없음)
 * iOS 앱 시작 시 또는 빠른 조회 시 호출
 */
function mobileGetPortfolio() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return JSON.stringify(_buildPortfolioJSON(ss));
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

/**
 * 가격 갱신 실행 후 최신 데이터를 JSON 문자열로 반환
 * iOS 앱 갱신 버튼 탭 시 호출 — UI 호출 없이 실행됨
 */
function mobileTriggerUpdate() {
  _IS_MOBILE_CALL = true;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateAllFinanceData();
    SpreadsheetApp.flush();
    return JSON.stringify(_buildPortfolioJSON(ss));
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    _IS_MOBILE_CALL = false;
  }
}

/**
 * 포트폴리오 전체 데이터 객체 빌드
 * — collectDashboardStats() 확장 버전 (전체 필드 포함)
 */
function _buildPortfolioJSON(ss) {
  const cols = getTrackerColumns(ss);
  const { values, idx } = getTrackerActiveData(ss);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);

  const EXCLUDE = CONFIG.CODES.EXCLUDE_KEYWORDS;

  // 환율
  let usdRate = 0, gbpRate = 0;
  try { usdRate = Number(getNamedRange(ss, CONFIG.NAMED_RANGES.FX_USD).getValue()) || 0; } catch (_) {}
  try { gbpRate = Number(getNamedRange(ss, CONFIG.NAMED_RANGES.FX_GBP).getValue()) || 0; } catch (_) {}

  // 합계행에서 공식 집계값 읽기
  let totalBuy = 0, totalCurrent = 0, totalProfit = 0;
  try {
    const totalRange = getNamedRange(ss, CONFIG.NAMED_RANGES.ACTIVE_TOTAL);
    const totalRow = totalRange.getRow();
    totalBuy     = Number(sheet.getRange(`${CONFIG.TOTAL_COLS.OP_BUY}${totalRow}`).getValue())     || 0;
    totalCurrent = Number(sheet.getRange(`${CONFIG.TOTAL_COLS.OP_CURRENT}${totalRow}`).getValue()) || 0;
    totalProfit  = Number(sheet.getRange(`${CONFIG.TOTAL_COLS.OP_PROFIT}${totalRow}`).getValue())  || 0;
  } catch (_) {}

  const byCategory = {};
  const byAccount  = {};
  const holdings   = [];

  for (const row of values) {
    const code = String(row[idx.CODE] || '');
    const name = row[idx.STATUS_NAME] || row[idx.NAME] || '';

    if (!code || EXCLUDE.some(k => String(name).includes(k))) continue;

    const qty = Number(row[idx.QUANTITY]) || 0;
    if (qty <= 0) continue;

    const category    = String(row[idx.CATEGORY]     || '');
    const broker      = String(row[idx.BROKER]        || '');
    const accountType = String(row[idx.ACCOUNT_TYPE]  || '');
    const buyPrice    = Number(row[idx.UNIT_PRICE])    || 0;
    const curPrice    = Number(row[idx.CURRENT_PRICE]) || 0;
    const opBuy       = Number(row[idx.OP_BUY])        || 0;
    const opCurrent   = Number(row[idx.OP_CURRENT])    || 0;
    const opProfit    = Number(row[idx.OP_PROFIT])      || 0;
    const profitRate  = opBuy > 0 ? _round2(opProfit / opBuy * 100) : 0;
    const change         = Number(row[idx.STATUS_CHANGE])  || 0;
    const _rawChangePct  = row[idx.STATUS_PCT];
    const _rawNum        = typeof _rawChangePct === 'number'
      ? _rawChangePct
      : toNumberLoose(_rawChangePct);
    // KIS는 소수형(0.1353 = 13.53%)으로 저장하므로 절댓값 ≤ 1이면 ×100
    const _changePctNum  = Math.abs(_rawNum) <= 1.0 ? _rawNum * 100 : _rawNum;
    const changePct = (_changePctNum >= 0 ? '+' : '') + _round2(_changePctNum).toFixed(2) + '%';
    const m1          = toNumberLoose(row[idx.STATUS_M1]);
    const m3          = toNumberLoose(row[idx.STATUS_M3]);
    const m6          = toNumberLoose(row[idx.STATUS_M6]);
    const y1          = toNumberLoose(row[idx.STATUS_Y1]);
    const high52      = Number(row[idx.STATUS_HIGH52])   || 0;
    const low52       = Number(row[idx.STATUS_LOW52])    || 0;

    // 분류별 집계
    if (category) {
      if (!byCategory[category]) byCategory[category] = { current: 0, buy: 0, profit: 0, count: 0 };
      byCategory[category].current += opCurrent;
      byCategory[category].buy     += opBuy;
      byCategory[category].profit  += opProfit;
      byCategory[category].count++;
    }

    // 계좌별 집계
    if (accountType) {
      if (!byAccount[accountType]) byAccount[accountType] = { current: 0, buy: 0, profit: 0, count: 0 };
      byAccount[accountType].current += opCurrent;
      byAccount[accountType].buy     += opBuy;
      byAccount[accountType].profit  += opProfit;
      byAccount[accountType].count++;
    }

    holdings.push({
      code, name, category, broker, accountType,
      quantity: qty, buyPrice, currentPrice: curPrice,
      opBuy, opCurrent, opProfit, profitRate,
      change, changePct,
      m1, m3, m6, y1, high52, low52
    });
  }

  // 분류별·계좌별 비중(%) 계산
  const _addPct = (map) => {
    Object.values(map).forEach(v => {
      v.profitRate = v.buy > 0 ? _round2(v.profit / v.buy * 100) : 0;
      v.pct        = totalCurrent > 0 ? _round2(v.current / totalCurrent * 100) : 0;
    });
  };
  _addPct(byCategory);
  _addPct(byAccount);

  // 추이 기록 시트에서 합계/확정/운용 수익 읽기 (U2:AG2 배치 1회)
  let trendTotalProfit = 0, confirmedProfit = 0, trendOperatingProfit = 0, dayChangAmount = 0, dayChangePct = '0%';
  let totalProfitRate = 0, confirmedProfitRate = 0, operatingProfitRate = 0;
  try {
    const trendSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TREND);
    if (trendSheet) {
      const pCol = CONFIG.TREND.PROFIT_START_COL; // 21 = U열
      const tr = trendSheet.getRange(2, pCol, 1, 13).getValues()[0]; // U2:AG2 한 번에
      trendTotalProfit     = toNumberLoose(tr[9]);   // AD2
      confirmedProfit      = toNumberLoose(tr[3]);   // X2
      trendOperatingProfit = toNumberLoose(tr[7]);   // AB2
      dayChangAmount       = toNumberLoose(tr[10]);  // AE2
      const _rawDayPct     = tr[11];                 // AF2
      dayChangePct = typeof _rawDayPct === 'number'
        ? (_rawDayPct >= 0 ? '+' : '') + _round2(_rawDayPct * 100).toFixed(2) + '%'
        : String(_rawDayPct || '0%');
      confirmedProfitRate  = _round2(toNumberLoose(tr[4])  * 100); // Y2
      operatingProfitRate  = _round2(toNumberLoose(tr[8])  * 100); // AC2
      totalProfitRate      = _round2(toNumberLoose(tr[12]) * 100); // AG2
    }
  } catch (_) {}

  return {
    success: true,
    updatedAt: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    usdRate,
    gbpRate,
    summary: {
      totalBuy,
      totalCurrent,
      totalProfit,
      profitRate: totalBuy > 0 ? _round2(totalProfit / totalBuy * 100) : 0,
      trendTotalProfit,
      totalProfitRate,
      confirmedProfit,
      confirmedProfitRate,
      trendOperatingProfit,
      operatingProfitRate,
      dayChangAmount,
      dayChangePct
    },
    byCategory,
    byAccount,
    holdings
  };
}

/**
 * 종목 현황 업데이트 (전체) 후 데이터 반환
 */
function mobileUpdateHoldingsFull() {
  _IS_MOBILE_CALL = true;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateStockStatusAuto();
    SpreadsheetApp.flush();
    _logToTrendSheetLite(ss);
    SpreadsheetApp.flush();
    return JSON.stringify(_buildPortfolioJSON(ss));
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    _IS_MOBILE_CALL = false;
  }
}

/**
 * 종목 현황 업데이트 (빠른) 후 데이터 반환
 */
function mobileUpdateHoldingsFast() {
  _IS_MOBILE_CALL = true;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateStockStatusQuick();
    SpreadsheetApp.flush();
    _logToTrendSheetLite(ss);
    SpreadsheetApp.flush();
    return JSON.stringify(_buildPortfolioJSON(ss));
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    _IS_MOBILE_CALL = false;
  }
}

/**
 * 모바일 전용 추이 요약 업데이트 (U2:AF2만 갱신, 히스토리 추가 없음)
 * logToTrendSheet 대비 ~70% 빠름: 컬럼 스캔·히스토리 추가(Section A/B) 생략
 */
function _logToTrendSheetLite(ss) {
  const trend = ss.getSheetByName(CONFIG.SHEET_NAMES.TREND);
  const track = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);
  if (!trend || !track) return;

  // 1. 운용 합계 배치 읽기 (ACTIVE_TOTAL 행 K~O, 1회)
  const totalRow = getNamedRange(ss, CONFIG.NAMED_RANGES.ACTIVE_TOTAL).getRow();
  const totals = track.getRange(totalRow, 11, 1, 5).getValues()[0]; // K=0,L=1,M=2,N=3,O=4
  const operatingBuy    = toNumberLoose(totals[0]); // K
  const operatingNow    = toNumberLoose(totals[3]); // N
  const operatingProfit = toNumberLoose(totals[4]); // O
  const operatingRate   = operatingBuy ? (operatingProfit / operatingBuy) * 100 : 0;

  // 2. 확정 수익 배치 읽기 (매도완료 섹션, 1회)
  const { startRow: soldStartRow } = getTrackerSoldData(ss);
  const trackLastRow = track.getLastRow();
  let confirmedBuy = 0, confirmedSell = 0, confirmedProfit = 0;
  const soldH = Math.max(trackLastRow - soldStartRow + 1, 0);
  if (soldH > 0) {
    const soldVals = track.getRange(soldStartRow, 11, soldH, 14).getValues();
    for (let i = soldVals.length - 1; i >= 0; i--) {
      if (!confirmedBuy    && soldVals[i][0])  confirmedBuy    = toNumberLoose(soldVals[i][0]);
      if (!confirmedSell   && soldVals[i][11]) confirmedSell   = toNumberLoose(soldVals[i][11]);
      if (!confirmedProfit && soldVals[i][13]) confirmedProfit = toNumberLoose(soldVals[i][13]);
      if (confirmedBuy && confirmedSell && confirmedProfit) break;
    }
  }
  const confirmedRate = confirmedBuy ? (confirmedProfit / confirmedBuy) * 100 : 0;
  const totalProfit   = confirmedProfit + operatingProfit;

  // 3. 전일 대비 계산: 현재 U2:AE2 배치 읽기 (1회)로 기준값 복원
  const pCol = CONFIG.TREND.PROFIT_START_COL; // 21 = U
  const existing = trend.getRange(2, pCol, 1, 11).getValues()[0]; // U2:AE2
  const existingDate = String(existing[0] || '');
  const existingAD   = toNumberLoose(existing[9]);  // AD2 = 마지막 totalProfit
  const existingAE   = toNumberLoose(existing[10]); // AE2 = 마지막 diffProfit
  const tz = 'Asia/Seoul';
  const now = new Date();
  const todayStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  // 오늘 이미 기록됐으면 AD-AE = 어제 기준, 아니면 AD = 어제(마지막) 기준
  const prevTotalProfit = existingDate.startsWith(todayStr)
    ? (existingAD - existingAE)
    : existingAD;
  const diffProfit = totalProfit - prevTotalProfit;
  const diffRate   = prevTotalProfit ? (diffProfit / prevTotalProfit) * 100 : 0;

  // 4. U2:AF2만 갱신 (1회 write, 히스토리 추가 없음)
  const dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd (EEE)');
  const timeStr = Utilities.formatDate(now, tz, 'a h시 m분 s초').replace('AM', '오전').replace('PM', '오후');
  trend.getRange(2, pCol, 1, 12).setValues([[
    dateStr + ' ' + timeStr,
    fmtNum(confirmedBuy), fmtNum(confirmedSell),
    fmtNum(confirmedProfit), fmtPct(confirmedRate),
    fmtNum(operatingBuy),   fmtNum(operatingNow),
    fmtNum(operatingProfit), fmtPct(operatingRate),
    fmtNum(totalProfit),    fmtNum(diffProfit),
    fmtPct(diffRate)
  ]]);
}

/**
 * 통합 업데이트 (가격 + 종목현황 + 추이 + 성과 + 그래프) 후 데이터 반환
 */
function mobileUpdateAll() {
  _IS_MOBILE_CALL = true;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    runFullUpdate();
    SpreadsheetApp.flush();
    return JSON.stringify(_buildPortfolioJSON(ss));
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    _IS_MOBILE_CALL = false;
  }
}

function _round2(n) {
  return Math.round(n * 100) / 100;
}
