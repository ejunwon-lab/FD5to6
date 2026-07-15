/**
 * SoldTracker.js — 매도 종목 What-if 추적 (신시스템 v2)
 *
 *  *매도추적* 시트 = 매도 이벤트별 스냅샷:
 *    실제 실현손익 vs "안 팔았다면 오늘 손익" vs "판 것 대비 차이".
 *  buildSoldTracker() 가 *실현손익* × *현재가_이력*(마지막 거래일 가격)으로 파생 계산.
 *    → KIS 신규 호출 없음 — *현재가_이력*이 원장 전체 코드 기준이라 판 종목도 매일 기록됨.
 *    → state 시트(매 갱신 전체 재기록). 일별 이력의 SSOT는 *현재가_이력*.
 *  updatePositionFromLedger 말미에서 호출 → 모든 갱신 경로가 통과(항상 fresh, errors.md 70/72 회피).
 *  설계: docs/plans/2026-07-15-매도추적-기간별번돈.md
 *
 *  산식(국내): 안팔았다면손익 = 현재가×매도수량 − 매입원가
 *              판것대비차이   = 안팔았다면손익 − 실현손익 = (현재가−매도가)×수량 + 수수료
 *              (+면 "안 팔걸"=기회손실, −면 "잘 팔았다")
 *  해외(해외주식/해외ETF): *현재가_이력* 가격이 환율 미반영이라 실현손익 KRW 단가와 스케일 불일치
 *              → 현재가/안팔았다면/차이 blank(v1). 국내만 계산.
 *  예금·펀드·보험: 실현손익에 종목코드가 없어(빈칸) 자동 제외.
 */

// *매도추적* 시트 생성 (헤더만)
function _setupSoldTrackerSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(NS.SOLD_TRACKER);
  if (sh) return sh;
  sh = ss.insertSheet(NS.SOLD_TRACKER);
  sh.getRange(1, 1, 1, 16).setValues([[
    '매도일', '종목코드', '종목명', '분류', '증권사', '계좌',
    '매도수량', '매도단가', '매도금액', '평균매입단가', '매입원가', '실현손익',
    '현재가', '안팔았다면손익', '판것대비차이', '경과일',
  ]]).setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sh.setFrozenRows(1);
  return sh;
}

/**
 * *현재가_이력* 마지막 거래일 행 → { code → 현재가 } 맵 + 기준일.
 * 비거래일 행은 건너뛰고 마지막 '거래일'을 잡는다(errors.md 2026-05-17 비거래일 누적 회피).
 */
function _soldLatestPriceMap(ss) {
  const out = { map: {}, asOf: null };
  const ph = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!ph || ph.getLastRow() < 2 || ph.getLastColumn() < 2) return out;
  const lastRow = ph.getLastRow(), lastCol = ph.getLastColumn();
  const codes = ph.getRange(1, 2, 1, lastCol - 1).getValues()[0].map(c => _normCode(String(c)));
  const datesRaw = ph.getRange(2, 1, lastRow - 1, 1).getValues();
  const allPrices = ph.getRange(2, 2, lastRow - 1, lastCol - 1).getValues();
  for (let i = datesRaw.length - 1; i >= 0; i--) {
    const raw = datesRaw[i][0];
    const d = raw instanceof Date
      ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(raw).slice(0, 10);
    if (_isTradingDateStr(d)) {
      out.asOf = d;
      const rowP = allPrices[i];
      codes.forEach((c, j) => { if (c) out.map[c] = Number(rowP[j]) || 0; });
      break;
    }
  }
  return out;
}

/**
 * *실현손익* × *현재가_이력* → *매도추적* 시트(state) 재기록.
 * 매도 이벤트 1건 = *실현손익* 1행(같은 종목 여러 매도·다계좌 분리).
 */
function buildSoldTracker(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const sh = _setupSoldTrackerSheet(ss);
  const pnl = ss.getSheetByName(NS.REALIZED_PNL);

  if (!pnl || pnl.getLastRow() < 2) {
    if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 16).clearContent();
    Logger.log('buildSoldTracker: 실현손익 없음 — 매도추적 비움');
    return;
  }

  const priceCtx = _soldLatestPriceMap(ss);
  const today = new Date();

  // *실현손익*: [0]매도일 [1]코드 [2]종목명 [3]분류 [4]증권사 [5]계좌
  //             [6]매도수량 [7]매도단가 [8]매도금액 [9]평균매입단가 [10]매입원가 [11]수수료 [12]실현손익 [13]수익률
  const rows = pnl.getRange(2, 1, pnl.getLastRow() - 1, 14).getValues()
    .filter(r => r[0] && String(r[0]) !== '합계' && String(r[1] || '').trim() !== ''); // 코드 없는 예금 등 제외

  const out = rows.map(r => {
    const sellDateRaw = r[0];
    const sellDate = sellDateRaw instanceof Date
      ? Utilities.formatDate(sellDateRaw, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(sellDateRaw).slice(0, 10);
    const code    = _normCode(String(r[1]));
    const name    = String(r[2] || '');
    const cat     = String(r[3] || '');
    const broker  = String(r[4] || '');
    const acct    = String(r[5] || '');
    const sellQty = Number(r[6]) || 0;
    const sellPr  = Number(r[7]) || 0;
    const sellAmt = Number(r[8]) || 0;
    const avgBuy  = Number(r[9]) || 0;
    const buyCost = Number(r[10]) || 0;
    const realized = Number(r[12]) || 0;

    // 해외는 현재가_이력 스케일(환율 미반영) 불일치 → what-if blank
    const isDomestic = cat.indexOf('해외') === -1;
    const curPrice = isDomestic ? (Number(priceCtx.map[code]) || 0) : 0;
    let ifHeld = '', diff = '';
    if (curPrice > 0) {
      ifHeld = curPrice * sellQty - buyCost;      // 안 팔았다면 오늘 평가손익
      diff   = ifHeld - realized;                  // 판 것 대비 차이(= (현재가−매도가)×수량 + 수수료)
    }

    // 경과일 (매도일 → 오늘)
    let elapsed = '';
    const sd = new Date(sellDate);
    if (!isNaN(sd.getTime())) {
      elapsed = Math.max(0, Math.floor((today.getTime() - sd.getTime()) / 86400000));
    }

    return [sellDate, code, name, cat, broker, acct,
            sellQty, sellPr, sellAmt, avgBuy, buyCost, realized,
            (curPrice > 0 ? curPrice : ''), ifHeld, diff, elapsed];
  });

  // 최근 매도 먼저 (매도일 desc)
  out.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));

  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 16).clearContent();
  if (out.length > 0) {
    sh.getRange(2, 1, out.length, 16).setValues(out);
    // 숫자 서식 (수량·가격·금액·손익 컬럼)
    sh.getRange(2, 7, out.length, 9).setNumberFormat('#,##0');
    sh.getRange(2, 16, out.length, 1).setNumberFormat('#,##0');
  }
  Logger.log('buildSoldTracker 완료: ' + out.length + '건 (기준일 ' + (priceCtx.asOf || '?') + ')');
}

/**
 * *매도추적* 시트 → JSON (웹/데스크용). 시트 비었으면 buildSoldTracker 1회(안전망).
 * 반환: { success, asOfDate, items:[{sellDate,code,name,category,broker,account,
 *         sellQty,sellPrice,sellAmount,avgBuyPrice,buyCost,realizedProfit,
 *         currentPrice,ifHeldProfit,diff,elapsedDays}] }
 */
function newMobileGetSoldTracker() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(NS.SOLD_TRACKER);
    if (!sh || sh.getLastRow() < 2) {
      buildSoldTracker(ss);
      sh = ss.getSheetByName(NS.SOLD_TRACKER);
    }
    if (!sh || sh.getLastRow() < 2) {
      return JSON.stringify({ success: true, asOfDate: null, items: [] });
    }
    const num = v => (v === '' || v === null || v === undefined) ? null : Number(v);
    const items = sh.getRange(2, 1, sh.getLastRow() - 1, 16).getValues().map(r => ({
      sellDate:       String(r[0]).slice(0, 10),
      code:           String(r[1]),
      name:           String(r[2]),
      category:       String(r[3]),
      broker:         String(r[4]),
      account:        String(r[5]),
      sellQty:        num(r[6]),
      sellPrice:      num(r[7]),
      sellAmount:     num(r[8]),
      avgBuyPrice:    num(r[9]),
      buyCost:        num(r[10]),
      realizedProfit: num(r[11]),
      currentPrice:   num(r[12]),
      ifHeldProfit:   num(r[13]),
      diff:           num(r[14]),
      elapsedDays:    num(r[15]),
    }));
    const asOf = _soldLatestPriceMap(ss).asOf;
    return JSON.stringify({ success: true, asOfDate: asOf, items: items });
  } catch (e) {
    Logger.log('newMobileGetSoldTracker 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e), items: [] });
  }
}
