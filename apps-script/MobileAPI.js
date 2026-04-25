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

// ══════════════════════════════════════════════════════════════════════
// 참고지표 (Reference Indicators)
// ══════════════════════════════════════════════════════════════════════

/**
 * 참고지표 시트 구조:
 *   참고지표 (요약):  A=키, B=지표명, C=카테고리, D=현재값, E=등락, F=등락률(%), G=갱신시간
 *   참고지표_히스토리: A=날짜(yyyy-MM-dd), B=시간(HH:mm:ss), C~P=각 지표 현재값 (REFERENCE_INDICATORS 순서)
 */

/**
 * iOS 앱용: 참고지표 조회 + 갱신 + JSON 반환
 *
 * 호출 시마다:
 *   1. KIS API / GOOGLEFINANCE로 현재값 조회
 *   2. `참고지표` 시트 업데이트
 *   3. `참고지표_히스토리` 시트에 오늘 날짜 행 upsert
 *   4. 최종 결과 JSON 반환
 */
function mobileGetReferenceIndicators() {
  const _prevMobileCall = _IS_MOBILE_CALL;
  _IS_MOBILE_CALL = true;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    KIS_API.ensureToken();

    // 시트 확보 (없으면 생성)
    const summarySheet = _ensureIndicatorsSummarySheet(ss);
    const historySheet = _ensureIndicatorsHistorySheet(ss);

    // 각 지표 조회
    const results = [];
    const tz = 'Asia/Seoul';
    const now = new Date();
    const updatedAt = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
    const today     = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    const hhmmss    = Utilities.formatDate(now, tz, 'HH:mm:ss');

    for (const def of REFERENCE_INDICATORS) {
      let info = null;

      try {
        if (def.source === 'kis_domestic_index') {
          info = KIS_API.getDomesticIndex(def.code);
        } else if (def.source === 'kis_overseas_index') {
          info = KIS_API.getOverseasIndex(def.code, def.excd || 'NAS');
        } else if (def.source === 'kis_domestic_futures') {
          info = KIS_API.getDomesticFutures(def.code);
        } else if (def.source === 'yahoo_finance') {
          info = _getYahooFinanceQuote(def.ySymbol);
        }
        // 'googlefinance'는 아래 fallback 블록에서 시트 수식으로 처리
      } catch (e) {
        Logger.log(`지표 ${def.key} 조회 오류: ${e}`);
      }

      results.push({
        key: def.key,
        name: def.name,
        category: def.category,
        value: info ? info.value : 0,
        change: info ? info.change : 0,
        changePct: info ? info.changePct : 0,
        source: def.source,
        gfSymbol: def.gfSymbol || ''
      });
    }

    // GOOGLEFINANCE fallback: Temp 영역에서 수식 계산
    _fillGoogleFinanceIndicators(ss, results);

    // KIS 실패한 지표 → Yahoo Finance로 보완
    _fillMissingWithYahooFinance(results);

    // KIS 실패한 지표 → GOOGLEFINANCE로 추가 보완
    _fillMissingWithGoogleFinance(ss, results);

    // 참고지표 시트 업데이트 (A~G열)
    const summaryRows = results.map(r => [
      r.key, r.name, r.category,
      r.value, r.change, r.changePct,
      updatedAt
    ]);
    // 헤더 확보 (1행)
    summarySheet.getRange(1, 1, 1, 7).setValues([
      ['키', '지표명', '카테고리', '현재값', '등락', '등락률(%)', '갱신시간']
    ]);
    if (summaryRows.length > 0) {
      summarySheet.getRange(2, 1, summaryRows.length, 7).setValues(summaryRows);
    }

    // 참고지표_히스토리 upsert
    _upsertIndicatorsHistory(historySheet, today, hhmmss, results);

    SpreadsheetApp.flush();

    return JSON.stringify({
      success: true,
      updatedAt,
      indicators: results.map(r => ({
        key: r.key,
        name: r.name,
        category: r.category,
        value: r.value,
        change: r.change,
        changePct: r.changePct
      }))
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  } finally {
    _IS_MOBILE_CALL = _prevMobileCall; // 호출 전 상태로 복원 (중첩 호출 시 덮어쓰기 방지)
  }
}

/**
 * 추이 기록 Section C에서 날짜별 합계 수익 히스토리 반환
 */
function mobileGetProfitHistory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const trendSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TREND);
    if (!trendSheet) return JSON.stringify({ success: false, error: '추이 기록 시트 없음' });

    const startRow = CONFIG.TREND.PROFIT_START_ROW;
    const startCol = CONFIG.TREND.PROFIT_START_COL;
    const lastRow  = trendSheet.getLastRow();
    const numRows  = Math.max(0, lastRow - startRow + 1);
    if (numRows === 0) return JSON.stringify({ success: true, entries: [] });

    const data = trendSheet.getRange(startRow, startCol, numRows, 10).getValues();
    const entries = data
      .filter(row => String(row[0] || '').match(/\d{4}-\d{2}-\d{2}/))
      .map(row => {
        const m = String(row[0]).match(/(\d{4}-\d{2}-\d{2})/);
        return { date: m[1], totalProfit: toNumberLoose(row[9]) };
      })
      .slice(-180); // 최근 180개

    return JSON.stringify({ success: true, entries });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

/**
 * onOpen 메뉴용: 참고지표만 갱신 (JSON 반환 안 함)
 */
function updateReferenceIndicators() {
  mobileGetReferenceIndicators();
}

function _ensureIndicatorsSummarySheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.INDICATORS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.INDICATORS);
    sheet.getRange(1, 1, 1, 7).setValues([
      ['키', '지표명', '카테고리', '현재값', '등락', '등락률(%)', '갱신시간']
    ]).setFontWeight('bold').setBackground('#f0f0f0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _ensureIndicatorsHistorySheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.INDICATORS_HISTORY);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.INDICATORS_HISTORY);
    const header = ['날짜', '시간', ...REFERENCE_INDICATORS.map(d => d.name)];
    sheet.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.setFrozenRows(1);
  } else {
    // 헤더 개수가 바뀌면 보강
    const expectedLen = 2 + REFERENCE_INDICATORS.length;
    const lastCol = sheet.getLastColumn();
    if (lastCol < expectedLen) {
      const header = ['날짜', '시간', ...REFERENCE_INDICATORS.map(d => d.name)];
      sheet.getRange(1, 1, 1, header.length).setValues([header])
        .setFontWeight('bold').setBackground('#f0f0f0');
    }
  }
  return sheet;
}

/**
 * GOOGLEFINANCE 수식으로 지표값 보완 (Temp 영역 사용)
 */
function _fillGoogleFinanceIndicators(ss, results) {
  const gfItems = results.filter(r => r.source === 'googlefinance');
  if (gfItems.length === 0) return;

  // Temp 시트 확보
  let tempSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMP);
  if (!tempSheet) {
    tempSheet = ss.insertSheet(CONFIG.SHEET_NAMES.TEMP);
    tempSheet.hideSheet();
  }

  // 작업 영역: AA1부터 시작 (기존 Temp 데이터 침범 방지)
  const START_COL = 27; // AA
  const START_ROW = 1;

  // 각 항목당 3칸: price, change, changePct
  const formulas = gfItems.map(item => [
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","price"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","change"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","changepct"),"")`
  ]);

  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).setFormulas(formulas);
  SpreadsheetApp.flush();
  Utilities.sleep(1500); // GOOGLEFINANCE 로딩 대기

  const values = tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).getValues();

  gfItems.forEach((item, idx) => {
    const v = values[idx];
    const price = toNumberLoose(v[0]);
    if (price && price > 0) {
      // TNX: GOOGLEFINANCE가 ×10 값으로 반환 (4.32% → 43.2)
      const divisor = item.key === 'TNX' ? 10 : 1;
      item.value = price / divisor;
      item.change = toNumberLoose(v[1]) / divisor;
      item.changePct = toNumberLoose(v[2]);
    }
  });

  // Temp 영역 비움
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).clearContent();
}

/**
 * Yahoo Finance API로 선물/현물 시세 조회
 * ES=F, NQ=F 등 GOOGLEFINANCE 미지원 심볼용
 */
function _getYahooFinanceQuote(symbol) {
  if (!symbol) return null;
  try {
    // v8/chart: crumb 불필요, v7보다 접근성 높음
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
    const res = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoogleAppsScript)' },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      Logger.log(`Yahoo Finance ${symbol} HTTP ${res.getResponseCode()}`);
      return null;
    }
    const data = JSON.parse(res.getContentText());
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || meta.previousClose || price;
    const change    = price - prev;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;
    return { value: price, change, changePct };
  } catch (e) {
    Logger.log(`Yahoo Finance 오류(${symbol}): ${e}`);
    return null;
  }
}

/**
 * KIS 실패한 지표를 Yahoo Finance로 보완 (ySymbol 있는 항목)
 */
function _fillMissingWithYahooFinance(results) {
  const missing = results.filter(r => (!r.value || r.value <= 0) && r.ySymbol);
  for (const item of missing) {
    const quote = _getYahooFinanceQuote(item.ySymbol);
    if (quote && quote.value > 0) {
      item.value     = quote.value;
      item.change    = quote.change;
      item.changePct = quote.changePct;
    }
  }
}

/**
 * KIS 실패한 지표를 GOOGLEFINANCE로 추가 보완
 */
function _fillMissingWithGoogleFinance(ss, results) {
  const missing = results.filter(r =>
    r.source !== 'googlefinance' && (!r.value || r.value <= 0) && r.gfSymbol
  );
  if (missing.length === 0) return;

  let tempSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMP);
  if (!tempSheet) {
    tempSheet = ss.insertSheet(CONFIG.SHEET_NAMES.TEMP);
    tempSheet.hideSheet();
  }

  const START_COL = 31; // AE
  const START_ROW = 1;

  const formulas = missing.map(item => [
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","price"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","change"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","changepct"),"")`
  ]);

  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).setFormulas(formulas);
  SpreadsheetApp.flush();
  Utilities.sleep(1500);

  const values = tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).getValues();

  missing.forEach((item, idx) => {
    const v = values[idx];
    const price = toNumberLoose(v[0]);
    if (price && price > 0) {
      item.value = price;
      item.change = toNumberLoose(v[1]);
      item.changePct = toNumberLoose(v[2]);
    }
  });

  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).clearContent();
}

/**
 * 참고지표_히스토리 시트에 오늘 날짜 행 upsert (같은 날 덮어쓰기)
 */
function _upsertIndicatorsHistory(sheet, today, hhmmss, results) {
  const lastRow = sheet.getLastRow();

  // 데이터 행이 있으면 A열(날짜) 스캔
  let existingRow = 0;
  if (lastRow >= 2) {
    const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      if (String(dates[i][0]) === today) {
        existingRow = i + 2; // 1-based + 헤더
        break;
      }
    }
  }

  const row = [today, hhmmss, ...results.map(r => r.value)];
  const targetRow = existingRow || (lastRow + 1);
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
}
