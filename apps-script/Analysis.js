/**
 * Analysis.gs
 * 투자 분석 및 성과 분석
 */

function updatePerformanceAnalysis(ss) {
  const trendSheet = getSheet(ss || SpreadsheetApp.getActiveSpreadsheet(), CONFIG.SHEET_NAMES.TREND);
  const chartSheet = getOrCreateSheet(ss || SpreadsheetApp.getActiveSpreadsheet(), CONFIG.SHEET_NAMES.CHART);
  
  if (!trendSheet) return;
  
  const dailyStartRow = CONFIG.TREND.DAILY_START_ROW;
  const dailyDateCol = CONFIG.TREND.DAILY_START_COL;
  const dailyChangeCol = dailyDateCol + 4;
  const lastRow = trendSheet.getLastRow();
  
  if (lastRow < dailyStartRow) return;
  
  let upDays = 0, downDays = 0, totalDays = 0;
  let upAmount = 0, downAmount = 0, totalAmount = 0;
  let ups = [], downs = [];
  
  // Bulk read for performance
  const numRows = lastRow - dailyStartRow + 1;
  const data = trendSheet.getRange(dailyStartRow, dailyDateCol, numRows, 5).getValues(); // Read Date(Col 1) to Change(Col 5)
  
  for (let i = 0; i < numRows; i++) {
    const dateValue = data[i][0];
    const changeValue = toNumberLoose(data[i][4]);
    
    if (!dateValue) continue;
    
    totalDays++;
    totalAmount += changeValue;
    
    if (changeValue > 0) { 
      upDays++; 
      upAmount += changeValue; 
      ups.push(changeValue); 
    } else if (changeValue < 0) { 
      downDays++; 
      downAmount += changeValue; 
      downs.push(changeValue); 
    }
  }
  
  const upRate = totalDays ? (upDays / totalDays * 100).toFixed(2) + '%' : '0%';
  const downRate = totalDays ? (downDays / totalDays * 100).toFixed(2) + '%' : '0%';
  
  const headers = [['구분', '# of Days', '%', '누적 금액', '최대값', '평균값']];
  const rows = [
    ['오른 날', upDays, upRate, upAmount, (ups.length ? Math.max(...ups) : ''), (ups.length ? Math.round(upAmount / ups.length) : '')],
    ['내린 날', downDays, downRate, downAmount, (downs.length ? Math.min(...downs) : ''), (downs.length ? Math.round(downAmount / downs.length) : '')],
    ['합계', totalDays, '100%', totalAmount, '-', '-']
  ];
  
  chartSheet.getRange('H23:M26').clearContent();
  chartSheet.getRange('H23:M23').setValues(headers);
  chartSheet.getRange('H24:M26').setValues(rows);
  chartSheet.getRange('K24:K26').setNumberFormat('#,##0');
  chartSheet.getRange('L24:L25').setNumberFormat('#,##0');
  chartSheet.getRange('M24:M25').setNumberFormat('#,##0');
}

function createInvestmentAnalysisSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ANALYSIS);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAMES.ANALYSIS);
  sheet.clear();
  sheet.getRange("A1").setValue("📊 투자 분석 시트 (E6:Q37 기준)");
  sheet.getRange("A1").setFontWeight("bold").setFontSize(14);
}

function _findHeaderColByText(sheet, headerText) {
  const headerRange = sheet.getRange(3, 1, 2, sheet.getLastColumn());
  const vals = headerRange.getValues();
  const norm = s => String(s || "").replace(/\s+/g, "").toLowerCase();
  const target = norm(headerText);
  for (let r = 0; r < vals.length; r++) {
    for (let c = 0; c < vals[r].length; c++) {
      if (norm(vals[r][c]) === target) return c + 1;
    }
  }
  return null;
}

function _applyNumberFormats(sheet, startRow, numRows, colCount) {
  if (numRows <= 0) return;
  const colRate = _findHeaderColByText(sheet, '수익률') || _findHeaderColByText(sheet, '수익율');
  const colDate = _findHeaderColByText(sheet, '매입일');
  const fmts = Array.from({ length: numRows }, () =>
    Array.from({ length: colCount }, () => '#,##0')
  );
  if (colRate) for (let r = 0; r < numRows; r++) fmts[r][colRate - 1] = '0.00%';
  if (colDate) for (let r = 0; r < numRows; r++) fmts[r][colDate - 1] = 'yyyy"년" m"월" d"일" (aaa)';
  sheet.getRange(startRow, 1, numRows, colCount).setNumberFormats(fmts);
}

function _applyNegativeRedConditional(sheet, startRow, numRows, colCount) {
  if (numRows <= 0) return;
  const range = sheet.getRange(startRow, 1, numRows, colCount);
  const rules = sheet.getConditionalFormatRules() || [];
  const filtered = rules.filter(r => {
    try {
      const cond = r.getBooleanCondition();
      return !(cond && cond.getCriteriaType() === SpreadsheetApp.BooleanCriteria.NUMBER_LESS_THAN);
    } catch (_) { return true; }
  });
  const redRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0)
    .setFontColor('#d93025')
    .setRanges([range])
    .build();
  filtered.push(redRule);
  sheet.setConditionalFormatRules(filtered);
}

function _copyHeaderWithFormatAndSizes(src, dest) {
  const srcHeader = src.getRange("E4:Q5");
  const colCount = srcHeader.getNumColumns();
  const destHeader = dest.getRange(3, 1, 2, colCount);
  destHeader.breakApart().clear({ contentsOnly: false });
  srcHeader.copyTo(destHeader, { contentsOnly: false });
  
  for (let i = 0; i < colCount; i++) {
    const w = src.getColumnWidth(5 + i);
    dest.setColumnWidth(1 + i, w);
  }
  dest.setRowHeight(3, src.getRowHeight(4));
  dest.setRowHeight(4, src.getRowHeight(5));
}

function refreshInvestmentAnalysis() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);
  let dest = ss.getSheetByName(CONFIG.SHEET_NAMES.ANALYSIS);
  if (!dest) dest = ss.insertSheet(CONFIG.SHEET_NAMES.ANALYSIS);
  
  _copyHeaderWithFormatAndSizes(src, dest);
  const colCount = src.getRange("E4:Q5").getNumColumns();
  
  const lastRow = src.getLastRow();
  const colEValues = src.getRange("E6:E" + lastRow).getValues().flat();
  let totalRow = null;
  for (let i = 0; i < colEValues.length; i++) {
    if (String(colEValues[i]).trim() === "합계") {
      totalRow = 6 + i;
      break;
    }
  }
  
  if (!totalRow) {
    SpreadsheetApp.getUi().alert("⚠️ '합계' 행을 찾을 수 없습니다 (E열에 '합계' 텍스트 필요)");
    return;
  }
  
  const dataEndRow = totalRow - 1;
  if (dataEndRow < 6) {
    SpreadsheetApp.getUi().alert("⚠️ 유효한 데이터 행이 없습니다.");
    return;
  }
  
  const dataRaw = src.getRange(`E6:Q${dataEndRow}`).getValues();
  const totalRaw = src.getRange(`E${totalRow}:Q${totalRow}`).getValues();
  
  const data = dataRaw.filter(row => row.some(cell => String(cell || "").trim() !== ""));
  
  if (dest.getLastRow() >= 5)
    dest.getRange(5, 1, dest.getMaxRows() - 4, colCount).clearContent().clearFormat();
  
  const start = 5;
  if (data.length > 0) dest.getRange(start, 1, data.length, colCount).setValues(data);
  const totalDestRow = start + data.length;
  dest.getRange(totalDestRow, 1, 1, colCount).setValues(totalRaw);
  
  const colBuy = _findHeaderColByText(dest, "운용 매입") || 8;
  const label = dest.getRange(totalDestRow, 1, 1, colBuy - 1);
  label.merge()
    .setValue("합계")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBackground("#e9f7ef");
  dest.getRange(totalDestRow, 1, 1, colCount)
    .setFontWeight("bold")
    .setBackground("#e9f7ef");
  
  _applyNumberFormats(dest, start, data.length + 1, colCount);
  _applyNegativeRedConditional(dest, start, data.length + 1, colCount);
  
  const tableRange = dest.getRange(start, 1, data.length + 1, colCount);
  tableRange.setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(
    `✅ 투자 분석 시트 갱신 완료\n데이터 ${data.length}행, 합계 ${totalRow}행, 빈줄 ${dataRaw.length - data.length}행 제거됨`
  );
}

function sortInvestmentAnalysis(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = ss.getSheetByName(CONFIG.SHEET_NAMES.ANALYSIS);
  if (!s) return;
  
  const map = {
    '수익률': ['수익률', '수익율'],
    '운용 수익': ['운용수익', '운용 수익'],
    '운용 매입': ['운용매입', '운용 매입'],
    '운용 현재가': ['운용현재가', '운용 현재가']
  };
  
  const candidates = map[key] || [key];
  let col = null;
  for (const n of candidates) {
    col = _findHeaderColByText(s, n);
    if (col) break;
  }
  
  if (!col) return;
  
  const lastRow = s.getLastRow();
  const lastCol = s.getLastColumn();
  
  let totalRow = lastRow;
  const colAValues = s.getRange(5, 1, lastRow - 4, 1).getValues().flat();
  for (let i = colAValues.length - 1; i >= 0; i--) {
    const text = String(colAValues[i] || '').trim();
    if (text === '합계') {
      totalRow = 5 + i;
      break;
    }
  }
  
  const dataEnd = totalRow - 1;
  if (dataEnd <= 5) return;
  
  s.getRange(5, 1, dataEnd - 4, lastCol)
    .sort({ column: col, ascending: false });
  
  SpreadsheetApp.flush();
}

function menuSortRate() { sortInvestmentAnalysis('수익률'); }
function menuSortProfit() { sortInvestmentAnalysis('운용 수익'); }
function menuSortBuy() { sortInvestmentAnalysis('운용 매입'); }
function menuSortNow() { sortInvestmentAnalysis('운용 현재가'); }
