/**
 * Trend.js — *추이 기록* 시트 갱신 (신시스템 v2)
 *
 * 구시스템 시트 구조 그대로 사용:
 *  (A) 업데이트별 추이: B~L (col 2~12), row 5부터 누적, row 2는 최신 스냅샷
 *  (B) 일별 추이:       N~S (col 14~19), row 2는 최신 스냅샷 (같은 날 행 upsert)
 *  (C) 수익 추이:       U~AF (col 21~32), row 2는 최신 스냅샷 (같은 날 행 upsert)
 *                        AH/AI: 거래일 diff 캐시, AJ/AK: 전일 백업
 *
 * 신시스템 매핑:
 *  - opTotal   = *보유현황* KIS 종목(국내/해외 주식·ETF) 평가금액 합계
 *  - pendTotal = *보유현황* KIS_SKIP 종목(펀드·예금·보험·기타) 평가금액 합계
 *  - confirmedBuy/Sell/Profit = *실현손익* 시트 합계
 *  - operatingBuy/Now/Profit  = KIS 종목 매입/평가/손익 합계
 */

function logToTrendSheet(ss) {
  const sys   = ss || SpreadsheetApp.getActiveSpreadsheet();
  const trend = sys.getSheetByName(NS.TREND);
  if (!trend) {
    Logger.log('logToTrendSheet: *추이 기록* 시트 없음 - skip');
    return;
  }

  const tz = 'Asia/Seoul';
  const now = new Date();
  const dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd (EEE)');
  const timeStr = Utilities.formatDate(now, tz, 'a h시 m분 s초').replace('AM', '오전').replace('PM', '오후');
  const dateOnly = dateStr.slice(0, 10);

  // ── 보유현황 집계 ──
  const posSheet = sys.getSheetByName(NS.POSITION);
  if (!posSheet || posSheet.getLastRow() < 2) return;
  const posRows = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 15).getValues()
    .filter(r => String(r[0]) !== '합계' && String(r[1]) !== '합계' && Number(r[6]) > 0);

  // 운용중 = 모든 보유 종목 (펀드/예금/보험 포함)
  // 대기   = *설정* 시트 5행 이하의 대기 섹션에서 합계 행 자동 감지
  let opTotalCur = 0, opTotalBuy = 0, opTotalProfit = 0;
  posRows.forEach(r => {
    opTotalCur    += Number(r[10]) || 0;
    opTotalBuy    += Number(r[8])  || 0;
    opTotalProfit += Number(r[11]) || 0;
  });
  const pendTotalCur = _trGetPendingTotal(sys);
  const operatingRate = opTotalBuy > 0 ? (opTotalProfit / opTotalBuy) * 100 : 0;
  const sumTotal = opTotalCur + pendTotalCur;

  // ── 실현손익 집계 ──
  const pnlSheet = sys.getSheetByName(NS.REALIZED_PNL);
  let confirmedBuy = 0, confirmedSell = 0, confirmedProfit = 0;
  if (pnlSheet && pnlSheet.getLastRow() >= 2) {
    const pnlRows = pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
      .filter(r => r[0] && String(r[0]) !== '합계');
    pnlRows.forEach(r => {
      confirmedBuy    += Number(r[10]) || 0;   // 매수원가(costBasis)
      confirmedSell   += Number(r[8])  || 0;   // 매도금액
      confirmedProfit += Number(r[12]) || 0;   // 실현손익
    });
  }
  const confirmedRate = confirmedBuy > 0 ? (confirmedProfit / confirmedBuy) * 100 : 0;
  const totalProfit   = confirmedProfit + opTotalProfit;

  // ─────────────────────────────────────────────
  // (A) 업데이트별 추이: B~L, row 5부터 누적
  // ─────────────────────────────────────────────
  {
    const updStartRow = 5, updStartCol = 2, updCols = 11;
    const lastFilled  = _trLastFilledRowInCol(trend, updStartRow, updStartCol);
    let prevOp = 0, prevPend = 0, prevSum = 0;
    if (lastFilled >= updStartRow) {
      const prevRow = trend.getRange(lastFilled, updStartCol, 1, updCols).getValues()[0];
      prevOp   = _trNum(prevRow[2]);  // D
      prevPend = _trNum(prevRow[5]);  // G
      prevSum  = _trNum(prevRow[8]);  // J
    }
    const opCh   = opTotalCur   - prevOp;
    const pendCh = pendTotalCur - prevPend;
    const sumCh  = sumTotal     - prevSum;
    const opRt   = prevOp   ? (opCh   / prevOp)   * 100 : 0;
    const pendRt = prevPend ? (pendCh / prevPend) * 100 : 0;
    const sumRt  = prevSum  ? (sumCh  / prevSum)  * 100 : 0;

    const updRow = [
      dateStr, timeStr,
      _trFmtNum(opTotalCur), _trFmtNum(opCh), _trFmtPct(opRt),
      _trFmtNum(pendTotalCur), _trFmtNum(pendCh), _trFmtPct(pendRt),
      _trFmtNum(sumTotal),   _trFmtNum(sumCh),  _trFmtPct(sumRt),
    ];
    trend.getRange(lastFilled + 1, updStartCol, 1, updCols).setValues([updRow]);
    trend.getRange('B2:L2').setValues([updRow]);
  }

  // ─────────────────────────────────────────────
  // (B) 일별 추이: N~S, 같은 날 upsert
  // ─────────────────────────────────────────────
  {
    const dStartRow = 5, dStartCol = 14, dCols = 6;
    const dLastRow  = trend.getLastRow();
    const dHeight   = Math.max(dLastRow - dStartRow + 1, 0);
    const colN = dHeight > 0
      ? trend.getRange(dStartRow, dStartCol, dHeight, 1).getValues().flat()
      : [];
    let dTodayRow = null;
    for (let i = 0; i < colN.length; i++) {
      if (String(colN[i] || '').startsWith(dateOnly)) { dTodayRow = dStartRow + i; break; }
    }
    let dLastFilled = dStartRow - 1;
    for (let i = colN.length - 1; i >= 0; i--) {
      if (colN[i]) { dLastFilled = dStartRow + i; break; }
    }
    const dPrevRow    = dTodayRow ? (dTodayRow - 1) : dLastFilled;
    const prevDailySum = dPrevRow >= dStartRow
      ? _trNum(trend.getRange(dPrevRow, dStartCol + 3).getValue())
      : 0;
    const dDiff = sumTotal - prevDailySum;
    const dRate = prevDailySum ? (dDiff / prevDailySum) * 100 : 0;

    const dRow = [
      dateStr + ' ' + timeStr,
      _trFmtNum(opTotalCur), _trFmtNum(pendTotalCur), _trFmtNum(sumTotal),
      _trFmtNum(dDiff), _trFmtPct(dRate),
    ];
    const dWriteRow = dTodayRow ? dTodayRow : (dLastFilled + 1);
    trend.getRange(dWriteRow, dStartCol, 1, dCols).setValues([dRow]);
    trend.getRange('N2:S2').setValues([dRow]);
  }

  // ─────────────────────────────────────────────
  // (C) 수익 추이: U~AF, 같은 날 upsert
  // ─────────────────────────────────────────────
  {
    const pFirstRow = 5, pStartCol = 21, pCols = 12;
    const pLastRow  = trend.getLastRow();
    const height    = Math.max(pLastRow - pFirstRow + 1, 0);
    const colU = height > 0
      ? trend.getRange(pFirstRow, pStartCol, height, 1).getValues().flat()
      : [];
    let todayRow = null;
    for (let i = 0; i < colU.length; i++) {
      if (String(colU[i] || '').startsWith(dateOnly)) { todayRow = pFirstRow + i; break; }
    }
    let lastFilled = pFirstRow - 1;
    for (let i = colU.length - 1; i >= 0; i--) {
      if (colU[i]) { lastFilled = pFirstRow + i; break; }
    }
    const writeRow = todayRow ? todayRow : (lastFilled + 1);

    const prevRowForDiff = writeRow - 1;
    const prevTotalProfit = prevRowForDiff >= pFirstRow
      ? _trNum(trend.getRange(prevRowForDiff, pStartCol + 9).getValue())  // AD
      : 0;
    const diffProfit = totalProfit - prevTotalProfit;
    const diffRate   = prevTotalProfit ? (diffProfit / prevTotalProfit) * 100 : 0;

    const profitRow = [
      dateStr + ' ' + timeStr,
      _trFmtNum(confirmedBuy), _trFmtNum(confirmedSell),
      _trFmtNum(confirmedProfit), _trFmtPct(confirmedRate),
      _trFmtNum(opTotalBuy), _trFmtNum(opTotalCur),
      _trFmtNum(opTotalProfit), _trFmtPct(operatingRate),
      _trFmtNum(totalProfit), _trFmtNum(diffProfit), _trFmtPct(diffRate),
    ];

    // (AJ/AK 백업 로직 제거 — MobileAPI에서 *추이 기록* U열에서 어제 거래일 직접 검색)

    trend.getRange(writeRow, pStartCol, 1, pCols).setValues([profitRow]);
    trend.getRange('U2:AF2').setValues([profitRow]);

    // 거래일이면 AH/AI 캐시 (mobile에서 8:51 이전 표시용)
    const _nowDow2 = now.getDay();
    if (_nowDow2 !== 0 && _nowDow2 !== 6 && !_trIsKoreanHoliday(now)) {
      trend.getRange(2, pStartCol + 13, 1, 2).setValues([[_trFmtNum(diffProfit), _trFmtPct(diffRate)]]);
    }
  }

  Logger.log('logToTrendSheet 완료 — ' + dateStr + ' ' + timeStr);
}

// ── 헬퍼 ──────────────────────────────────────
function _trLastFilledRowInCol(sheet, startRow, col) {
  const last = sheet.getLastRow();
  if (last < startRow) return startRow - 1;
  const vals = sheet.getRange(startRow, col, last - startRow + 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i][0] !== '' && vals[i][0] != null) return startRow + i;
  }
  return startRow - 1;
}

function _trNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').replace('%', ''));
  return isNaN(n) ? 0 : n;
}

function _trFmtNum(n) {
  return Math.round(_trNum(n)).toLocaleString('ko-KR');
}

function _trFmtPct(n) {
  const v = _trNum(n);
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

// *설정* 시트 5행 이하 대기 섹션에서 합계 행 자동 감지 → C열 값 반환
// A 또는 B열에 "합계"·"소계"가 있는 행을 찾고, 없으면 C13 fallback
function _trGetPendingTotal(ss) {
  try {
    const sheet = ss.getSheetByName(NS.SETTINGS);
    if (!sheet || sheet.getLastRow() < 5) return 0;
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(5, 1, lastRow - 4, 3).getValues();
    for (let i = 0; i < data.length; i++) {
      const a = String(data[i][0] || '').trim();
      const b = String(data[i][1] || '').trim();
      if (a.includes('합계') || a.includes('소계') ||
          b.includes('합계') || b.includes('소계')) {
        return _trNum(data[i][2]);
      }
    }
    // fallback: C13
    return _trNum(sheet.getRange(13, 3).getValue());
  } catch (e) {
    Logger.log('_trGetPendingTotal 오류: ' + e);
    return 0;
  }
}

// 휴일 판정은 MobileAPI.js의 _isKoreanHoliday 단일 소스에 위임
// (GAS는 전 파일이 같은 전역 스코프 — 목록 중복 보유 금지)
function _trIsKoreanHoliday(date) {
  return _isKoreanHoliday(date);
}
