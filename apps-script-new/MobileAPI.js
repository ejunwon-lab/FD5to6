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

    // 펀드·예금·보험·기타는 종목 리스트에서 제외 (KIS API 미지원·시세 무관)
    const posRows = posSheet.getLastRow() >= 2
      ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 23).getValues()
          .filter(r =>
            String(r[1]) !== '합계' &&
            String(r[0]) !== '합계' &&
            Number(r[6]) > 0 &&
            !NS.KIS_SKIP.includes(String(r[2]).trim()))
      : [];

    // ⚠️ 합계행은 r[0]='합계' / r[2]=''(빈 종목명). r[0] 기준으로 필터해야 합계행 제외됨
    const pnlRows = (pnlSheet && pnlSheet.getLastRow() >= 2)
      ? pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
          .filter(r => r[0] && String(r[0]) !== '합계')
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

    // *추이 기록* 최신 행에서 AH/AI(거래일 캐시) + AJ/AK(전일 백업) 읽기
    let dayChangAmountOut  = dayChange;
    let dayChangePctOut    = (dayPct >= 0 ? '+' : '') + dayPct.toFixed(2) + '%';
    let prevDayChangAmount = null;
    let prevDayChangePct   = null;
    try {
      const trendSht = ss.getSheetByName(NS.TREND);
      if (trendSht && trendSht.getLastRow() >= 2) {
        // pCol 감지: U열(col 21) 5~50행 날짜 문자열 검사 (_updateNewTrend와 동일 로직)
        const chkMax = Math.min(trendSht.getLastRow(), 50);
        const useOldC = chkMax >= 5 && trendSht.getRange(5, 21, chkMax - 4, 1).getValues()
          .some(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[0])));
        const pCol = useOldC ? 21 : 1;
        // row 2 스냅샷 읽기 (항상 최신값)
        const tr       = trendSht.getRange(2, pCol, 1, 17).getValues()[0];
        const toN      = v => { const n = Number(String(v == null ? '' : v).replace(/,/g, '').replace('%', '')); return isNaN(n) ? 0 : n; };
        const fmtD     = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
        // row 2가 비어있으면(초기 배포 직후) 현장 계산값 그대로 사용
        if (tr[0] !== '' && tr[0] != null) {
          const _now2    = new Date();
          const _dow2    = _now2.getDay();
          const isNT     = _dow2 === 0 || _dow2 === 6 || _isKoreanHoliday(_now2);
          const hasCache = tr[13] !== '' && tr[13] !== null && tr[13] !== undefined;
          if (isNT && hasCache) {
            dayChangAmountOut = toN(tr[13]);       // AH: 마지막 거래일 diff 캐시
            dayChangePctOut   = fmtD(toN(tr[14])); // AI
          }
          if (tr[15] !== '' && tr[15] != null) {
            prevDayChangAmount = toN(tr[15]);        // AJ: 전일 diff 백업
            prevDayChangePct   = fmtD(toN(tr[16])); // AK
          }
        }
      }
    } catch (_) {}

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
      dayChangAmount:  dayChangAmountOut,
      dayChangePct:    dayChangePctOut,
      prevDayChangAmount,
      prevDayChangePct,
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
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    return JSON.stringify({ success: false, error: '이미 업데이트 진행 중입니다. 잠시 후 다시 시도해주세요.' });
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateFxRates(ss);
    updateNewCurrentPrice(ss);
    updatePositionFromLedger();
    return newMobileGetPortfolio();
  } catch (e) {
    Logger.log('newMobileUpdateCurrentPrice 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════
//  히스토리 갱신 (1M~1Y 포함, 1~2분 소요)
// ══════════════════════════════════════════════════════

function newMobileUpdateHistory() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    return JSON.stringify({ success: false, error: '이미 업데이트 진행 중입니다. 잠시 후 다시 시도해주세요.' });
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateFxRates(ss);
    updateNewStockHistory(ss);
    updatePositionFromLedger();
    return newMobileGetPortfolio();
  } catch (e) {
    Logger.log('newMobileUpdateHistory 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════
//  전체 갱신 (환율 + 현재가 + 보유현황)
// ══════════════════════════════════════════════════════

function newMobileUpdateAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    return JSON.stringify({ success: false, error: '이미 업데이트 진행 중입니다. 잠시 후 다시 시도해주세요.' });
  }
  try {
    updateAllNew();
    return newMobileGetPortfolio();
  } catch (e) {
    Logger.log('newMobileUpdateAll 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════
//  참고지표 정의 (구시스템 동일)
// ══════════════════════════════════════════════════════

const NEW_REFERENCE_INDICATORS = [
  { key: 'KOSPI',  name: 'KOSPI',  category: '한국시장', source: 'kis_domestic_index', code: '0001' },
  { key: 'KOSDAQ', name: 'KOSDAQ', category: '한국시장', source: 'kis_domestic_index', code: '1001' },
  { key: 'K200F',  name: 'KOSPI200', category: '한국선물', source: 'kis_domestic_index', code: '2001' },
  { key: 'SPX', name: 'S&P500',        category: '미국시장', source: 'kis_overseas_index', code: 'SPX', excd: 'NYS', gfSymbol: 'INDEXSP:.INX' },
  { key: 'NDX', name: 'NASDAQ100',     category: '미국시장', source: 'kis_overseas_index', code: 'NDX', excd: 'NAS', gfSymbol: 'INDEXNASDAQ:NDX' },
  { key: 'DJI', name: '다우존스',       category: '미국시장', source: 'kis_overseas_index', code: 'DJI', excd: 'NYS', gfSymbol: 'INDEXDJX:.DJI' },
  { key: 'SOX', name: '필라델피아반도체', category: 'AI/반도체', source: 'kis_overseas_index', code: 'SOX', excd: 'NAS', gfSymbol: 'NASDAQ:SOXX', ySymbol: '^SOX' },
  { key: 'ES', name: 'S&P500선물',  category: '미국선물', source: 'yahoo_finance', ySymbol: 'ES=F',  gfSymbol: 'INDEXSP:.INX' },
  { key: 'NQ', name: 'NASDAQ선물',  category: '미국선물', source: 'yahoo_finance', ySymbol: 'NQ=F',  gfSymbol: 'INDEXNASDAQ:NDX' },
  { key: 'GC', name: '금',      category: '상품', source: 'yahoo_finance', ySymbol: 'GC=F',  gfSymbol: 'COMEX:GC1!' },
  { key: 'CL', name: 'WTI원유', category: '상품', source: 'yahoo_finance', ySymbol: 'CL=F',  gfSymbol: 'NYMEX:CL1!' },
  { key: 'VIX', name: 'VIX',       category: '매크로', source: 'googlefinance', gfSymbol: 'INDEXCBOE:VIX' },
  { key: 'TNX', name: '미국10년물', category: '매크로', source: 'googlefinance', gfSymbol: 'TNX' },
  { key: 'DXY', name: '달러인덱스', category: '매크로', source: 'yahoo_finance', ySymbol: 'DX-Y.NYB', gfSymbol: 'CURRENCYCOM:DXY' },
  { key: 'NVDA', name: 'NVIDIA',     category: 'AI/반도체', source: 'yahoo_finance', ySymbol: 'NVDA',  gfSymbol: 'NASDAQ:NVDA' },
  { key: 'AAPL', name: 'Apple',     category: '빅테크', source: 'yahoo_finance', ySymbol: 'AAPL',  gfSymbol: 'NASDAQ:AAPL' },
  { key: 'MSFT', name: 'Microsoft', category: '빅테크', source: 'yahoo_finance', ySymbol: 'MSFT',  gfSymbol: 'NASDAQ:MSFT' },
  { key: 'GOOGL', name: 'Google',   category: '빅테크', source: 'yahoo_finance', ySymbol: 'GOOGL', gfSymbol: 'NASDAQ:GOOGL' },
  { key: 'META', name: 'Meta',      category: '빅테크', source: 'yahoo_finance', ySymbol: 'META',  gfSymbol: 'NASDAQ:META' },
  { key: 'AMZN', name: 'Amazon',    category: '빅테크', source: 'yahoo_finance', ySymbol: 'AMZN',  gfSymbol: 'NASDAQ:AMZN' },
  { key: 'TSLA', name: 'Tesla',     category: '빅테크', source: 'yahoo_finance', ySymbol: 'TSLA',  gfSymbol: 'NASDAQ:TSLA' },
  { key: 'HSI', name: '항셍지수', category: '중국시장', source: 'yahoo_finance', ySymbol: '^HSI', gfSymbol: 'INDEXHANGSENG:HSI' },
];

// ══════════════════════════════════════════════════════
//  참고지표 조회 (KIS API + Yahoo Finance + GOOGLEFINANCE)
// ══════════════════════════════════════════════════════

function newMobileGetIndicators() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    KIS_API.ensureToken();

    const summarySheet = _newEnsureIndicatorsSheet(ss);
    const historySheet = _newEnsureIndicatorsHistorySheet(ss);

    const tz        = 'Asia/Seoul';
    const now       = new Date();
    const updatedAt = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
    const today     = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    const hhmmss    = Utilities.formatDate(now, tz, 'HH:mm:ss');

    const results = [];
    for (const def of NEW_REFERENCE_INDICATORS) {
      let info = null;
      try {
        if (def.source === 'kis_domestic_index') {
          info = KIS_API.getDomesticIndex(def.code);
        } else if (def.source === 'kis_overseas_index') {
          info = KIS_API.getOverseasIndex(def.code, def.excd || 'NAS');
        } else if (def.source === 'kis_domestic_futures') {
          info = KIS_API.getDomesticFutures(def.code);
        } else if (def.source === 'yahoo_finance') {
          info = _newGetYahooFinanceQuote(def.ySymbol);
        }
      } catch (e) {
        Logger.log(`지표 ${def.key} 조회 오류: ${e}`);
      }
      results.push({
        key: def.key, name: def.name, category: def.category,
        value:     info ? info.value     : 0,
        change:    info ? info.change    : 0,
        changePct: info ? info.changePct : 0,
        source:    def.source,
        gfSymbol:  def.gfSymbol || '',
        ySymbol:   def.ySymbol  || '',
      });
    }

    _newFillGoogleFinanceIndicators(ss, results);
    _newFillMissingWithYahooFinance(results);
    _newFillMissingWithGoogleFinance(ss, results);

    // 참고지표 시트 업데이트
    summarySheet.getRange(1, 1, 1, 7).setValues([['키','지표명','카테고리','현재값','등락','등락률(%)','갱신시간']]);
    if (results.length > 0) {
      summarySheet.getRange(2, 1, results.length, 7).setValues(
        results.map(r => [r.key, r.name, r.category, r.value, r.change, r.changePct, updatedAt])
      );
    }
    _newUpsertIndicatorsHistory(historySheet, today, hhmmss, results);
    SpreadsheetApp.flush();

    return JSON.stringify({
      success: true,
      updatedAt,
      indicators: results.map(r => ({
        key: r.key, name: r.name, category: r.category,
        value: r.value, change: r.change, changePct: r.changePct,
      })),
    });
  } catch (e) {
    Logger.log('newMobileGetIndicators 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  수익 히스토리 (*현재가_이력* 기반 근사 계산)
//  현재 보유수량 × 과거 가격으로 포트폴리오 가치 추산
// ══════════════════════════════════════════════════════

function newMobileGetProfitHistory() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(NS.TREND);
    if (!sheet || sheet.getLastRow() < 1) return JSON.stringify({ success: true, entries: [] });

    const toNum = v => {
      if (v === '' || v == null) return 0;
      const n = Number(String(v).replace(/,/g, '').replace('%', ''));
      return isNaN(n) ? 0 : n;
    };
    const toDate = v => v instanceof Date
      ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(v).slice(0, 10);
    const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(toDate(v));

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // 구시스템 그대로 붙여넣기: col U(idx 20)에 날짜 + col AD(idx 29)에 합계수익
    const useOldLayout = lastCol >= 30 &&
      sheet.getRange(1, 21, Math.min(lastRow, 20), 1).getValues().some(r => isDate(r[0]));

    let entries;
    if (useOldLayout) {
      const data = sheet.getRange(1, 21, lastRow, 10).getValues(); // U~AD
      entries = data
        .filter(row => isDate(row[0]))
        .map(row => ({ date: toDate(row[0]), totalProfit: toNum(row[9]) }));
    } else {
      // 신규 기록 or col A=날짜 직접 붙여넣기: col A(idx 0) + col J(idx 9) or col B(idx 1)
      const readCols = Math.min(lastCol, 10);
      const data     = sheet.getRange(1, 1, lastRow, readCols).getValues();
      const profitIdx = readCols >= 10 ? 9 : 1;
      entries = data
        .filter(row => isDate(row[0]))
        .map(row => ({ date: toDate(row[0]), totalProfit: toNum(row[profitIdx]) }));
    }

    return JSON.stringify({ success: true, entries: entries.slice(-180) });
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

function _isKoreanHoliday(date) {
  const dateStr = Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd');
  const HOLIDAYS = [
    // 2025
    '2025-01-01',
    '2025-01-28', '2025-01-29', '2025-01-30',
    '2025-03-01', '2025-05-01', '2025-05-05', '2025-06-06',
    '2025-08-15',
    '2025-10-03', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-09',
    '2025-12-25',
    // 2026
    '2026-01-01',
    '2026-02-16', '2026-02-17', '2026-02-18',
    '2026-03-01', '2026-03-02',
    '2026-05-01',
    '2026-05-05',
    '2026-05-25',
    '2026-06-06',
    '2026-08-15',
    '2026-10-03',
    '2026-10-09',
    '2026-12-25',
    '2026-12-31',
  ];
  return HOLIDAYS.includes(dateStr);
}

function _mIsMarketDay() {
  const now     = new Date();
  const tz      = 'Asia/Seoul';
  const weekday = parseInt(Utilities.formatDate(now, tz, 'u')); // 1=월, 7=일
  if (weekday >= 6) return false;
  if (_isKoreanHoliday(now)) return false;
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

// ── 참고지표 헬퍼 ────────────────────────────────────────

function _newGetYahooFinanceQuote(symbol) {
  if (!symbol) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
    const res = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoogleAppsScript)' },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return null;
    const meta = JSON.parse(res.getContentText())?.chart?.result?.[0]?.meta;
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

function _newFillGoogleFinanceIndicators(ss, results) {
  const gfItems = results.filter(r => r.source === 'googlefinance');
  if (gfItems.length === 0) return;
  let tempSheet = ss.getSheetByName('Temp');
  if (!tempSheet) { tempSheet = ss.insertSheet('Temp'); tempSheet.hideSheet(); }
  const START_COL = 27, START_ROW = 1;
  const formulas = gfItems.map(item => [
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","price"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","change"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","changepct"),"")`,
  ]);
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).setFormulas(formulas);
  SpreadsheetApp.flush();
  Utilities.sleep(1500);
  const values = tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).getValues();
  gfItems.forEach((item, idx) => {
    const v = values[idx];
    const price = Number(v[0]) || 0;
    if (price > 0) {
      const divisor = item.key === 'TNX' ? 10 : 1;
      item.value     = price / divisor;
      item.change    = (Number(v[1]) || 0) / divisor;
      item.changePct = Number(v[2]) || 0;
    }
  });
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).clearContent();
}

function _newFillMissingWithYahooFinance(results) {
  results.filter(r => (!r.value || r.value <= 0) && r.ySymbol).forEach(item => {
    const q = _newGetYahooFinanceQuote(item.ySymbol);
    if (q && q.value > 0) { item.value = q.value; item.change = q.change; item.changePct = q.changePct; }
  });
}

function _newFillMissingWithGoogleFinance(ss, results) {
  const missing = results.filter(r => r.source !== 'googlefinance' && (!r.value || r.value <= 0) && r.gfSymbol);
  if (missing.length === 0) return;
  let tempSheet = ss.getSheetByName('Temp');
  if (!tempSheet) { tempSheet = ss.insertSheet('Temp'); tempSheet.hideSheet(); }
  const START_COL = 31, START_ROW = 1;
  const formulas = missing.map(item => [
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","price"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","change"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","changepct"),"")`,
  ]);
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).setFormulas(formulas);
  SpreadsheetApp.flush();
  Utilities.sleep(1500);
  const values = tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).getValues();
  missing.forEach((item, idx) => {
    const price = Number(values[idx][0]) || 0;
    if (price > 0) { item.value = price; item.change = Number(values[idx][1]) || 0; item.changePct = Number(values[idx][2]) || 0; }
  });
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).clearContent();
}

function _newEnsureIndicatorsSheet(ss) {
  let sheet = ss.getSheetByName('참고지표');
  if (!sheet) {
    sheet = ss.insertSheet('참고지표');
    sheet.getRange(1, 1, 1, 7).setValues([['키','지표명','카테고리','현재값','등락','등락률(%)','갱신시간']])
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _newEnsureIndicatorsHistorySheet(ss) {
  let sheet = ss.getSheetByName('참고지표_히스토리');
  if (!sheet) {
    sheet = ss.insertSheet('참고지표_히스토리');
    const header = ['날짜', '시간', ...NEW_REFERENCE_INDICATORS.map(d => d.name)];
    sheet.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _newUpsertIndicatorsHistory(sheet, today, hhmmss, results) {
  const lastRow = sheet.getLastRow();
  let existingRow = 0;
  if (lastRow >= 2) {
    const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      if (String(dates[i][0]) === today) { existingRow = i + 2; break; }
    }
  }
  const row = [today, hhmmss, ...results.map(r => r.value)];
  sheet.getRange(existingRow || (lastRow + 1), 1, 1, row.length).setValues([row]);
}
