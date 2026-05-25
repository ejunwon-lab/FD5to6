/**
 * MobileAPI.js (신시스템 v2) — iOS 뉴FD7 / 웹앱 진입점
 *
 * 모든 함수는 JSON.stringify 된 문자열 반환 (GAS scripts.run API 특성상)
 *
 * 신 *보유현황* 15컬럼 구조:
 *  [0]종목코드 [1]종목명 [2]분류 [3]증권사 [4]계좌 [5]보유기간 [6]수량
 *  [7]평균단가 [8]매입금액 [9]현재단가 [10]평가금액 [11]손익 [12]수익률
 *  [13]수동평가금액 [14]비고
 *
 * 누락 필드(change/m1/m3/m6/y1/high52/low52)는 *현재가_이력*에서 직접 계산.
 */

// ══════════════════════════════════════════════════════
//  포트폴리오 읽기 (앱 실행 시 즉시 호출)
// ══════════════════════════════════════════════════════
function newMobileGetPortfolio() {
  try {
    const ss       = SpreadsheetApp.getActiveSpreadsheet();
    const posSheet = ss.getSheetByName(NS.POSITION);
    const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);
    const priceHistSheet = ss.getSheetByName(NS.PRICE_HISTORY);
    const ledgerSheet    = ss.getSheetByName(NS.LEDGER);

    if (!posSheet) {
      return JSON.stringify({ success: false, error: '*보유현황* 없음. updatePositionFromLedger 먼저 실행하세요.' });
    }

    // 전체 보유 (summary 계산용 — KIS_SKIP 포함)
    const allPosRows = posSheet.getLastRow() >= 2
      ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 15).getValues()
          .filter(r =>
            String(r[1]) !== '합계' &&
            String(r[0]) !== '합계' &&
            Number(r[6]) > 0)
      : [];
    // KIS 종목만 (holdings/byCategory/byAccount용 — 펀드·예금·보험·기타 제외)
    const posRows = allPosRows.filter(r => !NS.KIS_SKIP.includes(String(r[2]).trim()));

    const pnlRows = (pnlSheet && pnlSheet.getLastRow() >= 2)
      ? pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
          .filter(r => r[0] && String(r[0]) !== '합계')
      : [];

    const buyDateMap = _mGetBuyDates(ss);
    const fx         = _mGetFxRates(ss);
    const metrics    = _readStockMetrics(ss);

    const holdings = posRows.map(r => _mMapHolding(r, buyDateMap, metrics));

    // ── 요약 계산 (전체 보유 기준 — KIS_SKIP 포함, *추이 기록* 운용중과 동일 정의) ──
    const totalBuy = allPosRows.reduce((s, r) => s + (Number(r[8])  || 0), 0);
    const totalCur = allPosRows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
    const opProfit = totalCur - totalBuy;
    const opRate   = totalBuy > 0 ? opProfit / totalBuy * 100 : 0;

    const cfProfit = pnlRows.reduce((s, r) => s + (Number(r[12]) || 0), 0);
    const cfBuy    = pnlRows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
    const cfRate   = cfBuy > 0 ? cfProfit / cfBuy * 100 : 0;

    // trendTotalProfit은 *추이 기록*의 최신값(AD2)을 우선 사용
    // prevDayChang* 은 *추이 기록* U열에서 "어제 거래일" 행을 직접 찾아 AE/AF 사용
    //   → AJ2/AK2 백업 의존 제거 (백업 갱신 시점 한계로 잘못된 값 표시되던 버그 수정)
    let totProfit = opProfit + cfProfit;
    let prevDayChangAmount = null;
    let prevDayChangePct   = null;
    const trendSht = ss.getSheetByName(NS.TREND);
    if (trendSht && trendSht.getLastRow() >= 2) {
      const ad2 = trendSht.getRange(2, 30).getValue();  // AD2 = 합계 수익 최신
      const adN = Number(String(ad2 || '').replace(/,/g, ''));
      if (!isNaN(adN) && adN !== 0) totProfit = adN;

      const prev = _mFindPrevDayProfitChange(trendSht);
      prevDayChangAmount = prev.amount;
      prevDayChangePct   = prev.pct;
    }
    const totRate   = totalBuy > 0 ? totProfit / totalBuy * 100 : 0;

    // ── 오늘 수익 (*종목지표*의 행별 당일손익 합산) ──
    let dayChange = 0;
    posRows.forEach(r => {
      const key = _normCode(String(r[0])) + '||' + String(r[3] || '') + '||' + String(r[4] || '');
      const ex = metrics.get(key);
      if (ex && ex.todayPnl != null) dayChange += ex.todayPnl;
    });
    const prevCur = totalCur - dayChange;
    const dayPct  = prevCur > 0 ? dayChange / prevCur * 100 : 0;

    const isMarketDay  = _mIsMarketDay();
    const isTradingDay = _mIsTradingDay();

    // priceAsOfDate = *현재가_이력*의 마지막 '거래일' 행 날짜 (클라이언트 라벨 결정용).
    // 비거래일 행이 잘못 누적돼 있어도 건너뛰고 마지막 거래일 날짜를 찾음.
    let priceAsOfDate = null;
    if (priceHistSheet && priceHistSheet.getLastRow() >= 2) {
      const lastRow = priceHistSheet.getLastRow();
      const scanN   = Math.min(lastRow - 1, 15);
      const dcol    = priceHistSheet.getRange(lastRow - scanN + 1, 1, scanN, 1).getValues();
      for (let i = dcol.length - 1; i >= 0; i--) {
        const raw = dcol[i][0];
        const d = raw instanceof Date
          ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
          : String(raw).slice(0, 10);
        if (_isTradingDateStr(d)) { priceAsOfDate = d; break; }
      }
    }

    const summary = {
      totalBuy,
      totalCurrent:          totalCur,
      totalProfit:           opProfit,
      profitRate:            opRate,
      trendTotalProfit:      totProfit,
      totalProfitRate:       totRate,
      confirmedProfit:       cfProfit,
      confirmedProfitRate:   cfRate,
      trendOperatingProfit:  opProfit,
      operatingProfitRate:   opRate,
      dayChangAmount:        Math.round(dayChange),
      dayChangePct:          (dayPct >= 0 ? '+' : '') + dayPct.toFixed(2) + '%',
      prevDayChangAmount,
      prevDayChangePct,
      isMarketDay,
      isTradingDay,
      priceAsOfDate,
    };

    const byCategory = _mGroupBy(posRows, 2, totalCur);
    const byAccount  = _mGroupBy(posRows, 4, totalCur);
    const cashReserve = _mGetCashReserve(ss);

    return JSON.stringify({
      success: true,
      updatedAt: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      usdRate: fx.usd,
      gbpRate: fx.gbp,
      summary,
      byCategory,
      byAccount,
      holdings,
      cashReserve,
    });
  } catch (e) {
    Logger.log('newMobileGetPortfolio 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  현재가 갱신 (빠른 갱신)
// ══════════════════════════════════════════════════════
function newMobileUpdateCurrentPrice() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    return JSON.stringify({ success: false, error: '이미 업데이트 진행 중입니다. 잠시 후 다시 시도해주세요.' });
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateFxRates(ss);
    updateNewPriceHistory(ss);
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
//  히스토리 갱신 (신시스템은 *현재가_이력* 누적이므로 가격 갱신과 동일)
// ══════════════════════════════════════════════════════
function newMobileUpdateHistory() {
  return newMobileUpdateCurrentPrice();
}

// ══════════════════════════════════════════════════════
//  전체 갱신 (환율 + 가격 + 보유현황 + 대시보드)
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
//  종목 상세
// ══════════════════════════════════════════════════════
function newMobileGetStockDetail(code) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const normCode = _normCode(code);

    const posSheet = ss.getSheetByName(NS.POSITION);
    const priceHistSheet = ss.getSheetByName(NS.PRICE_HISTORY);
    const ledgerSheet    = ss.getSheetByName(NS.LEDGER);

    // 1) 보유 정보 (브로커·계좌별 합산) + 52주 (전체 가격 시계열에서 계산)
    let stockName = '', stockCategory = '';
    const positions = [];

    const priceColInfo = priceHistSheet ? _mFindPriceColumn(priceHistSheet, normCode) : null;
    let high52 = 0, low52 = 0;
    if (priceColInfo) {
      const { prices } = priceColInfo;
      const valid = prices.filter(p => p > 0);
      if (valid.length > 0) {
        high52 = Math.max(...valid);
        low52  = Math.min(...valid);
      }
    }

    if (posSheet && posSheet.getLastRow() >= 2) {
      const rows = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 15).getValues();
      rows.forEach(r => {
        if (_normCode(String(r[0])) !== normCode) return;
        if (Number(r[6]) <= 0) return;
        stockName     = String(r[1]);
        stockCategory = String(r[2]);
        positions.push({
          broker:       String(r[3]),
          accountType:  String(r[4]),
          quantity:     Number(r[6])  || 0,
          avgPrice:     Number(r[7])  || 0,
          buyAmount:    Number(r[8])  || 0,
          currentPrice: Number(r[9])  || 0,
          opCurrent:    Number(r[10]) || 0,
          opProfit:     Number(r[11]) || 0,
          profitRate:   Number(r[12]) || 0,
          high52, low52,
        });
      });
    }

    // 2) 거래 이력
    const transactions = [];
    if (ledgerSheet && ledgerSheet.getLastRow() >= 2) {
      const rows = ledgerSheet.getRange(2, 1, ledgerSheet.getLastRow() - 1, 12).getValues();
      rows.forEach(r => {
        if (_normCode(String(r[2])) !== normCode) return;
        const date = r[0] instanceof Date
          ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd')
          : String(r[0]).slice(0, 10);
        if (!stockName)     stockName     = String(r[3] || '');
        if (!stockCategory) stockCategory = String(r[4] || '');
        transactions.push({
          date,
          type:        String(r[1]),
          broker:      String(r[5]),
          accountType: String(r[6]),
          quantity:    Number(r[7])  || 0,
          price:       Number(r[8])  || 0,
          amount:      Number(r[9])  || 0,
          fee:         Number(r[10]) || 0,
        });
      });
      transactions.sort((a, b) => a.date.localeCompare(b.date));
    }

    // 3) 가격 시계열
    const priceHistory = [];
    if (priceColInfo) {
      const { dates, prices } = priceColInfo;
      for (let i = 0; i < dates.length; i++) {
        if (dates[i].length === 10 && prices[i] > 0) {
          priceHistory.push({ date: dates[i], price: prices[i] });
        }
      }
    }

    // 4) 통계
    const buyTx  = transactions.filter(t => t.type === '매수');
    const sellTx = transactions.filter(t => t.type === '매도');
    const totalQty   = positions.reduce((s, p) => s + p.quantity, 0);
    const totalBuy   = positions.reduce((s, p) => s + p.buyAmount, 0);
    const totalCur   = positions.reduce((s, p) => s + p.opCurrent, 0);
    const totalProfit= positions.reduce((s, p) => s + p.opProfit, 0);
    const overallRate = totalBuy > 0 ? totalProfit / totalBuy * 100 : 0;

    return JSON.stringify({
      success: true,
      code: String(code),
      name: stockName,
      category: stockCategory,
      positions,
      summary: {
        totalQuantity:     totalQty,
        totalBuyAmount:    totalBuy,
        totalCurrentValue: totalCur,
        totalProfit,
        profitRate:        overallRate,
      },
      transactions,
      priceHistory,
      stats: {
        transactionCount:    transactions.length,
        buyCount:            buyTx.length,
        sellCount:           sellTx.length,
        firstBuyDate:        buyTx[0] ? buyTx[0].date : null,
        lastTransactionDate: transactions.length > 0 ? transactions[transactions.length - 1].date : null,
      },
    });
  } catch (e) {
    Logger.log('newMobileGetStockDetail 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  월별 실현손익 (*실현손익* 시트)
// ══════════════════════════════════════════════════════
function newMobileGetMonthlyRealized() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);
    if (!pnlSheet || pnlSheet.getLastRow() < 2) {
      return JSON.stringify({ success: true, monthly: [] });
    }
    const rows = pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
      .filter(r => r[0] && String(r[0]) !== '합계');

    const map = {};
    rows.forEach(r => {
      const m = String(r[0]).slice(0, 7);
      if (!map[m]) map[m] = { month: m, count: 0, winCount: 0, profit: 0, buyAmount: 0 };
      const p   = Number(r[12]) || 0;
      const buy = Number(r[10]) || 0;
      map[m].count++;
      map[m].profit    += p;
      map[m].buyAmount += buy;
      if (p > 0) map[m].winCount++;
    });
    const monthly = Object.keys(map).sort().map(m => ({
      month:      m,
      count:      map[m].count,
      winCount:   map[m].winCount,
      profit:     map[m].profit,
      profitRate: map[m].buyAmount > 0 ? map[m].profit / map[m].buyAmount * 100 : 0,
      winRate:    map[m].count > 0 ? map[m].winCount / map[m].count * 100 : 0,
    }));
    return JSON.stringify({ success: true, monthly });
  } catch (e) {
    Logger.log('newMobileGetMonthlyRealized 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  수익 히스토리 (*추이 기록* 시트 U열(날짜) + AD열(합계 수익))
//  - 구시스템 동일 컬럼 매핑
//  - 행 5부터 데이터 (행 2는 최신 스냅샷)
// ══════════════════════════════════════════════════════
function newMobileGetProfitHistory() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const trend = ss.getSheetByName(NS.TREND);
    if (!trend || trend.getLastRow() < 5) return JSON.stringify({ success: true, entries: [] });

    const pFirstRow = 5, pStartCol = 21;  // U
    const lastRow   = trend.getLastRow();
    const height    = lastRow - pFirstRow + 1;
    if (height <= 0) return JSON.stringify({ success: true, entries: [] });

    const data = trend.getRange(pFirstRow, pStartCol, height, 10).getValues();  // U~AD (10컬럼)
    const toN = v => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(String(v).replace(/,/g, '').replace('%', ''));
      return isNaN(n) ? 0 : n;
    };
    const toDateStr = v => {
      if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
      const s = String(v || '');
      const m = s.match(/^\d{4}-\d{2}-\d{2}/);
      return m ? m[0] : '';
    };

    const entries = [];
    for (const row of data) {
      const d = toDateStr(row[0]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      entries.push({ date: d, totalProfit: toN(row[9]) });   // AD = idx 9
    }
    return JSON.stringify({ success: true, entries: entries.slice(-180) });
  } catch (e) {
    Logger.log('newMobileGetProfitHistory 오류: ' + e);
    return JSON.stringify({ success: true, entries: [] });
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
//  내부 헬퍼
// ══════════════════════════════════════════════════════

// *현재가_이력*에서 종목별 확장 지표 계산
// 반환: Map<normCode, { change, changePct, m1, m3, m6, y1, high52, low52 }>
// _mCalcExtras 는 StockMetrics.js 의 computeStockMetrics 로 통합 (*종목지표* 시트).
// newMobileGetPortfolio 는 _readStockMetrics() 로 읽는다.

// *현재가_이력*에서 특정 종목의 가격 시계열 추출 → { dates, prices }
function _mFindPriceColumn(priceHistSheet, normCode) {
  if (!priceHistSheet || priceHistSheet.getLastRow() < 2 || priceHistSheet.getLastColumn() < 2) return null;
  const lastRow = priceHistSheet.getLastRow();
  const lastCol = priceHistSheet.getLastColumn();
  const headers = priceHistSheet.getRange(1, 2, 1, lastCol - 1).getValues()[0]
    .map(c => _normCode(String(c)));
  const colIdx = headers.indexOf(normCode);
  if (colIdx < 0) return null;
  const dataCol = colIdx + 2;
  const datesRaw = priceHistSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const dates = datesRaw.map(r => {
    const raw = r[0];
    return raw instanceof Date
      ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(raw).slice(0, 10);
  });
  const prices = priceHistSheet.getRange(2, dataCol, lastRow - 1, 1).getValues()
    .map(r => Number(r[0]) || 0);
  return { dates, prices };
}

function _mMapHolding(r, buyDateMap, metrics) {
  const code   = String(r[0] || '');
  const name   = String(r[1] || '');
  const broker = String(r[3] || '');
  const acct   = String(r[4] || '');
  const key    = code + '||' + name + '||' + broker + '||' + acct;
  const metricKey = _normCode(code) + '||' + broker + '||' + acct;
  const ex     = metrics.get(metricKey) || {};
  const change    = ex.change    != null ? ex.change    : 0;
  const changePct = ex.changePct != null ? ex.changePct : 0;

  return {
    code,
    name,
    category:     String(r[2] || ''),
    broker,
    accountType:  acct,
    quantity:     Number(r[6])  || 0,
    buyPrice:     Number(r[7])  || 0,
    currentPrice: Number(r[9])  || 0,
    opBuy:        Number(r[8])  || 0,
    opCurrent:    Number(r[10]) || 0,
    opProfit:     Number(r[11]) || 0,
    profitRate:   Number(r[12]) || 0,
    change,
    changePct:    (changePct >= 0 ? '+' : '') + Number(changePct).toFixed(2) + '%',
    m1:           ex.m1Pct != null ? Number(ex.m1Pct) : 0,
    m3:           ex.m3Pct != null ? Number(ex.m3Pct) : 0,
    m6:           ex.m6Pct != null ? Number(ex.m6Pct) : 0,
    y1:           ex.y1Pct != null ? Number(ex.y1Pct) : 0,
    high52:       Number(ex.high52) || 0,
    low52:        Number(ex.low52)  || 0,
    buyDate:      buyDateMap[key] || null,
  };
}

function _mGetBuyDates(ss) {
  const result = {};
  const ledger = ss.getSheetByName(NS.LEDGER);
  if (!ledger || ledger.getLastRow() < 2) return result;

  const rows = ledger.getRange(2, 1, ledger.getLastRow() - 1, 12).getValues();
  const posMap = {};
  for (const row of rows) {
    const type = String(row[1]);
    if (type !== '매수' && type !== '매도') continue;
    const date = row[0] instanceof Date
      ? Utilities.formatDate(row[0], 'Asia/Seoul', 'yyyy-MM-dd')
      : String(row[0]).slice(0, 10);
    const code   = String(row[2] || '');
    const name   = String(row[3] || '');
    const broker = String(row[5] || '');
    const acct   = String(row[6] || '');
    const qty    = Number(row[7]) || 0;
    const key    = code + '||' + name + '||' + broker + '||' + acct;
    if (!posMap[key]) posMap[key] = { qty: 0, firstDate: '' };
    const p = posMap[key];
    if (type === '매수') {
      if (p.qty <= 0) p.firstDate = date;
      p.qty += qty;
    } else {
      p.qty -= qty;
    }
  }
  Object.entries(posMap).forEach(([k, v]) => {
    if (v.qty > 0.0001) result[k] = v.firstDate;
  });
  return result;
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

/**
 * *설정* 시트 A7:E12 — 사용자 수동 입력 대기자금
 *   A:증권사  B:구분  C:대기자금  D:비고  E:업데이트 날짜(자동 스탬프)
 * 합계는 코드에서 자체 계산 (시트 C13 SUM 수식과 일치해야 함).
 */
function _mGetCashReserve(ss) {
  try {
    const sheet = ss.getSheetByName(NS.SETTINGS);
    if (!sheet) return { items: [], total: 0 };
    const range = sheet.getRange(7, 1, 6, 5).getValues();
    const items = [];
    let total = 0;
    for (const row of range) {
      const broker  = String(row[0] || '').trim();
      const account = String(row[1] || '').trim();
      const amount  = Number(row[2]) || 0;
      const note    = String(row[3] || '').trim();
      const stamp   = row[4];
      if (!broker && !account && amount === 0) continue;
      items.push({
        broker, account, amount, note,
        updatedAt: stamp instanceof Date
          ? Utilities.formatDate(stamp, 'Asia/Seoul', 'yyyy-MM-dd HH:mm')
          : String(stamp || ''),
      });
      total += amount;
    }
    return { items, total };
  } catch (e) {
    Logger.log('_mGetCashReserve 오류: ' + e);
    return { items: [], total: 0 };
  }
}

// *추이 기록* U열에서 "어제 거래일" 행을 찾아 AE(합계 변동)/AF(합계 변동률) 반환
// 어제 거래일 = (오늘 - 1일)에서 주말/공휴일을 건너뛴 가장 가까운 평일
// 매칭 행 없으면 null (클라이언트는 0원으로 fallback)
function _mFindPrevDayProfitChange(trendSht) {
  if (!trendSht || trendSht.getLastRow() < 5) return { amount: null, pct: null };

  const pFirstRow = 5, pStartCol = 21;  // U
  const lastRow = trendSht.getLastRow();
  const height = lastRow - pFirstRow + 1;
  if (height <= 0) return { amount: null, pct: null };

  const today = new Date();
  let target = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  for (let safety = 0; safety < 14; safety++) {
    if (target.getDay() !== 0 && target.getDay() !== 6 && !_isKoreanHoliday(target)) break;
    target.setDate(target.getDate() - 1);
  }
  const targetStr = Utilities.formatDate(target, 'Asia/Seoul', 'yyyy-MM-dd');

  const data = trendSht.getRange(pFirstRow, pStartCol, height, 12).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    const dStr = String(data[i][0] || '').slice(0, 10);
    if (dStr === targetStr) {
      const ae = data[i][10];  // AE = idx 10 (합계 변동)
      const af = data[i][11];  // AF = idx 11 (합계 변동률)
      const aeN = Number(String(ae || '').replace(/,/g, ''));
      const afS = String(af || '').trim();
      return {
        amount: isNaN(aeN) ? null : aeN,
        pct: afS ? ((afS.startsWith('+') || afS.startsWith('-')) ? afS : '+' + afS) : null
      };
    }
  }
  return { amount: null, pct: null };
}

// _isKoreanHoliday(date) 는 Holidays.js 로 이동 (*휴장일* 시트 단일 소스)

// 'yyyy-MM-dd' 문자열이 거래일(주말·공휴일 아님)인지 판정
function _isTradingDateStr(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split('-');
  // 정오로 생성 → 스크립트 TZ가 Asia/Seoul이 아니어도 날짜가 밀리지 않음
  const d  = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
  const wd = d.getDay();           // 0=일, 6=토
  if (wd === 0 || wd === 6) return false;
  return !_isKoreanHoliday(d);
}

function _mIsMarketDay() {
  const now     = new Date();
  const tz      = 'Asia/Seoul';
  const weekday = parseInt(Utilities.formatDate(now, tz, 'u'));
  if (weekday >= 6) return false;
  if (_isKoreanHoliday(now)) return false;
  const hhmm = parseInt(Utilities.formatDate(now, tz, 'HHmm'), 10);
  return hhmm >= 900 && hhmm <= 1530;
}

function _mIsTradingDay() {
  const now     = new Date();
  const tz      = 'Asia/Seoul';
  const weekday = parseInt(Utilities.formatDate(now, tz, 'u'));
  if (weekday >= 6) return false;
  if (_isKoreanHoliday(now)) return false;
  return true;
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
      buy:        v.buy,
      current:    v.current,
      profit:     v.profit,
      count:      v.count,
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
