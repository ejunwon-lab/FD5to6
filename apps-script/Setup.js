/**
 * Setup.gs
 * ⚙️ 설정 시트 생성 및 관리
 *
 * 사용법:
 * 1. 메뉴 → 🛠️ 시스템 관리 → ⚙️ 설정 시트 열기
 * 2. 숫자/텍스트 수정 후 B1 체크박스 체크 → 자동 적용
 */

const SETUP_SHEET_NAME = '⚙️ 설정';

// ── 행 설정 항목 (구조적으로 고정된 것만, 데이터 끝 행은 자동 감지) ──
const ROW_SETTINGS = [
  { key: 'ACTIVE_HEADER_ROW', label: '운용중 헤더 행',       default: 5,    desc: '운용중 섹션 헤더 행 번호 (데이터 시작 = 헤더+1, 자동)' },
  { key: 'ACTIVE_TOTAL_ROW',  label: '합계 행',               default: 40,   desc: '운용중 합계 행 번호 (데이터 끝 = 합계-1, 자동)' },
  { key: 'SOLD_HEADER_START', label: '매도완료 헤더 시작 행', default: 42,   desc: '매도완료 헤더 시작 행 (데이터 끝은 A열 자동 감지)' },
  { key: 'SOLD_HEADER_END',   label: '매도완료 헤더 끝 행',   default: 43,   desc: '매도완료 헤더 끝 행 (데이터 시작 = 헤더끝+1, 자동)' },
  { key: 'FX_USD_CELL',       label: 'USD 환율 셀',           default: 'Q3', desc: 'USD/KRW 환율이 입력된 셀 주소' },
  { key: 'FX_GBP_CELL',       label: 'GBP 환율 셀',           default: 'Q2', desc: 'GBP/KRW 환율이 입력된 셀 주소' },
];

// ── 열 헤더 설정 항목 정의 ────────────────────────────────────────────
const COL_SETTINGS = [
  { key: 'CODE',          label: '종목코드',      desc: 'A열 — 종목 코드 (예: 005930)' },
  { key: 'CATEGORY',      label: '분류',          desc: 'B열 — 자산 분류' },
  { key: 'NAME',          label: '종목명',        desc: 'C열 — 종목 이름' },
  { key: 'BUY_DATE',      label: '매입일',        desc: 'E열 — 매입한 날짜' },
  { key: 'BROKER',        label: '증권사',        desc: 'F열 — 증권사 이름' },
  { key: 'ACCOUNT_TYPE',  label: '구분',          desc: 'G열 — 계좌 구분 (종합, ISA 등)' },
  { key: 'STOCK_NAME',    label: '종목',          desc: 'H열·R열 공통 — 표시용 종목명' },
  { key: 'QUANTITY',      label: '수량',          desc: 'I열 — 보유 수량' },
  { key: 'UNIT_PRICE',    label: '단가',          desc: 'J열 — 매입 단가' },
  { key: 'OP_BUY',        label: '운용 매입',     desc: 'K열 — 운용 매입 금액' },
  { key: 'FEE',           label: '수수료',        desc: 'L열 — 거래 수수료' },
  { key: 'CURRENT_PRICE', label: '현재 단가',     desc: 'M열 — 현재 주가' },
  { key: 'OP_CURRENT',    label: '운용 현재가',   desc: 'N열 — 운용 현재 평가액' },
  { key: 'OP_PROFIT',     label: '운용 수익',     desc: 'O열 — 운용 수익 금액' },
  { key: 'PROFIT_RATE',   label: '수익율',        desc: 'P열 — 수익률 (%)' },
  { key: 'INVEST_DAYS',   label: '투자기간(일)',   desc: 'Q열 — 투자 기간 (일수)' },
  { key: 'STATUS_CHANGE', label: '당일 등락',     desc: 'S열 — 당일 가격 변동' },
  { key: 'STATUS_PCT',    label: '당일(%)',       desc: 'T열 — 당일 변동률 (%)' },
  { key: 'STATUS_M1',     label: '1개월',         desc: 'U열 — 1개월 수익률' },
  { key: 'STATUS_M3',     label: '3개월',         desc: 'V열 — 3개월 수익률' },
  { key: 'STATUS_M6',     label: '6개월',         desc: 'W열 — 6개월 수익률' },
  { key: 'STATUS_Y1',     label: '1년',           desc: 'X열 — 1년 수익률' },
  { key: 'STATUS_HIGH52', label: '52주 최고가',   desc: 'Y열 — 52주 최고 가격' },
  { key: 'STATUS_LOW52',  label: '52주 최저가',   desc: 'Z열 — 52주 최저 가격' },
];

// 설정 시트 내 섹션 시작 행
const SETUP_ROWS = {
  CHECKBOX:       1,
  ROW_SECTION:    4,
  ROW_DATA_START: 6,  // ROW_SECTION + 2 (헤더행 포함)
  COL_SECTION:    null, // 동적으로 계산
  COL_DATA_START: null,
};

/**
 * 설정 시트 생성 또는 열기
 */
function openSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETUP_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SETUP_SHEET_NAME);
    buildSettingsSheet(ss, sheet);
  } else {
    refreshSettingsValues(ss, sheet);
  }

  sheet.activate();
  ss.toast('값을 수정한 뒤 A1 체크박스를 체크하면 자동 적용됩니다.', '⚙️ 설정 시트', 5);
}

/**
 * 설정 시트 전체 재생성
 */
function buildSettingsSheet(ss, sheet) {
  sheet.clearContents();
  sheet.clearFormats();

  const trackerName = CONFIG.SHEET_NAMES.TRACKER;

  // ── A1: 체크박스 + 안내 ─────────────────────────────────────────
  sheet.getRange('A1').insertCheckboxes().setValue(false);
  sheet.getRange('B1').setValue('← 수정 완료 후 체크박스를 체크하면 설정이 자동 적용됩니다')
    .setFontColor('#1a73e8').setFontWeight('bold');
  sheet.getRange('A1:D1').setBackground('#e8f0fe');

  // ── 행 범위 섹션 ────────────────────────────────────────────────
  const rowSection = SETUP_ROWS.ROW_SECTION;
  sheet.getRange(rowSection, 1).setValue('📋 행 범위 설정').setFontWeight('bold').setFontSize(12);
  sheet.getRange(rowSection, 1, 1, 4).setBackground('#f1f3f4');

  sheet.getRange(rowSection + 1, 1).setValue('항목').setFontWeight('bold');
  sheet.getRange(rowSection + 1, 2).setValue('현재값').setFontWeight('bold');
  sheet.getRange(rowSection + 1, 3).setValue('설명').setFontWeight('bold');
  sheet.getRange(rowSection + 1, 1, 1, 3).setBackground('#e2e2e2');

  const rowValues = readCurrentRowSettings(ss);

  ROW_SETTINGS.forEach((item, i) => {
    const r = rowSection + 2 + i;
    sheet.getRange(r, 1).setValue(item.label);
    sheet.getRange(r, 2).setValue(rowValues[item.key] || item.default);
    sheet.getRange(r, 3).setValue(item.desc).setFontColor('#666666');
    if (i % 2 === 0) sheet.getRange(r, 1, 1, 3).setBackground('#fafafa');
  });

  // ── 열 헤더 섹션 ────────────────────────────────────────────────
  const colSection = rowSection + 2 + ROW_SETTINGS.length + 2;
  SETUP_ROWS.COL_SECTION    = colSection;
  SETUP_ROWS.COL_DATA_START = colSection + 2;

  sheet.getRange(colSection, 1).setValue('🔤 열 헤더 설정').setFontWeight('bold').setFontSize(12);
  sheet.getRange(colSection, 1, 1, 4).setBackground('#f1f3f4');

  sheet.getRange(colSection, 4).setValue('⚠️ 열 이름이 시트와 다르면 자동 감지가 안됩니다')
    .setFontColor('#d93025').setFontStyle('italic');

  sheet.getRange(colSection + 1, 1).setValue('항목').setFontWeight('bold');
  sheet.getRange(colSection + 1, 2).setValue('현재 헤더명').setFontWeight('bold');
  sheet.getRange(colSection + 1, 3).setValue('설명').setFontWeight('bold');
  sheet.getRange(colSection + 1, 1, 1, 3).setBackground('#e2e2e2');

  COL_SETTINGS.forEach((item, i) => {
    const r = colSection + 2 + i;
    sheet.getRange(r, 1).setValue(item.label);
    sheet.getRange(r, 2).setValue(CONFIG.HEADER_TEXTS[item.key] || item.label);
    sheet.getRange(r, 3).setValue(item.desc).setFontColor('#666666');
    if (i % 2 === 0) sheet.getRange(r, 1, 1, 3).setBackground('#fafafa');
  });

  // ── 열 너비 조정 ────────────────────────────────────────────────
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 140);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 300);
}

/**
 * 현재 Named Range에서 행 설정값 읽기
 */
function readCurrentRowSettings(ss) {
  const vals = {};
  try {
    const tryGet = name => { try { return ss.getRangeByName(name); } catch(e) { return null; } };
    const nr = CONFIG.NAMED_RANGES;
    const activeHeader = tryGet(nr.ACTIVE_HEADER);
    const activeTotal  = tryGet(nr.ACTIVE_TOTAL);
    const soldHeader   = tryGet(nr.SOLD_HEADER);
    const fxUsd        = tryGet(nr.FX_USD);
    const fxGbp        = tryGet(nr.FX_GBP);

    if (activeHeader) vals['ACTIVE_HEADER_ROW'] = activeHeader.getRow();
    if (activeTotal)  vals['ACTIVE_TOTAL_ROW']  = activeTotal.getRow();
    if (soldHeader)   { vals['SOLD_HEADER_START'] = soldHeader.getRow(); vals['SOLD_HEADER_END'] = soldHeader.getLastRow(); }
    if (fxUsd)        vals['FX_USD_CELL'] = fxUsd.getA1Notation();
    if (fxGbp)        vals['FX_GBP_CELL'] = fxGbp.getA1Notation();
  } catch(e) {
    Logger.log('readCurrentRowSettings error: ' + e);
  }
  return vals;
}

/**
 * 설정 시트가 이미 있을 때 현재값만 갱신
 */
function refreshSettingsValues(ss, sheet) {
  const trackerName = CONFIG.SHEET_NAMES.TRACKER;
  const rowValues = readCurrentRowSettings(ss);
  const rowStart = SETUP_ROWS.ROW_DATA_START;

  ROW_SETTINGS.forEach((item, i) => {
    const val = rowValues[item.key];
    if (val !== undefined) sheet.getRange(rowStart + i, 2).setValue(val);
  });
}

/**
 * 설정 시트에서 값을 읽어 Named Range와 Config 갱신
 * onEdit 체크박스 또는 메뉴에서 호출
 */
function applySettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETUP_SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('⚠️ 설정 시트가 없습니다. 먼저 설정 시트를 여세요.');
    return;
  }

  const rowStart = SETUP_ROWS.ROW_DATA_START;
  const rowVals  = {};
  ROW_SETTINGS.forEach((item, i) => {
    rowVals[item.key] = sheet.getRange(rowStart + i, 2).getValue();
  });

  const trackerName = CONFIG.SHEET_NAMES.TRACKER;
  const nr = CONFIG.NAMED_RANGES;

  const toRow = v => parseInt(v) || 0;

  const hRow  = toRow(rowVals.ACTIVE_HEADER_ROW);
  const tRow  = toRow(rowVals.ACTIVE_TOTAL_ROW);
  const shStart = toRow(rowVals.SOLD_HEADER_START);
  const shEnd   = toRow(rowVals.SOLD_HEADER_END);

  const definitions = [
    { name: nr.ACTIVE_HEADER, a1: `${trackerName}!A${hRow}:Z${hRow}` },
    { name: nr.ACTIVE_TOTAL,  a1: `${trackerName}!A${tRow}:Z${tRow}` },
    { name: nr.SOLD_HEADER,   a1: `${trackerName}!A${shStart}:Z${shEnd}` },
    { name: nr.FX_USD,        a1: `${trackerName}!${rowVals.FX_USD_CELL}` },
    { name: nr.FX_GBP,        a1: `${trackerName}!${rowVals.FX_GBP_CELL}` },
  ];

  const existing = {};
  ss.getNamedRanges().forEach(r => { existing[r.getName()] = r; });

  const results = definitions.map(({ name, a1 }) => {
    try {
      const range = ss.getRange(a1);
      if (existing[name]) { existing[name].setRange(range); return `✏️ ${name}`; }
      else                { ss.setNamedRange(name, range);  return `✅ ${name}`; }
    } catch(e) {
      return `❌ ${name}: ${e.message}`;
    }
  });

  // 열 헤더 설정 읽어서 Config 동적 패치
  const colSectionRow = findColSectionRow(sheet);
  if (colSectionRow) {
    const colStart = colSectionRow + 2;
    COL_SETTINGS.forEach((item, i) => {
      const newHeader = sheet.getRange(colStart + i, 2).getValue().toString().trim();
      if (newHeader) CONFIG.HEADER_TEXTS[item.key] = newHeader;
    });
  }

  clearTrackerColumnCache();

  // 체크박스 해제
  sheet.getRange('A1').setValue(false);

  SpreadsheetApp.getUi().alert('✅ 설정 적용 완료!\n\n' + results.join('\n'));
}

/**
 * 설정 시트에서 열 헤더 섹션 시작 행 찾기
 */
function findColSectionRow(sheet) {
  const data = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).includes('열 헤더 설정')) return i + 1;
  }
  return null;
}
