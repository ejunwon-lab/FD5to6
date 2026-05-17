/**
 * NewSystem.js — 새 포트폴리오 DB 시스템 (독립 버전)
 *
 * 시트 구성:
 *   *거래_원장*    : 전체 거래 이력 (불변 원장)
 *   *거래_입력폼*  : 거래 입력 UI (체크박스 → 원장 자동 추가)
 *   *현재가_이력*  : 날짜 × 종목코드 Wide 포맷 현재단가
 *   *보유현황*     : 원장 기반 현재 보유현황 자동 계산
 *   *실현손익*     : 매도 완료 건별 확정 손익
 *   *대시보드*     : 요약 대시보드
 *   *설정*         : FX 환율 수동 입력
 */

const NS = {
  LEDGER:        '*거래_원장*',
  FORM:          '*거래_입력폼*',
  PRICE_HISTORY: '*현재가_이력*',
  POSITION:      '*보유현황*',
  REALIZED_PNL:  '*실현손익*',
  SETTINGS:      '*설정*',
  TREND:         '*추이 기록*',
  HOLIDAYS:      '*휴장일*',
  STOCK_METRICS: '*종목지표*',

  BROKERS:    ['미래에셋투자증권', '삼성증권'],
  ACCOUNTS: {
    '미래에셋투자증권': ['종합_랩', '퇴직연금_개인IRP'],
    '삼성증권':        ['종합', 'ISA', '퇴직연금_개인IRP(범용)'],
  },
  CATEGORIES: ['국내주식', '국내ETF', '해외주식', '해외ETF', '펀드', '예금', '보험', '기타'],
  TX_TYPES:   ['매수', '매도'],
  KIS_SKIP:   ['펀드', '예금', '보험', '기타'],

  FORM_COL: 2,
  FR: { DATE:3, TYPE:4, CODE:5, NAME:6, CAT:7, BROKER:8, ACCT:9, QTY:10, PRICE:11, AMT:12, FEE:13, MEMO:14, SUBMIT:16 },

  LC: { DATE:1, TYPE:2, CODE:3, NAME:4, CAT:5, BROKER:6, ACCT:7, QTY:8, PRICE:9, AMT:10, FEE:11, MEMO:12 },

  HDR_BG:   '#1a1a2e',
  HDR_FG:   '#ffffff',
  ROW_EVEN: '#f8f9fa',
  ROW_ODD:  '#ffffff',
};

// ═══════════════════════════════════════════════════
//  [수동 실행] 새 시스템 시트 초기화 (최초 1회)
// ═══════════════════════════════════════════════════

function setupNewSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  _setupLedgerSheet(ss);
  _setupFormSheet(ss);
  _setupPriceHistorySheet(ss);
  _setupPositionSheet(ss);
  _setupRealizedPnLSheet(ss);
  _setupSettingsSheet(ss);
  ss.toast('새 시스템 시트 6개 생성 완료', '✅ 완료', 4);
  Logger.log('setupNewSystem 완료');
}

// ───────────────────────────────────────────────────
//  *거래_원장*
// ───────────────────────────────────────────────────

function _setupLedgerSheet(ss) {
  if (ss.getSheetByName(NS.LEDGER)) { Logger.log('*거래_원장* 이미 존재'); return; }
  const sheet = ss.insertSheet(NS.LEDGER);

  const header = ['날짜','구분','종목코드','종목명','분류','증권사','계좌','수량','단가','금액','수수료','메모'];
  sheet.getRange(1, 1, 1, header.length)
    .setValues([header]).setFontWeight('bold')
    .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sheet.setFrozenRows(1);
  [110, 60, 90, 220, 80, 130, 160, 70, 110, 130, 80, 160]
    .forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

// ───────────────────────────────────────────────────
//  *거래_입력폼*
// ───────────────────────────────────────────────────

function _setupFormSheet(ss) {
  if (ss.getSheetByName(NS.FORM)) { Logger.log('*거래_입력폼* 이미 존재'); return; }
  const sheet = ss.insertSheet(NS.FORM);
  const C = NS.FORM_COL;
  const FR = NS.FR;

  sheet.getRange(1, 1, 1, 3).merge()
    .setValue('📝 거래 입력')
    .setFontSize(13).setFontWeight('bold')
    .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  const fields = [
    [FR.DATE,  '날짜',   new Date()],
    [FR.TYPE,  '구분',   '매수'],
    [FR.CODE,  '종목코드', ''],
    [FR.NAME,  '종목명',  ''],
    [FR.CAT,   '분류',   '국내ETF'],
    [FR.BROKER,'증권사', '삼성증권'],
    [FR.ACCT,  '계좌',   '종합'],
    [FR.QTY,   '수량',   ''],
    [FR.PRICE, '단가',   ''],
    [FR.AMT,   '금액',   ''],
    [FR.FEE,   '수수료',  0],
    [FR.MEMO,  '메모',   ''],
  ];

  fields.forEach(([row, label, def]) => {
    sheet.getRange(row, 1).setValue(label)
      .setFontWeight('bold').setBackground('#f0f4f8')
      .setVerticalAlignment('middle');
    if (row === FR.AMT) {
      sheet.getRange(row, C)
        .setFormula(`=IF(AND(ISNUMBER(B${FR.QTY}),ISNUMBER(B${FR.PRICE})),B${FR.QTY}*B${FR.PRICE},"")`)
        .setBackground('#e8f4ea').setFontColor('#444444');
    } else {
      sheet.getRange(row, C).setValue(def);
    }
    sheet.getRange(row, C)
      .setBorder(true,true,true,true,false,false,'#cccccc',SpreadsheetApp.BorderStyle.SOLID);
  });

  sheet.getRange(FR.DATE, C).setNumberFormat('yyyy-MM-dd');

  const dv = (list) => SpreadsheetApp.newDataValidation().requireValueInList(list, true).build();
  sheet.getRange(FR.TYPE,   C).setDataValidation(dv(NS.TX_TYPES));
  sheet.getRange(FR.CAT,    C).setDataValidation(dv(NS.CATEGORIES));
  sheet.getRange(FR.BROKER, C).setDataValidation(dv(NS.BROKERS));
  const allAccounts = [...new Set(Object.values(NS.ACCOUNTS).flat())];
  sheet.getRange(FR.ACCT,   C).setDataValidation(dv(allAccounts));

  sheet.getRange(FR.SUBMIT - 1, 1, 1, 3).setBackground('#dddddd');
  sheet.setRowHeight(FR.SUBMIT - 1, 6);

  sheet.getRange(FR.SUBMIT, 1).setValue('✅ 체크하면 원장에 추가')
    .setFontWeight('bold').setBackground('#fff3cd');
  sheet.getRange(FR.SUBMIT, C).insertCheckboxes()
    .setBackground('#fff3cd');

  sheet.getRange(FR.SUBMIT + 2, 1, 1, 4).merge()
    .setValue('📋 최근 입력 5건').setFontWeight('bold').setBackground('#f0f4f8');

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 30);
  sheet.setFrozenRows(1);
}

// ───────────────────────────────────────────────────
//  *현재가_이력*
// ───────────────────────────────────────────────────

function _setupPriceHistorySheet(ss) {
  if (ss.getSheetByName(NS.PRICE_HISTORY)) { Logger.log('*현재가_이력* 이미 존재'); return; }
  const sheet = ss.insertSheet(NS.PRICE_HISTORY);
  sheet.getRange(1, 1).setValue('날짜')
    .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sheet.setColumnWidth(1, 110);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
}

// ───────────────────────────────────────────────────
//  *보유현황*
// ───────────────────────────────────────────────────

function _setupPositionSheet(ss) {
  if (ss.getSheetByName(NS.POSITION)) { Logger.log('*보유현황* 이미 존재'); return; }
  const sheet = ss.insertSheet(NS.POSITION);
  const header = ['종목코드','종목명','분류','증권사','계좌','보유기간','보유수량','평균단가','매입금액','현재단가','평가금액','손익','수익률(%)','수동평가금액','비고'];
  sheet.getRange(1, 1, 1, header.length)
    .setValues([header]).setFontWeight('bold')
    .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sheet.setFrozenRows(1);
  [90,220,80,130,170,90,70,110,130,110,130,110,90,120,100]
    .forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

// ───────────────────────────────────────────────────
//  *실현손익*
// ───────────────────────────────────────────────────

function _setupRealizedPnLSheet(ss) {
  if (ss.getSheetByName(NS.REALIZED_PNL)) { Logger.log('*실현손익* 이미 존재'); return; }
  const sheet = ss.insertSheet(NS.REALIZED_PNL);
  const header = ['매도일','종목코드','종목명','분류','증권사','계좌',
                  '매도수량','매도단가','매도금액','평균매입단가','매입원가','수수료','실현손익','수익률(%)'];
  sheet.getRange(1, 1, 1, header.length)
    .setValues([header]).setFontWeight('bold')
    .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sheet.setFrozenRows(1);
  [100,90,220,80,130,170,70,110,130,110,130,80,110,90]
    .forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

// ───────────────────────────────────────────────────
//  *설정* (FX 환율 — GOOGLEFINANCE 자동 조회)
// ───────────────────────────────────────────────────

function _setupSettingsSheet(ss) {
  if (ss.getSheetByName(NS.SETTINGS)) return;
  const sheet = ss.insertSheet(NS.SETTINGS);
  sheet.getRange(1, 1, 1, 3)
    .setValues([['항목', '값', '설명']]).setFontWeight('bold')
    .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sheet.getRange(2, 1, 2, 3).setValues([
    ['USD/KRW', 1400, 'updateAllNew() 실행 시 GOOGLEFINANCE로 자동 갱신'],
    ['GBP/KRW', 1700, 'updateAllNew() 실행 시 GOOGLEFINANCE로 자동 갱신'],
  ]);
  [120, 100, 260].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(1);
}

// GOOGLEFINANCE로 환율 자동 업데이트 → *설정* B2/B3에 저장
function updateFxRates(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.SETTINGS);
  if (!sheet) return;

  const usdCell = sheet.getRange(2, 2);
  const gbpCell = sheet.getRange(3, 2);

  usdCell.setFormula('=GOOGLEFINANCE("CURRENCY:USDKRW")');
  gbpCell.setFormula('=GOOGLEFINANCE("CURRENCY:GBPKRW")');
  SpreadsheetApp.flush();
  Utilities.sleep(300);

  let usd = usdCell.getValue();
  let gbp = gbpCell.getValue();
  if (typeof usd !== 'number' || isNaN(usd) || usd <= 0) usd = 1400;
  if (typeof gbp !== 'number' || isNaN(gbp) || gbp <= 0) gbp = 1700;

  usdCell.setValue(usd);
  gbpCell.setValue(gbp);
  Logger.log('환율 업데이트: USD=' + usd + ', GBP=' + gbp);
}

// ═══════════════════════════════════════════════════
//  [수동 실행] 과거 매수/매도 이력 원장에 추가
// ═══════════════════════════════════════════════════

function importHistoricalTrades() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ledger = ss.getSheetByName(NS.LEDGER);
  if (!ledger) { Logger.log('*거래_원장* 없음 — setupNewSystem 먼저 실행'); return; }

  const data = [
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  ];

  const lastRow = ledger.getLastRow();
  const existing = lastRow >= 2
    ? ledger.getRange(2, 1, lastRow - 1, 12).getValues()
    : [];

  const all = [...existing, ...data].filter(r => r[0] && r[3]);
  all.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  if (lastRow >= 2) ledger.getRange(2, 1, lastRow - 1, 12).clearContent().clearFormat();
  ledger.getRange(2, 1, all.length, 12).setValues(all);
  all.forEach((_, i) => {
    ledger.getRange(i + 2, 1, 1, 12).setBackground(i % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
  });
  ledger.getRange(2, 8, all.length, 4).setNumberFormat('#,##0');
  ledger.getRange(2, 11, all.length, 1).setNumberFormat('#,##0');

  Logger.log('importHistoricalTrades 완료: 신규 ' + data.length + '건 추가, 전체 ' + all.length + '건');
  SpreadsheetApp.getActiveSpreadsheet().toast('과거 이력 ' + data.length + '건 추가 완료 (전체 ' + all.length + '건)', '✅ 완료', 5);
}

// ═══════════════════════════════════════════════════
//  폼 제출 처리
// ═══════════════════════════════════════════════════

function _handleFormOnEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== NS.FORM) return;
  if (e.range.getRow() !== NS.FR.SUBMIT || e.range.getColumn() !== NS.FORM_COL) return;
  if (e.value === 'TRUE') addTransactionFromForm();
}

function addTransactionFromForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = ss.getSheetByName(NS.FORM);
  if (!form) return;
  const C = NS.FORM_COL;
  const FR = NS.FR;

  const dateVal  = form.getRange(FR.DATE,  C).getValue();
  const type     = String(form.getRange(FR.TYPE,   C).getValue() || '').trim();
  const code     = String(form.getRange(FR.CODE,   C).getValue() || '').trim();
  const name     = String(form.getRange(FR.NAME,   C).getValue() || '').trim();
  const category = String(form.getRange(FR.CAT,    C).getValue() || '').trim();
  const broker   = String(form.getRange(FR.BROKER, C).getValue() || '').trim();
  const account  = String(form.getRange(FR.ACCT,   C).getValue() || '').trim();
  const qty      = Number(form.getRange(FR.QTY,    C).getValue()) || 0;
  const price    = Number(form.getRange(FR.PRICE,  C).getValue()) || 0;
  const fee      = Number(form.getRange(FR.FEE,    C).getValue()) || 0;
  const memo     = String(form.getRange(FR.MEMO,   C).getValue() || '').trim();

  if (!dateVal || !type || !name || qty <= 0 || price <= 0) {
    form.getRange(FR.SUBMIT, C).setValue(false);
    ss.toast('날짜, 구분, 종목명, 수량, 단가는 필수입니다', '⚠️ 입력 오류', 4);
    return;
  }

  const dateStr = Utilities.formatDate(
    dateVal instanceof Date ? dateVal : new Date(dateVal),
    'Asia/Seoul', 'yyyy-MM-dd'
  );
  const amount = qty * price;

  const ledger = ss.getSheetByName(NS.LEDGER);
  const newRowNum = ledger.getLastRow() + 1;
  const newRow = [dateStr, type, code, name, category, broker, account, qty, price, amount, fee, memo];
  ledger.getRange(newRowNum, 1, 1, 12).setValues([newRow])
    .setBackground(newRowNum % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
  ledger.getRange(newRowNum, 8, 1, 4).setNumberFormat('#,##0');
  ledger.getRange(newRowNum, 11, 1, 1).setNumberFormat('#,##0');

  form.getRange(FR.DATE,  C).setValue(new Date());
  form.getRange(FR.CODE,  C).setValue('');
  form.getRange(FR.NAME,  C).setValue('');
  form.getRange(FR.QTY,   C).setValue('');
  form.getRange(FR.PRICE, C).setValue('');
  form.getRange(FR.FEE,   C).setValue(0);
  form.getRange(FR.MEMO,  C).setValue('');
  form.getRange(FR.SUBMIT, C).setValue(false);

  _refreshFormPreview(ss, form, ledger);
  updatePositionFromLedger();

  ss.toast(`${dateStr} ${type} ${name} ${qty.toLocaleString()}주 @${price.toLocaleString()}`, '✅ 원장에 추가됨', 5);
}

function _refreshFormPreview(ss, form, ledger) {
  const previewStart = NS.FR.SUBMIT + 3;
  form.getRange(previewStart, 1, 7, 4).clearContent().clearFormat();

  const lastRow = ledger.getLastRow();
  if (lastRow < 2) return;

  form.getRange(previewStart, 1, 1, 4)
    .setValues([['날짜', '구분 / 종목명', '수량', '단가']])
    .setFontWeight('bold').setBackground('#eeeeee');

  const count = Math.min(5, lastRow - 1);
  const rows = ledger.getRange(lastRow - count + 1, 1, count, 9).getValues().reverse();
  rows.forEach((r, i) => {
    form.getRange(previewStart + 1 + i, 1, 1, 4)
      .setValues([[r[0], `${r[1]} ${r[3]}`, r[7], r[8]]]);
  });
}

// ═══════════════════════════════════════════════════
//  보유현황 계산
// ═══════════════════════════════════════════════════

function updatePositionFromLedger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ledger   = ss.getSheetByName(NS.LEDGER);
  const posSheet = ss.getSheetByName(NS.POSITION);
  if (!ledger || !posSheet) return;

  const hdrRange = posSheet.getRange(1, 1, 1, Math.max(posSheet.getLastColumn(), 15));
  const currentHdr = hdrRange.getValues()[0];
  if (currentHdr[5] !== '보유기간') {
    const newHeader = ['종목코드','종목명','분류','증권사','계좌','보유기간','보유수량','평균단가','매입금액','현재단가','평가금액','손익','수익률(%)','수동평가금액','비고'];
    posSheet.getRange(1, 1, 1, newHeader.length)
      .setValues([newHeader]).setFontWeight('bold')
      .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
    [90,220,80,130,170,90,70,110,130,110,130,110,90,120,100]
      .forEach((w, i) => posSheet.setColumnWidth(i + 1, w));
  }

  const lastRow = ledger.getLastRow();
  if (lastRow < 2) return;

  const rows = ledger.getRange(2, 1, lastRow - 1, 12).getValues();

  const posMap = {};
  const realizedRows = [];

  for (const row of rows) {
    const [date, type, code, name, cat, broker, acct, qty, price, amount, fee] = row;
    if (!name || !type) continue;
    const key = `${code}||${name}||${broker}||${acct}`;
    if (!posMap[key]) {
      posMap[key] = { code: String(code), name: String(name), cat: String(cat),
                      broker: String(broker), acct: String(acct), qty: 0, totalCost: 0, firstDate: '' };
    }
    const p = posMap[key];
    const q = Number(qty) || 0;
    const a = Number(amount) || (q * (Number(price) || 0));
    if (type === '매수') {
      if (p.qty <= 0) {
        p.firstDate = date instanceof Date
          ? Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd')
          : String(date).slice(0, 10);
      }
      p.qty += q;
      p.totalCost += a + (Number(fee) || 0);
    } else if (type === '매도') {
      const avgCost   = p.qty > 0 ? p.totalCost / p.qty : 0;
      const costBasis = Math.round(avgCost * q);
      const sellAmt   = a;
      const feeAmt    = Number(fee) || 0;
      const realized  = sellAmt - costBasis - feeAmt;
      const pnlRate   = costBasis > 0 ? Math.round(realized / costBasis * 10000) / 100 : 0;
      const dateStr   = date instanceof Date
        ? Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd')
        : String(date);
      realizedRows.push([
        dateStr, String(code), String(name), String(cat), String(broker), String(acct),
        q, Number(price) || 0, sellAmt,
        Math.round(avgCost), costBasis, feeAmt, realized, pnlRate
      ]);
      p.totalCost -= avgCost * q;
      p.qty -= q;
    }
  }

  const priceMap = _getLatestPrices(ss);

  const positions = Object.values(posMap)
    .filter(p => p.qty > 0.0001)
    .sort((a, b) => a.broker.localeCompare(b.broker) || a.acct.localeCompare(b.acct));

  // KIS_SKIP 행 백업 (펀드·예금·보험 수동입력 + 수식 보존)
  const skipRowMap     = {};   // 값 백업
  const skipFormulaMap = {};   // 수식 백업 (사용자가 K/L/M 등에 건 수식)
  if (posSheet.getLastRow() > 1) {
    const sheetCols   = posSheet.getLastColumn();
    const isOldLayout = sheetCols < 15;
    const rng         = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, sheetCols);
    const allValues   = rng.getValues();
    const allFormulas = rng.getFormulas();
    allValues.forEach((r, i) => {
      if (String(r[1]).trim() === '합계' || String(r[0]).trim() === '합계') return;
      const cat = String(r[2]).trim();
      if (!NS.KIS_SKIP.includes(cat)) return;
      const k = `${String(r[1]).trim()}|${String(r[3]).trim()}|${String(r[4]).trim()}`;
      let row = r.slice(0, sheetCols);
      let fml = allFormulas[i].slice(0, sheetCols);
      if (isOldLayout) { row.splice(5, 0, ''); fml.splice(5, 0, ''); }
      skipRowMap[k]     = row.slice(0, 15);
      skipFormulaMap[k] = fml.slice(0, 15);
    });
  }

  if (posSheet.getLastRow() > 1) {
    posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 15).clearContent().clearFormat();
  }
  if (positions.length === 0) return;

  const posRows = positions.map(p => {
    const key = `${String(p.name).trim()}|${String(p.broker).trim()}|${String(p.acct).trim()}`;

    if (NS.KIS_SKIP.includes(p.cat)) {
      if (skipRowMap[key]) {
        const row = skipRowMap[key].slice();
        row[5] = _holdingPeriod(p.firstDate);
        return row;
      }
      const avgPrice = p.qty > 0 ? Math.round(p.totalCost / p.qty) : 0;
      return [p.code, p.name, p.cat, p.broker, p.acct,
              _holdingPeriod(p.firstDate), p.qty, avgPrice, Math.round(p.totalCost),
              0, 0, 0, 0, 0, ''];
    }

    const avgPrice  = p.qty > 0 ? Math.round(p.totalCost / p.qty) : 0;
    const buyAmt    = Math.round(p.totalCost);
    const curPrice  = priceMap[_normCode(p.code)] || 0;
    const curAmt    = curPrice > 0 ? Math.round(curPrice * p.qty) : 0;
    const profit    = curAmt > 0 ? curAmt - buyAmt : 0;
    const profitRate = buyAmt > 0 && curAmt > 0
      ? Math.round(profit / buyAmt * 10000) / 100 : 0;
    return [p.code, p.name, p.cat, p.broker, p.acct,
            _holdingPeriod(p.firstDate),
            p.qty, avgPrice, buyAmt, curPrice, curAmt, profit, profitRate, 0, ''];
  });

  posSheet.getRange(2, 1, posRows.length, 15).setValues(posRows);

  posRows.forEach((_, i) => {
    posSheet.getRange(i + 2, 1, 1, 15)
      .setBackground(i % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
  });
  posSheet.getRange(2, 7, posRows.length, 1).setNumberFormat('#,##0');
  posSheet.getRange(2, 8, posRows.length, 5).setNumberFormat('#,##0');
  posSheet.getRange(2, 13, posRows.length, 1).setNumberFormat('0.00"%"');
  posSheet.getRange(2, 14, posRows.length, 1).setNumberFormat('#,##0');

  // KIS_SKIP 행 (펀드/예금/보험): 사용자가 걸어둔 수식 복원
  posRows.forEach((row, i) => {
    const cat = String(row[2]).trim();
    if (!NS.KIS_SKIP.includes(cat)) return;
    const key = `${String(row[1]).trim()}|${String(row[3]).trim()}|${String(row[4]).trim()}`;
    const fml = skipFormulaMap[key];
    if (!fml) return;
    fml.forEach((f, c) => {
      if (f) posSheet.getRange(i + 2, c + 1).setFormula(f);
    });
  });

  const sumRow = posRows.length + 2;
  const totalBuy    = posRows.reduce((s, r) => s + (r[8]  || 0), 0);
  const totalCur    = posRows.reduce((s, r) => s + (r[10] || 0), 0);
  const totalProfit = posRows.reduce((s, r) => s + (r[11] || 0), 0);
  const totalRate   = totalBuy > 0 && totalCur > 0
    ? Math.round(totalProfit / totalBuy * 10000) / 100 : 0;
  posSheet.getRange(sumRow, 1, 1, 15)
    .setValues([['합계','','','','','','','',totalBuy,'',totalCur,totalProfit,totalRate,'','']])
    .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  posSheet.getRange(sumRow, 9, 1, 4).setNumberFormat('#,##0');
  posSheet.getRange(sumRow, 13, 1, 1).setNumberFormat('0.00"%"');

  Logger.log('updatePositionFromLedger 완료: ' + positions.length + '개 종목');

  _setupRealizedPnLSheet(ss);
  const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);
  if (pnlSheet) {
    if (pnlSheet.getLastRow() > 1) {
      pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).clearContent().clearFormat();
    }
    if (realizedRows.length > 0) {
      const r2 = pnlSheet.getRange(2, 1, realizedRows.length, 14);
      r2.setValues(realizedRows);
      realizedRows.forEach((_, i) => {
        pnlSheet.getRange(i + 2, 1, 1, 14)
          .setBackground(i % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
      });
      pnlSheet.getRange(2, 7,  realizedRows.length, 6).setNumberFormat('#,##0');
      pnlSheet.getRange(2, 12, realizedRows.length, 2).setNumberFormat('#,##0');
      pnlSheet.getRange(2, 14, realizedRows.length, 1).setNumberFormat('0.00"%"');

      const sumRow = realizedRows.length + 2;
      const totalRealized = realizedRows.reduce((s, r) => s + (r[12] || 0), 0);
      const totalCost     = realizedRows.reduce((s, r) => s + (r[10] || 0), 0);
      const totalRate     = totalCost > 0 ? Math.round(totalRealized / totalCost * 10000) / 100 : 0;
      pnlSheet.getRange(sumRow, 1, 1, 14)
        .setValues([['합계','','','','','','','','','','','',totalRealized, totalRate]])
        .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
      pnlSheet.getRange(sumRow, 13, 1, 1).setNumberFormat('#,##0');
      pnlSheet.getRange(sumRow, 14, 1, 1).setNumberFormat('0.00"%"');
    }
    Logger.log('*실현손익* 갱신 완료: ' + realizedRows.length + '건');
  }

  computeStockMetrics();   // 보유현황 갱신 후 *종목지표* 재계산 (모든 갱신 경로가 여기 통과)
  buildDashboard();
}

function _holdingPeriod(dateStr) {
  if (!dateStr) return '';
  const start = new Date(String(dateStr).replace(' ', 'T'));
  const now   = new Date();
  let y = now.getFullYear() - start.getFullYear();
  let m = now.getMonth()    - start.getMonth();
  let d = now.getDate()     - start.getDate();
  if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  return (y > 0 ? y + '년 ' : '') + (m > 0 ? m + '개월 ' : '') + d + '일';
}

function _normCode(c) {
  const s = String(c || '').trim();
  if (!s) return '';
  // 해외 영문 코드 (AAPL, TSLA 등)
  if (/^[A-Z]+$/i.test(s)) return s.toUpperCase();
  // 한국 종목코드: 숫자 또는 영숫자 6자리. 6자리 미만은 앞에 0 패딩
  if (/^[\dA-Z]+$/i.test(s) && s.length <= 6) return s.toUpperCase().padStart(6, '0');
  return s;
}

function _getLatestPrices(ss) {
  const priceMap = {};
  const sheet = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 2) return priceMap;
  const lastCol = sheet.getLastColumn() - 1;
  const codes  = sheet.getRange(1, 2, 1, lastCol).getValues()[0];
  const prices = sheet.getRange(sheet.getLastRow(), 2, 1, lastCol).getValues()[0];
  codes.forEach((c, i) => { if (c && prices[i]) priceMap[_normCode(c)] = Number(prices[i]) || 0; });
  return priceMap;
}

// ═══════════════════════════════════════════════════
//  현재가 업데이트: KIS API → *현재가_이력* (구 시스템 독립)
// ═══════════════════════════════════════════════════

function updateNewPriceHistory(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = ss.getSheetByName(NS.PRICE_HISTORY);
  const ledger = ss.getSheetByName(NS.LEDGER);
  if (!sheet || !ledger || ledger.getLastRow() < 2) return;

  // 비거래일(주말/공휴일)엔 *현재가_이력*에 행을 쓰지 않음.
  // 비거래일 날짜 행이 들어가면 priceAsOfDate가 그 날짜가 되어
  // 클라이언트 변동 라벨이 "최근"이어야 할 때 "오늘"로 잘못 표시됨.
  if (!_mIsTradingDay()) {
    Logger.log('updateNewPriceHistory 건너뜀: 비거래일 (주말/공휴일)');
    return;
  }

  // *거래_원장*에서 KIS 조회 대상 종목코드 추출
  const ledgerRows = ledger.getRange(2, 1, ledger.getLastRow() - 1, 5).getValues();
  const codeSet = new Set();
  ledgerRows.forEach(r => {
    const code = _normCode(r[2]);
    const cat  = String(r[4] || '').trim();
    if (code && !NS.KIS_SKIP.includes(cat)) codeSet.add(code);
  });
  const codes = [...codeSet].sort();
  if (codes.length === 0) return;

  // KIS API 직접 가격 조회 (구 트래커 시트 의존성 제거)
  const trackerPriceMap = _fetchPricesFromKIS(codes);

  // 헤더 열 확인 및 신규 코드 추가
  const lastCol = sheet.getLastColumn();
  const existingCodes = lastCol >= 2
    ? sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0].map(_normCode).filter(Boolean)
    : [];
  // 옛 잘못 저장된 코드 (예: '5930') 헤더값을 정규화된 코드 ('005930')로 강제 갱신
  if (existingCodes.length > 0) {
    sheet.getRange(1, 2, 1, existingCodes.length).setValues([existingCodes])
      .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  }
  codes.forEach(code => {
    if (!existingCodes.includes(code)) {
      const newCol = existingCodes.length + 2;
      sheet.getRange(1, newCol).setValue(code)
        .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
      sheet.setColumnWidth(newCol, 100);
      existingCodes.push(code);
    }
  });

  // 오늘 날짜 행 upsert
  const now = new Date();
  const today    = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  const todayDT  = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  const lastDataRow = sheet.getLastRow();
  let todayRow = 0;
  if (lastDataRow >= 2) {
    const dates = sheet.getRange(2, 1, lastDataRow - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      const raw = dates[i][0];
      const d   = raw instanceof Date
        ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
        : String(raw).slice(0, 10);
      if (d === today) { todayRow = i + 2; break; }
    }
  }

  const priceRow = existingCodes.map(code => trackerPriceMap[code] || '');
  const writeRow = todayRow || (sheet.getLastRow() + 1);
  sheet.getRange(writeRow, 1).setValue(todayDT);
  if (priceRow.length > 0) {
    sheet.getRange(writeRow, 2, 1, priceRow.length).setValues([priceRow])
      .setNumberFormat('#,##0');
  }

  Logger.log('updateNewPriceHistory 완료: ' + Object.keys(trackerPriceMap).length + '개 종목 업데이트');
}

// ═══════════════════════════════════════════════════
//  [일회성] 해외 종목 *현재가_이력* USD → KRW 환산
//  GAS 에디터에서 migrateOverseasUsdToKrw() 한 번 실행
//  완료 후 본 함수 + _fetchHistoricalFx + _findFxForDate 제거 예정
// ═══════════════════════════════════════════════════
function migrateOverseasUsdToKrw() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 2) {
    SpreadsheetApp.getUi().alert('*현재가_이력* 데이터 부족');
    return;
  }

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];

  // 해외 종목 컬럼 식별 (헤더가 영문)
  const overseasCols = [];
  headers.forEach((h, i) => {
    const code = String(h || '').trim();
    if (/^[A-Z]+$/.test(code)) overseasCols.push({ colIdx: i + 2, code });
  });
  if (overseasCols.length === 0) {
    SpreadsheetApp.getUi().alert('해외 종목 컬럼 없음');
    return;
  }

  // 날짜 수집
  const dateRaw = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const dates = dateRaw.map(r => {
    const raw = r[0];
    return raw instanceof Date
      ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(raw).slice(0, 10);
  });
  const validDates = dates.filter(d => d.length === 10);
  if (validDates.length === 0) {
    SpreadsheetApp.getUi().alert('유효 날짜 없음');
    return;
  }
  const sorted = validDates.slice().sort();
  const minDate = sorted[0];
  const maxDate = sorted[sorted.length - 1];

  // GOOGLEFINANCE 일별 환율 (USD, GBP 둘 다)
  const fxUsd = _fetchHistoricalFx(ss, 'USDKRW', minDate, maxDate);
  const fxGbp = _fetchHistoricalFx(ss, 'GBPKRW', minDate, maxDate);
  Logger.log('USD 환율 일수: ' + Object.keys(fxUsd).length);
  Logger.log('GBP 환율 일수: ' + Object.keys(fxGbp).length);

  if (Object.keys(fxUsd).length === 0) {
    SpreadsheetApp.getUi().alert('GOOGLEFINANCE 환율 조회 실패');
    return;
  }

  // 각 해외 컬럼 환산. 값이 50,000 미만이면 USD(또는 GBP)로 보고 환산
  // (해외주식 외화 단가는 보통 1,000 미만; 환산된 KRW는 보통 50,000 이상)
  let modified = 0;
  overseasCols.forEach(({ colIdx, code }) => {
    const rng  = sheet.getRange(2, colIdx, lastRow - 1, 1);
    const vals = rng.getValues();
    let changed = false;
    for (let i = 0; i < vals.length; i++) {
      const v = Number(vals[i][0]);
      if (!v || v <= 0 || v >= 50000) continue;
      const dateKey = dates[i];
      if (dateKey.length !== 10) continue;
      // 통화 결정: 환율 매핑은 USD를 기본으로, LSE 분류는 별도 추적 불가 → USD 사용
      const rate = _findFxForDate(fxUsd, dateKey);
      if (!rate) continue;
      vals[i][0] = Math.round(v * rate);
      changed = true;
      modified++;
    }
    if (changed) rng.setValues(vals).setNumberFormat('#,##0');
  });

  SpreadsheetApp.getUi().alert('환산 완료: ' + modified + '개 셀 (해외 종목 ' + overseasCols.length + '개)');
  Logger.log('migrateOverseasUsdToKrw 완료: ' + modified + '개 셀');
}

// 임시 시트에 GOOGLEFINANCE 입력하여 일별 환율 맵 반환
function _fetchHistoricalFx(ss, pair, startDate, endDate) {
  const TEMP = '_temp_fx_' + pair;
  let tmp = ss.getSheetByName(TEMP);
  if (tmp) ss.deleteSheet(tmp);
  tmp = ss.insertSheet(TEMP);

  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  tmp.getRange(1, 1).setFormula(
    `=GOOGLEFINANCE("CURRENCY:${pair}", "price", DATE(${sy},${sm},${sd}), DATE(${ey},${em},${ed}), "DAILY")`
  );
  SpreadsheetApp.flush();

  // GOOGLEFINANCE는 비동기로 데이터 채움 — 행 수가 안정될 때까지 polling
  let prevRows = -1;
  for (let attempt = 0; attempt < 12; attempt++) {
    Utilities.sleep(2500);
    SpreadsheetApp.flush();
    const r = tmp.getLastRow();
    if (r === prevRows && r > 1) break;
    prevRows = r;
  }

  const last = tmp.getLastRow();
  Logger.log(pair + ' GOOGLEFINANCE 행수: ' + last);
  const fxMap = {};
  if (last >= 2) {
    const data = tmp.getRange(2, 1, last - 1, 2).getValues();
    data.forEach(([dt, rate]) => {
      if (dt instanceof Date && typeof rate === 'number' && rate > 0) {
        const key = Utilities.formatDate(dt, 'Asia/Seoul', 'yyyy-MM-dd');
        fxMap[key] = rate;
      }
    });
  }
  ss.deleteSheet(tmp);
  return fxMap;
}

// 정확한 날짜의 환율 → 가장 가까운 이전 → 가장 가까운 이후 (양방향 fallback)
function _findFxForDate(fxMap, dateKey) {
  if (fxMap[dateKey]) return fxMap[dateKey];
  const keys = Object.keys(fxMap).sort();
  if (keys.length === 0) return null;
  let before = null, after = null;
  for (const d of keys) {
    if (d <= dateKey) before = d;
    else { after = d; break; }
  }
  if (before) return fxMap[before];
  if (after)  return fxMap[after];
  return null;
}

// KIS API로 종목코드 배열의 현재가를 일괄 조회
// 국내 코드는 batch API (5개씩 병렬), 해외 영문 코드는 종목별 단일 호출 + KRW 환산
function _fetchPricesFromKIS(codes) {
  KIS_API.ensureToken();
  const priceMap = {};
  const domesticCodes = codes.filter(c => !/^[A-Z]+$/.test(c));
  const overseasCodes = codes.filter(c =>  /^[A-Z]+$/.test(c));

  if (domesticCodes.length > 0) {
    const batch = KIS_API.getKisPricesBatch(domesticCodes);
    Object.keys(batch).forEach(c => {
      const p = Number(batch[c]) || 0;
      if (p > 0) priceMap[c] = p;
    });
  }

  // 해외 종목은 KRW 환산: NAS/NYS/AMS → USD, LSE → GBP
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fx = _getFxRates(ss);   // { usd, gbp } (Dashboard.js)
  overseasCodes.forEach(code => {
    try {
      const info = KIS_API.getOverseasStockInfoAuto(code);
      const foreign = (info && info.price) ? Number(info.price) : 0;
      if (foreign > 0) {
        const rate = (info.exchange === 'LSE') ? fx.gbp : fx.usd;
        if (rate > 0) {
          priceMap[code] = Math.round(foreign * rate);
        } else {
          Logger.log('해외 환율 0 — 환산 불가(' + code + ', exchange=' + info.exchange + ')');
        }
      }
      Utilities.sleep(150);
    } catch (e) {
      Logger.log('해외 가격 조회 실패(' + code + '): ' + e);
    }
  });

  return priceMap;
}
