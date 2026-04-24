/**
 * Utils.gs
 * 공통 유틸리티 함수
 */

function getSheet(ss, name) { return ss.getSheetByName(name); }

function getOrCreateSheet(ss, name) { 
  return getSheet(ss, name) || ss.insertSheet(name); 
}

function getValue(sheet, row, col) { 
  return sheet.getRange(row, col).getValue(); 
}

function setValue(sheet, row, col, value) { 
  sheet.getRange(row, col).setValue(value); 
}

function toNumberLoose(v) { 
  if (v === '' || v == null || typeof v === 'undefined') return 0; 
  const n = Number(String(v).replace(/,/g, '').replace('%', '')); 
  return isNaN(n) ? 0 : n; 
}

function fmtPct(n) { 
  return (isFinite(n) ? n : 0).toFixed(2) + '%'; 
}

function fmtNum(v) { 
  return isNaN(v) ? "" : Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 0 }); 
}

function norm(s) { 
  return String(s || '').replace(/\s+/g, '').toLowerCase(); 
}

function findHeaderCellFlexible(sheet, headerText) {
  const f = sheet.createTextFinder(headerText).matchCase(false).useRegularExpression(false).findNext();
  if (f) return { row: f.getRow(), col: f.getColumn() };
  
  const vals = sheet.getDataRange().getValues();
  const t = norm(headerText);
  for (let r = 0; r < vals.length; r++) {
    for (let c = 0; c < vals[r].length; c++) {
      if (norm(vals[r][c]) === t) return { row: r + 1, col: c + 1 };
    }
  }
  return null;
}

function getNextHeaderRow(allHeaders, currentHeaderRow) {
  const rows = allHeaders.map(h => h.row).filter(r => r > currentHeaderRow);
  return rows.length ? Math.min(...rows) : null;
}

function getLastNumericUnderHeader(sheet, headerPos, nextHeaderRow) {
  const start = headerPos.row + 1;
  const col = headerPos.col;
  const end = nextHeaderRow ? nextHeaderRow - 1 : sheet.getLastRow();
  const height = Math.max(end - start + 1, 0);
  
  if (height <= 0) return { value: 0, row: null };
  
  const vals = sheet.getRange(start, col, height, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    const v = vals[i][0];
    if (v === '' || v == null) continue;
    const num = Number(String(v).replace(/,/g, '').replace('%', ''));
    if (!isNaN(num)) return { value: num, row: start + i };
  }
  return { value: 0, row: null };
}

function lastFilledRowInColumn(sheet, startRow, col) {
  const lastRow = sheet.getLastRow();
  const height = Math.max(lastRow - startRow + 1, 0);
  if (height <= 0) return startRow - 1;

  const vals = sheet.getRange(startRow, col, height, 1).getValues().flat();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] !== "" && vals[i] !== null) return startRow + i;
  }
  return startRow - 1;
}

// ─── Named Range 헬퍼 ────────────────────────────────────────────────

function getNamedRange(ss, name) {
  const range = ss.getRangeByName(name);
  if (!range) throw new Error(`Named Range '${name}' 가 설정되지 않았습니다. 구글 시트 → 데이터 → 이름이 지정된 범위를 확인해주세요.`);
  return range;
}

// ─── 헤더 기반 컬럼 동적 감지 ───────────────────────────────────────

// sheet의 headerRow 행에서 headerText와 일치하는 열 번호(1-based) 반환.
// approxCol 제공 시 중복 헤더 중 가장 가까운 열 반환.
function findColumnByHeader(sheet, headerRow, headerText, approxCol) {
  const headers = sheet.getRange(headerRow, 1, 1, 26).getValues()[0];
  const text = headerText.trim();
  const matches = [];
  headers.forEach((h, i) => {
    if (h.toString().trim() === text) matches.push(i + 1);
  });
  if (matches.length === 0) return null;
  if (matches.length === 1 || !approxCol) return matches[0];
  return matches.reduce((best, col) =>
    Math.abs(col - approxCol) < Math.abs(best - approxCol) ? col : best
  );
}

// 트래커 시트 컬럼 맵을 헤더 텍스트 기반으로 동적 빌드 (호출당 1회 캐시).
// 반환: { CODE, CATEGORY, NAME, ... } → 1-based 열 번호
let _trackerColCache = null;

function getTrackerColumns(ss) {
  if (_trackerColCache) return _trackerColCache;
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);
  if (!sheet) throw new Error('투자수익 트래커 시트를 찾을 수 없습니다.');
  const h = CONFIG.HEADER_TEXTS;
  const HR = CONFIG.HEADER_ROW.ACTIVE;
  _trackerColCache = {
    CODE:          findColumnByHeader(sheet, HR, h.CODE,          1),
    CATEGORY:      findColumnByHeader(sheet, HR, h.CATEGORY,      2),
    NAME:          findColumnByHeader(sheet, HR, h.NAME,          3),
    BUY_DATE:      findColumnByHeader(sheet, HR, h.BUY_DATE,      5),
    BROKER:        findColumnByHeader(sheet, HR, h.BROKER,        6),
    ACCOUNT_TYPE:  findColumnByHeader(sheet, HR, h.ACCOUNT_TYPE,  7),
    STOCK_NAME:    findColumnByHeader(sheet, HR, h.STOCK_NAME,    8),
    QUANTITY:      findColumnByHeader(sheet, HR, h.QUANTITY,      9),
    UNIT_PRICE:    findColumnByHeader(sheet, HR, h.UNIT_PRICE,    10),
    OP_BUY:        findColumnByHeader(sheet, HR, h.OP_BUY,        11),
    FEE:           findColumnByHeader(sheet, HR, h.FEE,           12),
    CURRENT_PRICE: findColumnByHeader(sheet, HR, h.CURRENT_PRICE, 13),
    OP_CURRENT:    findColumnByHeader(sheet, HR, h.OP_CURRENT,    14),
    OP_PROFIT:     findColumnByHeader(sheet, HR, h.OP_PROFIT,     15),
    PROFIT_RATE:   findColumnByHeader(sheet, HR, h.PROFIT_RATE,   16),
    INVEST_DAYS:   findColumnByHeader(sheet, HR, h.INVEST_DAYS,   17),
    STATUS_NAME:   findColumnByHeader(sheet, HR, h.STOCK_NAME,    18), // R열 (종목 현황용, H와 동일 헤더)
    STATUS_CHANGE: findColumnByHeader(sheet, HR, h.STATUS_CHANGE, 19),
    STATUS_PCT:    findColumnByHeader(sheet, HR, h.STATUS_PCT,    20),
    STATUS_M1:     findColumnByHeader(sheet, HR, h.STATUS_M1,     21),
    STATUS_M3:     findColumnByHeader(sheet, HR, h.STATUS_M3,     22),
    STATUS_M6:     findColumnByHeader(sheet, HR, h.STATUS_M6,     23),
    STATUS_Y1:     findColumnByHeader(sheet, HR, h.STATUS_Y1,     24),
    STATUS_HIGH52: findColumnByHeader(sheet, HR, h.STATUS_HIGH52, 25),
    STATUS_LOW52:  findColumnByHeader(sheet, HR, h.STATUS_LOW52,  26),
  };
  return _trackerColCache;
}

function clearTrackerColumnCache() {
  _trackerColCache = null;
}

// Named Range에서 행 범위 정보 추출: { startRow, endRow, numRows }
function getRowRange(ss, namedRangeName) {
  const range = getNamedRange(ss, namedRangeName);
  return {
    startRow: range.getRow(),
    endRow:   range.getLastRow(),
    numRows:  range.getNumRows(),
  };
}

// 컬럼 맵을 0-based 배열 인덱스로 변환
function _buildIdx(cols) {
  const idx = {};
  Object.keys(cols).forEach(k => { if (cols[k] !== null) idx[k] = cols[k] - 1; });
  return idx;
}

// 운용중 데이터 동적 감지:
//   시작 행 = ACTIVE_HEADER 다음 행
//   끝 행   = ACTIVE_TOTAL 바로 윗 행
// 반환: { values, idx, range, startRow, endRow }
function getTrackerActiveData(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);
  const headerRow = getNamedRange(ss, CONFIG.NAMED_RANGES.ACTIVE_HEADER).getRow();
  const totalRow  = getNamedRange(ss, CONFIG.NAMED_RANGES.ACTIVE_TOTAL).getRow();
  const startRow  = headerRow + 1;
  const endRow    = totalRow - 1;

  if (endRow < startRow) return { values: [], idx: _buildIdx(getTrackerColumns(ss)), range: null, startRow, endRow };

  const range  = sheet.getRange(startRow, 1, endRow - startRow + 1, 26);
  const values = range.getValues();
  const idx    = _buildIdx(getTrackerColumns(ss));
  return { values, idx, range, startRow, endRow };
}

// 매도완료 데이터 동적 감지:
//   시작 행 = SOLD_HEADER 마지막 행 + 1
//   끝 행   = A열 기준 마지막 데이터 행 (자동 스캔)
// 반환: { values, idx, range, startRow, endRow }
function getTrackerSoldData(ss) {
  const sheet       = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);
  const soldHeader  = getNamedRange(ss, CONFIG.NAMED_RANGES.SOLD_HEADER);
  const startRow    = soldHeader.getLastRow() + 1;
  const endRow      = lastFilledRowInColumn(sheet, startRow, 1);

  if (endRow < startRow) return { values: [], idx: _buildIdx(getTrackerColumns(ss)), range: null, startRow, endRow };

  const range  = sheet.getRange(startRow, 1, endRow - startRow + 1, 26);
  const values = range.getValues();
  const idx    = _buildIdx(getTrackerColumns(ss));
  return { values, idx, range, startRow, endRow };
}
