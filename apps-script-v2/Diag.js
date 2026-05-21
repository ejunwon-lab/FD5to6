/**
 * Diag.js — 사용자 트리거 진단 (신시스템 v2)
 *
 *  🛠️ 유지보수 → 🔍 진단 메뉴에서 호출.
 *  최소 진단(날짜·참거짓·개수·지표 충족도·상태)을 팝업으로 표시 — 사용자가 복사해 공유.
 *
 *  ⚠️ 절대 규칙: 반환 데이터는 날짜·참거짓·개수·충족도·상태뿐.
 *     금액·종목명·계좌·증권사·수량 등 민감 정보는 절대 포함하지 않는다.
 *  공개 엔드포인트 없음(웹앱 doGet 없음). 사용자가 메뉴 클릭으로만 트리거.
 */

function runDiag() {
  const ui = SpreadsheetApp.getUi();
  try {
    const d = _buildDiag();
    const text = JSON.stringify(d, null, 2);
    ui.alert('🔍 진단 정보 (복사해서 공유)', text, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('진단 오류', String(e), ui.ButtonSet.OK);
  }
}

// 최소 진단 — 민감 정보(금액·종목명·계좌·수량) 절대 넣지 말 것
function _buildDiag() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = 'Asia/Seoul';
  const out = {
    now: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'),
    isTradingDay: _mIsTradingDay(),
    isMarketDay: _mIsMarketDay(),
  };

  // *현재가_이력* — 끝 3행 날짜 + priceAsOfDate(마지막 거래일 행)
  const ph = ss.getSheetByName(NS.PRICE_HISTORY);
  if (ph && ph.getLastRow() >= 2) {
    const last = ph.getLastRow();
    const n = Math.min(last - 1, 5);
    const tail = ph.getRange(last - n + 1, 1, n, 1).getValues().map(r =>
      r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]).slice(0, 10));
    out.priceHistTail = tail.slice(-3);
    for (let i = tail.length - 1; i >= 0; i--) {
      if (_isTradingDateStr(tail[i])) { out.priceAsOfDate = tail[i]; break; }
    }
  }

  // *휴장일* — 끝 6건 (날짜 + 이름, 공개 정보)
  const hol = ss.getSheetByName(NS.HOLIDAYS);
  if (hol && hol.getLastRow() >= 2) {
    const last = hol.getLastRow();
    const n = Math.min(last - 1, 6);
    out.holidaysTail = hol.getRange(last - n + 1, 1, n, 2).getValues().map(r => {
      const d = r[0] instanceof Date
        ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]).slice(0, 10);
      return d + ' ' + String(r[1] || '');
    });
  }

  // *종목지표* — 종목 수 + 지표 충족도(값있음/전체, 금액 X)
  const sm = ss.getSheetByName(NS.STOCK_METRICS);
  if (sm && sm.getLastRow() >= 2) {
    const rows = sm.getRange(2, 5, sm.getLastRow() - 1, 9).getValues();  // 5~13열: 당일등락…1Y%
    const total = rows.length;
    const filled = idx => rows.filter(r => r[idx] !== '' && r[idx] != null).length;
    out.stockCount = total;
    out.metricFill = {
      '당일등락': filled(0) + '/' + total,
      '1주손익': filled(3) + '/' + total,
      '1달손익': filled(4) + '/' + total,
      '1M':      filled(5) + '/' + total,
    };
  }

  // *대시보드* 2행 — 마지막 갱신 상태줄
  const dash = ss.getSheetByName(DB.SHEET);
  if (dash && dash.getLastRow() >= 2) {
    out.lastUpdate = String(dash.getRange(2, 1).getValue() || '');
  }

  return out;
}
