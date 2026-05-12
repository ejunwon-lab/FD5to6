/**
 * FixTrendLayout.js — [임시 1회 실행]
 * *추이 기록* Section C 정리 + 5/11~5/13 cfProfit 두 배 보정 + 일괄 포맷 적용
 *
 * 실행 순서:
 *   1) fixTrendSectionCLayout() — 잘못된 위치 데이터를 5행부터 연속 배치
 *   2) fixTrendDoubleProfit()   — 5/11~5/13 행 cfBuy/cfSell/cfProfit 절반 + totProfit 재계산
 *   3) applyTrendFormatAll()    — Section C 전체 행에 천단위 콤마/백분율 포맷 일괄 적용
 *
 * 또는 한 번에 → fixTrendAll()
 *
 * 실행 후 본 파일은 GAS 에디터에서 삭제해도 됨.
 */

function fixTrendAll() {
  fixTrendSectionCLayout();
  SpreadsheetApp.flush();
  fixTrendDoubleProfit();
  SpreadsheetApp.flush();
  applyTrendFormatAll();
  Logger.log('== fixTrendAll 완료 ==');
}

/**
 * row 2 (X2/AB2/AD2 등) 스냅샷을 Section C 마지막 데이터 행 값으로 동기화
 */
function fixTrendRow2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.TREND);
  if (!sheet) { Logger.log('*추이 기록* 시트 없음'); return; }

  const lastRowAll = sheet.getLastRow();
  if (lastRowAll < 5) { Logger.log('데이터 없음'); return; }
  const checkH   = Math.min(lastRowAll, 50) - 4;
  const useOldCol = sheet.getRange(5, 21, checkH, 1).getValues()
    .some(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[0])));
  const writeCol = useOldCol ? 21 : 1;

  const cStart = 5;
  const dates = sheet.getRange(cStart, writeCol, lastRowAll - cStart + 1, 1).getValues();
  let lastDataRow = cStart - 1;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i][0] !== '' && dates[i][0] != null) { lastDataRow = cStart + i; break; }
  }
  if (lastDataRow < cStart) { Logger.log('Section C 데이터 없음'); return; }

  // Section C 마지막 행(12열)을 row 2로 복사
  const lastVals = sheet.getRange(lastDataRow, writeCol, 1, 12).getValues()[0];
  sheet.getRange(2, writeCol, 1, 12).setValues([lastVals]);

  Logger.log(`row 2 ← ${lastDataRow}행 (${lastVals[0]}) 복사`);
  Logger.log(`  V2(cfBuy)=${lastVals[1]} W2(cfSell)=${lastVals[2]} X2(cfProfit)=${lastVals[3]}`);
  Logger.log(`  Z2(opBuy)=${lastVals[5]} AA2(opNow)=${lastVals[6]} AB2(opProfit)=${lastVals[7]}`);
  Logger.log(`  AD2(totProfit)=${lastVals[9]} AE2(diffProfit)=${lastVals[10]} AF2(diffRate)=${lastVals[11]}`);
}

function fixTrendSectionCLayout() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.TREND);
  if (!sheet) { Logger.log('*추이 기록* 시트 없음'); return; }

  const lastRowAll = sheet.getLastRow();
  if (lastRowAll < 5) { Logger.log('데이터 없음'); return; }
  const checkH   = Math.min(lastRowAll, 50) - 4;
  const useOldCol = sheet.getRange(5, 21, checkH, 1).getValues()
    .some(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[0])));
  const writeCol = useOldCol ? 21 : 1;

  const cStart = 5;
  const data = sheet.getRange(cStart, writeCol, lastRowAll - cStart + 1, 12).getValues();
  const filled = data.filter(row => row[0] !== '' && row[0] != null);

  filled.sort((a, b) => {
    const parseDate = v => v instanceof Date ? v : new Date(String(v).slice(0, 10));
    return parseDate(a[0]) - parseDate(b[0]);
  });

  sheet.getRange(cStart, writeCol, lastRowAll - cStart + 1, 12).clearContent();
  if (filled.length > 0) {
    sheet.getRange(cStart, writeCol, filled.length, 12).setValues(filled);
  }
  Logger.log(`Layout: Section C ${filled.length}개 행 → ${cStart}~${cStart + filled.length - 1}행 재배치`);
}

function fixTrendDoubleProfit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.TREND);
  if (!sheet) return;

  const lastRowAll = sheet.getLastRow();
  if (lastRowAll < 5) return;
  const checkH   = Math.min(lastRowAll, 50) - 4;
  const useOldCol = sheet.getRange(5, 21, checkH, 1).getValues()
    .some(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[0])));
  const writeCol = useOldCol ? 21 : 1;

  const cStart = 5;
  const targetDates = ['2026-05-11', '2026-05-12', '2026-05-13'];
  const refDate     = '2026-05-10';  // diffProfit 계산용 기준 이전 행

  const data = sheet.getRange(cStart, writeCol, lastRowAll - cStart + 1, 12).getValues();
  const dateOf = v => v instanceof Date
    ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd')
    : String(v).slice(0, 10);

  // 기준 행(5/10) totProfit 가져오기 (AD = index 9)
  let prevTot = 0;
  for (let i = 0; i < data.length; i++) {
    if (dateOf(data[i][0]) === refDate) {
      prevTot = Number(data[i][9]) || 0;
      Logger.log(`기준: ${refDate} totProfit = ${prevTot}`);
      break;
    }
  }

  // 5/11, 5/12, 5/13 행 순회하여 보정
  for (const tgt of targetDates) {
    let rowIdx = -1;
    for (let i = 0; i < data.length; i++) {
      if (dateOf(data[i][0]) === tgt) { rowIdx = i; break; }
    }
    if (rowIdx < 0) { Logger.log(`${tgt} 행 없음 — 건너뜀`); continue; }

    const sheetRow = cStart + rowIdx;
    const v = data[rowIdx];
    const oldCfBuy    = Number(v[1]) || 0;
    const oldCfSell   = Number(v[2]) || 0;
    const oldCfProfit = Number(v[3]) || 0;
    const opProfit    = Number(v[7]) || 0;
    const oldTotProfit= Number(v[9]) || 0;

    const newCfBuy    = Math.round(oldCfBuy / 2);
    const newCfSell   = Math.round(oldCfSell / 2);
    const newCfProfit = Math.round(oldCfProfit / 2);
    const newTotProfit= opProfit + newCfProfit;
    const diffProfit  = newTotProfit - prevTot;
    const diffRate    = prevTot ? Math.round(diffProfit / prevTot * 10000) / 100 : 0;

    // V(cfBuy), W(cfSell), X(cfProfit) 보정
    sheet.getRange(sheetRow, writeCol + 1, 1, 3)
      .setValues([[newCfBuy, newCfSell, newCfProfit]]);
    // AD(totProfit), AE(diffProfit), AF(diffRate) 보정
    sheet.getRange(sheetRow, writeCol + 9, 1, 3)
      .setValues([[newTotProfit, diffProfit, diffRate]]);

    Logger.log(`${tgt} (${sheetRow}행) 보정:`);
    Logger.log(`  cfProfit: ${oldCfProfit} → ${newCfProfit}`);
    Logger.log(`  totProfit: ${oldTotProfit} → ${newTotProfit}`);
    Logger.log(`  diffProfit: → ${diffProfit} (${diffRate}%)`);

    prevTot = newTotProfit;  // 다음 행의 diff 계산용
  }

  Logger.log('cfProfit 두 배 보정 완료');
}

function applyTrendFormatAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.TREND);
  if (!sheet) return;

  const lastRowAll = sheet.getLastRow();
  if (lastRowAll < 5) return;
  const checkH   = Math.min(lastRowAll, 50) - 4;
  const useOldCol = sheet.getRange(5, 21, checkH, 1).getValues()
    .some(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[0])));
  const writeCol = useOldCol ? 21 : 1;

  const cStart  = 5;
  // Section C 데이터가 있는 마지막 행 찾기
  const dates   = sheet.getRange(cStart, writeCol, lastRowAll - cStart + 1, 1).getValues();
  let cLastRow  = cStart - 1;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i][0] !== '' && dates[i][0] != null) { cLastRow = cStart + i; break; }
  }
  if (cLastRow < cStart) { Logger.log('포맷 적용할 데이터 없음'); return; }

  const numRows = cLastRow - cStart + 1;
  // Section C 포맷
  sheet.getRange(cStart, writeCol + 1,  numRows, 3).setNumberFormat('#,##0');     // V, W, X
  sheet.getRange(cStart, writeCol + 4,  numRows, 1).setNumberFormat('0.00"%"');   // Y
  sheet.getRange(cStart, writeCol + 5,  numRows, 3).setNumberFormat('#,##0');     // Z, AA, AB
  sheet.getRange(cStart, writeCol + 8,  numRows, 1).setNumberFormat('0.00"%"');   // AC
  sheet.getRange(cStart, writeCol + 9,  numRows, 2).setNumberFormat('#,##0');     // AD, AE
  sheet.getRange(cStart, writeCol + 11, numRows, 1).setNumberFormat('0.00"%"');   // AF

  // row 2 동일 포맷
  sheet.getRange(2, writeCol + 1,  1, 3).setNumberFormat('#,##0');
  sheet.getRange(2, writeCol + 4,  1, 1).setNumberFormat('0.00"%"');
  sheet.getRange(2, writeCol + 5,  1, 3).setNumberFormat('#,##0');
  sheet.getRange(2, writeCol + 8,  1, 1).setNumberFormat('0.00"%"');
  sheet.getRange(2, writeCol + 9,  1, 2).setNumberFormat('#,##0');
  sheet.getRange(2, writeCol + 11, 1, 1).setNumberFormat('0.00"%"');
  sheet.getRange(2, writeCol + 13, 1, 1).setNumberFormat('#,##0');                // AH
  sheet.getRange(2, writeCol + 14, 1, 1).setNumberFormat('0.00"%"');              // AI

  // Section A (B~L) 일괄 포맷 (B열 last filled까지)
  const aCol = 2;
  const colB = sheet.getRange(cStart, aCol, lastRowAll - cStart + 1, 1).getValues();
  let aLastRow = cStart - 1;
  for (let i = colB.length - 1; i >= 0; i--) {
    if (colB[i][0] !== '' && colB[i][0] != null) { aLastRow = cStart + i; break; }
  }
  if (aLastRow >= cStart) {
    const aRows = aLastRow - cStart + 1;
    sheet.getRange(cStart, aCol + 2, aRows, 2).setNumberFormat('#,##0');
    sheet.getRange(cStart, aCol + 4, aRows, 1).setNumberFormat('0.00"%"');
    sheet.getRange(cStart, aCol + 5, aRows, 2).setNumberFormat('#,##0');
    sheet.getRange(cStart, aCol + 7, aRows, 1).setNumberFormat('0.00"%"');
    sheet.getRange(cStart, aCol + 8, aRows, 2).setNumberFormat('#,##0');
    sheet.getRange(cStart, aCol + 10, aRows, 1).setNumberFormat('0.00"%"');
    // row 2
    sheet.getRange(2, aCol + 2, 1, 2).setNumberFormat('#,##0');
    sheet.getRange(2, aCol + 4, 1, 1).setNumberFormat('0.00"%"');
    sheet.getRange(2, aCol + 5, 1, 2).setNumberFormat('#,##0');
    sheet.getRange(2, aCol + 7, 1, 1).setNumberFormat('0.00"%"');
    sheet.getRange(2, aCol + 8, 1, 2).setNumberFormat('#,##0');
    sheet.getRange(2, aCol + 10, 1, 1).setNumberFormat('0.00"%"');
  }

  // Section B (N~S) 일괄 포맷
  const bCol = 14;
  const colN = sheet.getRange(cStart, bCol, lastRowAll - cStart + 1, 1).getValues();
  let bLastRow = cStart - 1;
  for (let i = colN.length - 1; i >= 0; i--) {
    if (colN[i][0] !== '' && colN[i][0] != null) { bLastRow = cStart + i; break; }
  }
  if (bLastRow >= cStart) {
    const bRows = bLastRow - cStart + 1;
    sheet.getRange(cStart, bCol + 1, bRows, 4).setNumberFormat('#,##0');
    sheet.getRange(cStart, bCol + 5, bRows, 1).setNumberFormat('0.00"%"');
    // row 2
    sheet.getRange(2, bCol + 1, 1, 4).setNumberFormat('#,##0');
    sheet.getRange(2, bCol + 5, 1, 1).setNumberFormat('0.00"%"');
  }

  Logger.log(`포맷 적용 완료: Section A ${aLastRow - cStart + 1}행 / B ${bLastRow - cStart + 1}행 / C ${numRows}행`);
}
