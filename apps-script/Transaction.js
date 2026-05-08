/**
 * Transaction.gs
 * 거래 입력 및 처리 모듈
 */

function processTransaction() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const txSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTION);
  const trackerSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);

  if (!txSheet || !trackerSheet) {
    SpreadsheetApp.getUi().alert('필요한 시트를 찾을 수 없습니다.');
    return;
  }

  const txType      = txSheet.getRange('B3').getValue();
  const code        = String(txSheet.getRange('B4').getValue() || '').trim().toUpperCase();
  const name        = String(txSheet.getRange('B5').getValue() || '').trim();
  const category    = String(txSheet.getRange('B6').getValue() || '').trim();
  const exchange    = String(txSheet.getRange('B7').getValue() || '').trim();
  const broker      = String(txSheet.getRange('B8').getValue() || '').trim();
  const accountType = String(txSheet.getRange('B9').getValue() || '').trim();
  const quantity    = Number(txSheet.getRange('B10').getValue() || 0);
  const price       = Number(txSheet.getRange('B11').getValue() || 0);
  const fee         = Number(txSheet.getRange('B12').getValue() || 0);
  const buyDate     = txSheet.getRange('B13').getValue();

  if (!code || !name || quantity <= 0 || price <= 0) {
    SpreadsheetApp.getUi().alert('필수 항목을 모두 입력해주세요.\n(종목코드, 종목명, 수량, 단가)');
    return;
  }

  if (txType === '매수') {
    handleBuy(ss, trackerSheet, { code, name, category, exchange, accountType, broker, quantity, price, fee, buyDate });
  } else if (txType === '매도') {
    handleSell(ss, trackerSheet, { code, name, category, exchange, accountType, broker, quantity, price, fee, buyDate });
  } else {
    SpreadsheetApp.getUi().alert('거래 유형을 선택해주세요 (매수/매도)');
    return;
  }

  txSheet.getRange('B4:B13').clearContent();
  SpreadsheetApp.getUi().alert('✅ 거래가 성공적으로 처리되었습니다.');
}

function handleBuy(ss, sheet, data) {
  const { code, name, category, exchange, accountType, broker, quantity, price, fee, buyDate } = data;
  const cols = getTrackerColumns(ss);
  const { startRow, endRow } = getTrackerActiveData(ss);

  const matchRow = findMatchingPosition(ss, sheet, code, broker, accountType, category, 'active');

  if (matchRow) {
    const existingQty   = Number(sheet.getRange(matchRow, cols.QUANTITY).getValue() || 0);
    const existingPrice = Number(sheet.getRange(matchRow, cols.UNIT_PRICE).getValue() || 0);
    const newQty        = existingQty + quantity;
    const newAvgPrice   = ((existingQty * existingPrice) + (quantity * price) + fee) / newQty;

    sheet.getRange(matchRow, cols.QUANTITY).setValue(newQty);
    sheet.getRange(matchRow, cols.UNIT_PRICE).setValue(Math.round(newAvgPrice));
  } else {
    const emptyRow = findEmptyRow(sheet, startRow, endRow, cols.CODE);
    if (!emptyRow) {
      SpreadsheetApp.getUi().alert('운용 중인 종목 영역이 가득 찼습니다.');
      return;
    }

    sheet.getRange(emptyRow, 1, 1, 26).clearContent();
    sheet.getRange(emptyRow, cols.CODE).setValue(code);
    sheet.getRange(emptyRow, cols.CATEGORY).setValue(category);
    sheet.getRange(emptyRow, cols.NAME).setValue(name);
    sheet.getRange(emptyRow, 4).setValue(exchange); // D열 (헤더 없음)
    sheet.getRange(emptyRow, cols.BUY_DATE).setValue(buyDate);
    sheet.getRange(emptyRow, cols.BROKER).setValue(broker);
    sheet.getRange(emptyRow, cols.ACCOUNT_TYPE).setValue(accountType);
    sheet.getRange(emptyRow, cols.STOCK_NAME).setValue(name);    // H열
    sheet.getRange(emptyRow, cols.QUANTITY).setValue(quantity);
    sheet.getRange(emptyRow, cols.UNIT_PRICE).setValue(Math.round((quantity * price + fee) / quantity));
    sheet.getRange(emptyRow, cols.FEE).setValue(fee);
    sheet.getRange(emptyRow, cols.STATUS_NAME).setValue(name);   // R열
  }
}

function handleSell(ss, sheet, data) {
  const { code, broker, accountType, category, quantity, price, fee, buyDate } = data;
  const cols = getTrackerColumns(ss);

  Logger.log(`매도 시도: 코드=${code}, 증권사=${broker}, 구분=${accountType}, 분류=${category}, 수량=${quantity}`);

  const matchRow = findMatchingPosition(ss, sheet, code, broker, accountType, category, 'active');
  Logger.log(`매칭 결과: matchRow=${matchRow}`);

  if (!matchRow) {
    SpreadsheetApp.getUi().alert(`매도할 종목을 찾을 수 없습니다.\n(코드: ${code}, 증권사: ${broker}, 구분: ${accountType}, 분류: ${category})`);
    return;
  }

  const existingQty = Number(sheet.getRange(matchRow, cols.QUANTITY).getValue() || 0);
  Logger.log(`보유 수량: ${existingQty}, 매도 수량: ${quantity}`);

  if (quantity > existingQty) {
    SpreadsheetApp.getUi().alert(`보유 수량(${existingQty})보다 많이 매도할 수 없습니다.`);
    return;
  }

  const totalRow = findSoldTotalRow(ss, sheet);
  const { startRow: soldStart } = getTrackerSoldData(ss);
  let soldRow = findEmptyRow(sheet, soldStart, totalRow - 1, cols.CODE);
  Logger.log(`매도 기록 행: ${soldRow}`);

  if (!soldRow) {
    sheet.insertRowsBefore(totalRow, 2);
    soldRow = totalRow;
    Logger.log(`빈 행 없음. ${totalRow}행 위에 2행 삽입.`);
  }

  const rowData = sheet.getRange(matchRow, 1, 1, 26).getValues()[0];
  sheet.getRange(soldRow, 1, 1, 26).setValues([rowData]);
  sheet.getRange(soldRow, cols.QUANTITY).setValue(quantity);
  sheet.getRange(soldRow, cols.UNIT_PRICE).setValue(price);
  sheet.getRange(soldRow, cols.FEE).setValue(fee);
  sheet.getRange(soldRow, cols.BUY_DATE).setValue(buyDate);
  Logger.log(`매도 기록 완료: ${soldRow}행`);

  const remainingQty = existingQty - quantity;
  if (remainingQty > 0) {
    sheet.getRange(matchRow, cols.QUANTITY).setValue(remainingQty);
  } else {
    sheet.getRange(matchRow, 1, 1, 26).clearContent();
  }
}

function findMatchingPosition(ss, sheet, code, broker, accountType, category, type) {
  const cols = getTrackerColumns(ss);
  let startRow, endRow;

  if (type === 'active') {
    const active = getTrackerActiveData(ss);
    startRow = active.startRow;
    endRow   = active.endRow;
  } else {
    const sold = getTrackerSoldData(ss);
    startRow = sold.startRow;
    endRow   = sold.endRow;
  }

  for (let i = startRow; i <= endRow; i++) {
    const rowCode        = String(sheet.getRange(i, cols.CODE).getValue()         || '').trim().toUpperCase();
    const rowBroker      = String(sheet.getRange(i, cols.BROKER).getValue()       || '').trim();
    const rowAccountType = String(sheet.getRange(i, cols.ACCOUNT_TYPE).getValue() || '').trim();
    const rowCategory    = String(sheet.getRange(i, cols.CATEGORY).getValue()     || '').trim();

    if (rowCode === code && rowBroker === broker && rowAccountType === accountType && rowCategory === category) {
      return i;
    }
  }
  return null;
}

function findEmptyRow(sheet, startRow, endRow, codeCol) {
  if (startRow > endRow) return null;
  const values = sheet.getRange(startRow, codeCol, endRow - startRow + 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0] || String(values[i][0]).trim() === '') return startRow + i;
  }
  return null;
}

// 매도완료 섹션에서 합계행 동적 찾기 (A열 비어있고 K열에 수치가 있는 행)
function findSoldTotalRow(ss, sheet) {
  const { startRow } = getTrackerSoldData(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return startRow;

  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 11).getValues();
  for (let i = 0; i < data.length; i++) {
    const code = data[i][0];
    const kVal = data[i][10];
    if (!code && kVal !== '' && kVal !== null && kVal !== 0) return startRow + i;
  }
  return lastRow;
}
