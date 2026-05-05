/**
 * Trend.gs
 * 추이 기록 및 그래프 생성
 */

function logToTrendSheet(ss) {
  const sys = ss || SpreadsheetApp.getActiveSpreadsheet();
  const trend = sys.getSheetByName(CONFIG.SHEET_NAMES.TREND);
  const track = sys.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);
  const tz = 'Asia/Seoul';
  const now = new Date();
  const dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd (EEE)');
  const timeStr = Utilities.formatDate(now, tz, 'a h시 m분 s초').replace('AM', '오전').replace('PM', '오후');

  // 공통 원천 값
  const opTotal   = toNumberLoose(getNamedRange(sys, CONFIG.NAMED_RANGES.TREND_OP_TOTAL).getValue());
  const pendTotal = toNumberLoose(getNamedRange(sys, CONFIG.NAMED_RANGES.TREND_PEND_TOTAL).getValue());
  const sumTotal = opTotal + pendTotal;

  /***********************
   * (A) 업데이트별 추이 (B~L)
   ***********************/
  const updStartRow = 5, updStartCol = 2, updCols = 11; // B~L
  const updLastFilled = lastFilledRowInColumn(trend, updStartRow, updStartCol);
  let prevOp = 0, prevPend = 0, prevSum = 0;
  
  if (updLastFilled >= updStartRow) {
    const prevRowVals = trend.getRange(updLastFilled, updStartCol, 1, updCols).getValues()[0];
    prevOp = toNumberLoose(prevRowVals[2]); // D
    prevPend = toNumberLoose(prevRowVals[5]); // G
    prevSum = toNumberLoose(prevRowVals[8]); // J
  }

  const opCh = opTotal - prevOp;
  const pendCh = pendTotal - prevPend;
  const sumCh = sumTotal - prevSum;
  const opRt = prevOp ? (opCh / prevOp) * 100 : 0;
  const pendRt = prevPend ? (pendCh / prevPend) * 100 : 0;
  
  const updRow = [
    dateStr, timeStr,
    fmtNum(opTotal), fmtNum(opCh), fmtPct(opRt),
    fmtNum(pendTotal), fmtNum(pendCh), fmtPct(pendRt),
    fmtNum(sumTotal), fmtNum(sumCh), fmtPct(prevSum ? (sumCh / prevSum * 100) : 0)
  ];

  trend.getRange(updLastFilled + 1, updStartCol, 1, updCols).setValues([updRow]);
  trend.getRange('B2:L2').setValues([updRow]);

  /***********************
   * (B) 일별 추이 (N~S)
   ***********************/
  {
    const dStartRow = CONFIG.TREND.DAILY_START_ROW;
    const dStartCol = CONFIG.TREND.DAILY_START_COL;
    const dCols = 6;
    const dLastRow = trend.getLastRow();
    const dateOnly = dateStr.slice(0, 10);

    const dHeight = Math.max(dLastRow - dStartRow + 1, 0);
    const colN = dHeight > 0
      ? trend.getRange(dStartRow, dStartCol, dHeight, 1).getValues().flat()
      : [];

    let dTodayRow = null;
    for (let i = 0; i < colN.length; i++) {
      const cell = String(colN[i] || "");
      if (cell.startsWith(dateOnly)) { dTodayRow = dStartRow + i; break; }
    }

    let dLastFilled = dStartRow - 1;
    for (let i = colN.length - 1; i >= 0; i--) {
      if (colN[i]) { dLastFilled = dStartRow + i; break; }
    }

    const dPrevRowForDiff = dTodayRow ? (dTodayRow - 1) : dLastFilled;
    const prevDailySumB = (dPrevRowForDiff >= dStartRow)
      ? toNumberLoose(trend.getRange(dPrevRowForDiff, dStartCol + 3).getValue())
      : 0;

    const dDailySum = sumTotal;
    const dDiff = dDailySum - prevDailySumB;
    const dRate = prevDailySumB ? (dDiff / prevDailySumB) * 100 : 0;

    const dRow = [
      dateStr + " " + timeStr,
      fmtNum(opTotal),
      fmtNum(pendTotal),
      fmtNum(dDailySum),
      fmtNum(dDiff),
      fmtPct(dRate)
    ];

    const dWriteRow = dTodayRow ? dTodayRow : (dLastFilled + 1);
    trend.getRange(dWriteRow, dStartCol, 1, dCols).setValues([dRow]);
    trend.getRange("N2:S2").setValues([dRow]);
  }

  /***********************
   * (C) 수익 추이 (U~AF)
   ***********************/
  {
    const pStartCol = CONFIG.TREND.PROFIT_START_COL;
    const pCols = 12;
    const pFirstRow = CONFIG.TREND.PROFIT_START_ROW;
    const pLastRow = trend.getLastRow();
    const dateOnly = dateStr.slice(0, 10);

    const height = Math.max(pLastRow - pFirstRow + 1, 0);
    const colU = height > 0
      ? trend.getRange(pFirstRow, pStartCol, height, 1).getValues().flat()
      : [];

    let todayRow = null;
    for (let i = 0; i < colU.length; i++) {
      if (String(colU[i] || '').startsWith(dateOnly)) {
        todayRow = pFirstRow + i;
        break;
      }
    }

    let lastFilled = pFirstRow - 1;
    for (let i = colU.length - 1; i >= 0; i--) {
      if (colU[i]) { lastFilled = pFirstRow + i; break; }
    }

    const writeRow = todayRow ? todayRow : (lastFilled + 1);

    // 확정 데이터 일괄 읽기 (K=11, V=22, X=24 → K부터 14열 배치 읽기)
    const soldStartRow = getTrackerSoldData(ss).startRow;
    const trackLastRow = track.getLastRow();
    let confirmedBuy = 0, confirmedSell = 0, confirmedProfit = 0;
    const soldHeight = Math.max(trackLastRow - soldStartRow + 1, 0);
    if (soldHeight > 0) {
      const soldVals = track.getRange(soldStartRow, 11, soldHeight, 14).getValues();
      for (let i = soldVals.length - 1; i >= 0; i--) {
        if (!confirmedBuy    && soldVals[i][0])  confirmedBuy    = toNumberLoose(soldVals[i][0]);  // K
        if (!confirmedSell   && soldVals[i][11]) confirmedSell   = toNumberLoose(soldVals[i][11]); // V
        if (!confirmedProfit && soldVals[i][13]) confirmedProfit = toNumberLoose(soldVals[i][13]); // X
        if (confirmedBuy && confirmedSell && confirmedProfit) break;
      }
    }
    const confirmedRate   = confirmedBuy ? (confirmedProfit / confirmedBuy) * 100 : 0;

    // 운용 합계는 ACTIVE_TOTAL Named Range 기준으로 동적 조회
    const totalRange    = getNamedRange(ss, CONFIG.NAMED_RANGES.ACTIVE_TOTAL);
    const totalRow      = totalRange.getRow();
    const totalSheet    = track;
    const operatingBuy    = toNumberLoose(totalSheet.getRange(totalRow, 11).getValue()); // K열
    const operatingNow    = toNumberLoose(totalSheet.getRange(totalRow, 14).getValue()); // N열
    const operatingProfit = toNumberLoose(totalSheet.getRange(totalRow, 15).getValue()); // O열
    const operatingRate = operatingBuy ? (operatingProfit / operatingBuy) * 100 : 0;

    const totalProfit = confirmedProfit + operatingProfit;

    const prevRowForDiff = writeRow - 1;
    const prevTotalProfit = (prevRowForDiff >= pFirstRow)
      ? toNumberLoose(trend.getRange(prevRowForDiff, pStartCol + 9).getValue())
      : 0;

    const diffProfit = totalProfit - prevTotalProfit;
    const diffRate = prevTotalProfit ? (diffProfit / prevTotalProfit) * 100 : 0;

    const profitRow = [
      dateStr + ' ' + timeStr,
      fmtNum(confirmedBuy), fmtNum(confirmedSell),
      fmtNum(confirmedProfit), fmtPct(confirmedRate),
      fmtNum(operatingBuy), fmtNum(operatingNow),
      fmtNum(operatingProfit), fmtPct(operatingRate),
      fmtNum(totalProfit), fmtNum(diffProfit),
      fmtPct(diffRate)
    ];

    // 날짜가 바뀌면 기존 U2의 diff(AE2/AF2)를 AJ2/AK2에 백업 (iOS 8:51 이전 표시용)
    // 오늘과 U2 기존 날짜 모두 거래일일 때만 백업 — 주말·공휴일 데이터 유입 차단
    const _nowDow = now.getDay();
    if (!todayRow && _nowDow !== 0 && _nowDow !== 6 && !_isKoreanHoliday(now)) {
      const u2Row = trend.getRange(2, pStartCol, 1, 12).getValues()[0];
      if (u2Row[0]) {
        const _u2DateObj = new Date(String(u2Row[0]).slice(0, 10));
        const _u2Dow = _u2DateObj.getDay();
        const _u2WasTrading = _u2Dow !== 0 && _u2Dow !== 6 && !_isKoreanHoliday(_u2DateObj);
        if (_u2WasTrading) {
          trend.getRange(2, pStartCol + 15, 1, 2).setValues([[u2Row[10], u2Row[11]]]);
        }
      }
    }
    trend.getRange(writeRow, pStartCol, 1, pCols).setValues([profitRow]);
    trend.getRange('U2:AF2').setValues([profitRow]);

    // 거래일이면 AH2:AI2 캐시 + 히스토리 기록
    const _nowDow2 = now.getDay();
    if (_nowDow2 !== 0 && _nowDow2 !== 6 && !_isKoreanHoliday(now)) {
      trend.getRange(2, pStartCol + 13, 1, 2).setValues([[fmtNum(diffProfit), fmtPct(diffRate)]]);
      _upsertHoldingsHistory(sys, dateOnly, timeStr);
      updateNewPriceHistory(sys);
    }
  }
}

/**
 * 종목_히스토리 시트 확보 (없으면 생성)
 */
/**
 * [수동 실행용] 종목_히스토리 즉시 기록 (거래일 여부 무관)
 * GAS 에디터에서 직접 실행
 */
function runHoldingsHistoryNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = 'Asia/Seoul';
  const now = new Date();
  const dateOnly = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const timeStr  = Utilities.formatDate(now, tz, 'a h시 m분 s초').replace('AM', '오전').replace('PM', '오후');
  _upsertHoldingsHistory(ss, dateOnly, timeStr);
  Logger.log('종목_히스토리 기록 완료 — ' + dateOnly + ' ' + timeStr);
}

function _ensureHoldingsHistorySheet(ss) {
  const name = CONFIG.SHEET_NAMES.HOLDINGS_HISTORY;
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const header = [
      '날짜', '시간', '종목코드', '종목명', '분류', '증권사', '구분',
      '수량', '매입단가', '운용매입',
      '현재단가', '운용현재가', '운용수익', '수익률(%)',
      '당일등락', '당일(%)', '1M', '3M', '6M', '1Y', '52주최고', '52주최저'
    ];
    sheet.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 종목_히스토리 upsert (날짜+종목코드 기준, 보유 종목만)
 */
function _upsertHoldingsHistory(ss, dateOnly, timeStr) {
  const sheet = _ensureHoldingsHistorySheet(ss);
  const { values, idx } = getTrackerActiveData(ss);
  const EXCLUDE = CONFIG.CODES.EXCLUDE_KEYWORDS;

  // 오늘 날짜의 기존 행 번호 맵 구성 (종목코드 → 행번호)
  const lastRow = sheet.getLastRow();
  const existingMap = {};
  if (lastRow >= 2) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // A(날짜), B(시간), C(코드)
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === dateOnly) {
        existingMap[String(keys[i][2])] = i + 2; // 1-based + 헤더
      }
    }
  }

  const toAppend = [];
  for (const row of values) {
    const code = String(row[idx.CODE] || '');
    const name = String(row[idx.STATUS_NAME] || row[idx.NAME] || '');
    if (!code || EXCLUDE.some(k => name.includes(k))) continue;
    const qty = Number(row[idx.QUANTITY]) || 0;
    if (qty <= 0) continue;

    const opBuy    = Number(row[idx.OP_BUY])   || 0;
    const opProfit = Number(row[idx.OP_PROFIT]) || 0;
    const profitRate = opBuy > 0 ? Math.round(opProfit / opBuy * 10000) / 100 : 0;

    const histRow = [
      dateOnly, timeStr, code, name,
      String(row[idx.CATEGORY]     || ''),
      String(row[idx.BROKER]       || ''),
      String(row[idx.ACCOUNT_TYPE] || ''),
      qty,
      Number(row[idx.UNIT_PRICE])    || 0,
      opBuy,
      Number(row[idx.CURRENT_PRICE]) || 0,
      Number(row[idx.OP_CURRENT])    || 0,
      opProfit,
      profitRate,
      row[idx.STATUS_CHANGE] || 0,
      row[idx.STATUS_PCT]    || '',
      row[idx.STATUS_M1]     || '',
      row[idx.STATUS_M3]     || '',
      row[idx.STATUS_M6]     || '',
      row[idx.STATUS_Y1]     || '',
      Number(row[idx.STATUS_HIGH52]) || 0,
      Number(row[idx.STATUS_LOW52])  || 0,
    ];

    if (existingMap[code] !== undefined) {
      sheet.getRange(existingMap[code], 1, 1, histRow.length).setValues([histRow]);
    } else {
      toAppend.push(histRow);
    }
  }

  if (toAppend.length > 0) {
    const appendRow = sheet.getLastRow() + 1;
    sheet.getRange(appendRow, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
  }
}

function drawTrendChart() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = getSheet(ss, CONFIG.SHEET_NAMES.TREND);
  let chartSheet = getOrCreateSheet(ss, CONFIG.SHEET_NAMES.CHART);
  let tempSheet = getOrCreateSheet(ss, CONFIG.SHEET_NAMES.TEMP);

  if (!dataSheet) {
    if (!_IS_MOBILE_CALL) SpreadsheetApp.getUi().alert('추이 기록 시트가 없습니다.');
    return;
  }

  tempSheet.clear();
  chartSheet.getCharts().forEach(ch => chartSheet.removeChart(ch));

  const dailyStartRow = CONFIG.TREND.DAILY_START_ROW;
  const dailyStartCol = CONFIG.TREND.DAILY_START_COL;
  const lastRow = dataSheet.getLastRow();

  if (lastRow < dailyStartRow) {
    if (!_IS_MOBILE_CALL) SpreadsheetApp.getUi().alert('일별 데이터가 없습니다.');
    return;
  }

  // 배치 읽기로 마지막 유효 행 찾기
  let actualLastRow = dailyStartRow - 1;
  const dateVals = dataSheet.getRange(dailyStartRow, dailyStartCol, lastRow - dailyStartRow + 1, 1).getValues();
  for (let i = dateVals.length - 1; i >= 0; i--) {
    if (dateVals[i][0]) { actualLastRow = dailyStartRow + i; break; }
  }

  if (actualLastRow < dailyStartRow) {
    if (!_IS_MOBILE_CALL) SpreadsheetApp.getUi().alert('유효한 일별 데이터가 없습니다.');
    return;
  }

  // 1. 스택 막대(일별 운용/대기)
  tempSheet.getRange(1, 1, 1, 3).setValues([['날짜', '대기중', '운용중']]);
  const dataRows = actualLastRow - dailyStartRow + 1;
  const sourceData = dataSheet.getRange(dailyStartRow, dailyStartCol, dataRows, 6).getValues();
  const stackData = sourceData.map(row => [row[0], row[2], row[1]]);
  
  tempSheet.getRange(2, 1, dataRows, 3).setValues(stackData);
  const stackChartRange = tempSheet.getRange(1, 1, dataRows + 1, 3);
  
  const stackChart = chartSheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(stackChartRange)
    .setPosition(3, 2, 0, 0)
    .setOption('title', '일별 운용중/대기중 추이')
    .setOption('legend', { position: 'top', alignment: 'center' })
    .setOption('isStacked', true)
    .setOption('bar', { groupWidth: '80%' })
    .setOption('colors', ['#FF8C00', '#0000FF'])
    .setOption('vAxis', { title: '금액(원)', format: '#,##0', textStyle: { fontSize: 12 } })
    .setOption('hAxis', { title: '날짜', slantedText: true })
    .setOption('width', 600)
    .setOption('height', 400)
    .build();
  chartSheet.insertChart(stackChart);

  // 2. 변화량 막대
  tempSheet.getRange(1, 5, 1, 2).setValues([['날짜', '변화량']]);
  const changeData = sourceData.map(row => [row[0], Number(row[4]) || 0]);
  tempSheet.getRange(2, 5, dataRows, 2).setValues(changeData);
  const changeChartRange = tempSheet.getRange(1, 5, dataRows + 1, 2);
  
  const changeChart = chartSheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(changeChartRange)
    .setPosition(3, 8, 0, 0)
    .setOption('title', '일별 합계 변화량')
    .setOption('legend', { position: 'none' })
    .setOption('bar', { groupWidth: '90%' })
    .setOption('colors', ['#008000'])
    .setOption('vAxis', { title: '변화량(원)', format: '#,##0', textStyle: { fontSize: 12 } })
    .setOption('hAxis', { title: '날짜', slantedText: true })
    .setOption('width', 600)
    .setOption('height', 400)
    .build();
  chartSheet.insertChart(changeChart);

  // 3. 누적 변화량 라인
  tempSheet.getRange(1, 8, 1, 2).setValues([['날짜', '누적 변화량']]);
  let cumulativeSum = 0;
  const cumulativeData = sourceData.map(row => {
    const dailyChange = Number(row[4]) || 0;
    cumulativeSum += dailyChange;
    return [row[0], cumulativeSum];
  });
  tempSheet.getRange(2, 8, dataRows, 2).setValues(cumulativeData);
  const cumulativeChartRange = tempSheet.getRange(1, 8, dataRows + 1, 2);
  
  const cumulativeChart = chartSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(cumulativeChartRange)
    .setPosition(3, 14, 0, 0)
    .setOption('title', '누적 변화량 추이')
    .setOption('legend', { position: 'none' })
    .setOption('pointSize', 4)
    .setOption('lineWidth', 2)
    .setOption('colors', ['#DC143C'])
    .setOption('vAxis', { title: '누적 변화량(원)', format: '#,##0', textStyle: { fontSize: 12 }, gridlines: { color: '#E0E0E0' } })
    .setOption('hAxis', { title: '날짜', slantedText: true, gridlines: { color: '#E0E0E0' } })
    .setOption('width', 600)
    .setOption('height', 400)
    .setOption('backgroundColor', '#FAFAFA')
    .build();
  chartSheet.insertChart(cumulativeChart);
  // 4. 누적 수익 (2025-10-20 ~) : 확정 수익 + 운용 수익 스택 차트
  {
    const pStartRow = CONFIG.TREND.PROFIT_START_ROW;
    const pStartCol = CONFIG.TREND.PROFIT_START_COL; // U열
    const pDataRows = lastRow - pStartRow + 1;

    if (pDataRows > 0) {
      // U열(Date)부터 AD열(Total Profit)까지 가져오기 (10개 열)
      // U=0, ..., X(Confirmed Profit)=3, ..., AB(Operating Profit)=7 (relative to U)
      const pSourceData = dataSheet.getRange(pStartRow, pStartCol, pDataRows, 10).getValues();
      
      // 날짜 비교를 위한 기준일 설정 (Config.TREND.PROFIT_CHART_START 기준)
      const [cy, cm, cd] = CONFIG.TREND.PROFIT_CHART_START.split('-').map(Number);
      const targetDate = new Date(cy, cm - 1, cd);
      targetDate.setHours(0, 0, 0, 0);

      const filteredData = pSourceData
        .filter(row => {
          const cellValue = String(row[0] || "");
          // "2025-10-20 (Mon) 오후 7시..." 형식에서 날짜 부분 추출
          const dateMatch = cellValue.match(/(\d{4})-(\d{2})-(\d{2})/);
          
          if (!dateMatch) return false;

          const year = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1; // Month is 0-indexed
          const day = parseInt(dateMatch[3], 10);
          
          const rowDate = new Date(year, month, day);
          
          // 비교를 위해 시간 성분 제거 (이미 0시 0분이지만 명시적으로)
          rowDate.setHours(0, 0, 0, 0);

          return rowDate.getTime() >= targetDate.getTime();
        })
        .map(row => [
          row[0], // Date
          row[3], // Confirmed Profit (X열)
          row[7]  // Operating Profit (AB열)
        ]);

      if (filteredData.length > 0) {
        // Temp Sheet K, L, M열 사용
        tempSheet.getRange(1, 11, 1, 3).setValues([['날짜', '확정 수익', '운용 수익']]);
        tempSheet.getRange(2, 11, filteredData.length, 3).setValues(filteredData);
        
        const profitChartRange = tempSheet.getRange(1, 11, filteredData.length + 1, 3);
        
        const profitChart = chartSheet.newChart()
          .setChartType(Charts.ChartType.COLUMN)
          .addRange(profitChartRange)
          .setPosition(22, 14, 0, 0) // N22 (row 22, column 14 = N)
          .setOption('title', '누적 수익 추이 (확정+운용, 2025-10-20 ~)')
          .setOption('legend', { position: 'top', alignment: 'center' })
          .setOption('isStacked', true)
          .setOption('bar', { groupWidth: '80%' })
          .setOption('colors', ['#FF8C00', '#0000FF']) // Orange (Confirmed), Blue (Operating)
          .setOption('vAxis', { title: '수익(원)', format: '#,##0', textStyle: { fontSize: 12 } })
          .setOption('hAxis', { title: '날짜', slantedText: true })
          .setOption('width', 1050) // N~Z: 13 columns width
          .setOption('height', 530) // 22~49: 28 rows height
          .build();
          
        chartSheet.insertChart(profitChart);
      }
    }
  }
}
