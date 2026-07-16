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
  SOLD_TRACKER:  '*매도추적*',

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

// ───────────────────────────────────────────────────
//  카톡 매매 알림 → *거래_원장* 자동 기록 (doPost action=addTrade)
//  설계: docs/plans/2026-06-11-카톡매매-원장자동기록.md
// ───────────────────────────────────────────────────

/** doPost action=addTrade 핸들러 — 시크릿(TG_WEBHOOK_SECRET) 검증 후 _appendTradeRow. */
function _handleAddTradePost(e) {
  try {
    const expected = _tgSecret();   // Telegram.js
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (_) { /* form-encoded */ }
    }
    let secret = (e && e.parameter && e.parameter.secret) || body.secret;
    if (!expected || secret !== expected) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'forbidden' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const res = _appendTradeRow(body.trade || body);
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('_handleAddTradePost 오류: ' + err.message);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 카톡 매매 → *거래_원장* 1행 기록. payload t:
 *   {date?,type,code,name,category?,broker,account,qty,price,amount?,fee?,orderNo?,memo?}
 * - 정규화: 증권사 별칭→상수, 날짜 미지정→오늘(KST), 금액 미지정→수량×단가
 * - 분류 미지정 시 *보유현황*(코드+증권사+계좌)에서 룩업 (다계좌 함정 회피, errors.md:306)
 * - 멱등: 동일 fill(날짜·증권사·계좌·코드·구분·수량·단가 + 주문번호) 이미 있으면 skip (errors.md:203)
 * - append 후 updatePositionFromLedger → 보유현황·실현손익·종목지표·대시보드 연쇄
 * - 반환: {success, already?, row, trade, beforeQty, afterQty, posFound}
 */
function _appendTradeRow(t) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ledger = ss.getSheetByName(NS.LEDGER);
    if (!ledger) return { success: false, error: 'no_ledger' };

    // --- 정규화 ---
    const type    = String(t.type || '').trim();
    const code    = _normCode(String(t.code || '').trim());
    const name    = String(t.name || '').trim();
    const account = String(t.account || '').trim();
    const qty     = Number(t.qty) || 0;
    const price   = Number(t.price) || 0;
    const fee     = Number(t.fee) || 0;
    const orderNo = String(t.orderNo || '').trim();

    let broker = String(t.broker || '').trim();
    if (broker.indexOf('미래') !== -1)      broker = '미래에셋투자증권';
    else if (broker.indexOf('삼성') !== -1) broker = '삼성증권';

    let dateStr;
    if (t.date) {
      const d = (t.date instanceof Date) ? t.date : new Date(t.date);
      dateStr = Utilities.formatDate(isNaN(d.getTime()) ? new Date() : d, 'Asia/Seoul', 'yyyy-MM-dd');
    } else {
      dateStr = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    }

    // --- 검증 ---
    if (NS.TX_TYPES.indexOf(type) === -1) return { success: false, error: 'bad_type', detail: type };
    if (NS.BROKERS.indexOf(broker) === -1) return { success: false, error: 'bad_broker', detail: String(t.broker) };
    if (!NS.ACCOUNTS[broker] || NS.ACCOUNTS[broker].indexOf(account) === -1)
      return { success: false, error: 'bad_account', detail: broker + ' / ' + account };
    if (!code || !name || qty <= 0 || price <= 0) return { success: false, error: 'missing_required' };

    const amount = (Number(t.amount) > 0) ? Number(t.amount) : qty * price;

    // --- 멱등: 동일 fill 이미 기록? (분류 룩업보다 먼저 — 전량매도로 보유현황 행이 사라져도 중복 인식) ---
    const lastRow = ledger.getLastRow();
    if (lastRow >= 2) {
      const lv = ledger.getRange(2, 1, lastRow - 1, 12).getValues(); // 0날짜 1구분 2코드 5증권사 6계좌 7수량 8단가 11메모
      for (let i = 0; i < lv.length; i++) {
        const r = lv[i];
        const rowDate = (r[0] instanceof Date) ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd') : String(r[0]).trim();
        if (rowDate === dateStr && String(r[1]).trim() === type && _normCode(String(r[2])) === code &&
            String(r[5]).trim() === broker && String(r[6]).trim() === account &&
            (Number(r[7]) || 0) === qty && (Number(r[8]) || 0) === price) {
          if (!orderNo || String(r[11] || '').indexOf('주문번호:' + orderNo) !== -1) {
            return { success: true, already: true, row: i + 2, message: '이미 기록된 거래(멱등 skip)',
                     trade: { date: dateStr, type: type, code: code, name: name, broker: broker, account: account, qty: qty, price: price } };
          }
        }
      }
    }

    // --- *보유현황* 룩업: 분류 + 전 보유수량 (키 = 코드+증권사+계좌) ---
    const pos = ss.getSheetByName(NS.POSITION);
    let category = String(t.category || '').trim();
    let beforeQty = 0, posFound = false;
    if (pos && pos.getLastRow() >= 2) {
      const pv = pos.getRange(2, 1, pos.getLastRow() - 1, 7).getValues(); // 0코드 2분류 3증권사 4계좌 6보유수량
      for (let i = 0; i < pv.length; i++) {
        if (_normCode(String(pv[i][0])) === code && String(pv[i][3]).trim() === broker && String(pv[i][4]).trim() === account) {
          posFound = true;
          beforeQty = Number(pv[i][6]) || 0;
          if (!category) category = String(pv[i][2]).trim();
          break;
        }
      }
    }
    if (!category) return { success: false, error: 'category_required', detail: code + ' ' + name };

    // --- append (addTransactionFromForm과 동일 포맷) ---
    const memo = (orderNo ? '주문번호:' + orderNo : '') + (t.memo ? (orderNo ? ' / ' : '') + String(t.memo).trim() : '');
    const newRowNum = ledger.getLastRow() + 1;
    const newRow = [dateStr, type, code, name, category, broker, account, qty, price, amount, fee, memo];
    ledger.getRange(newRowNum, 1, 1, 12).setValues([newRow])
      .setBackground(newRowNum % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
    ledger.getRange(newRowNum, 8, 1, 4).setNumberFormat('#,##0');
    ledger.getRange(newRowNum, 11, 1, 1).setNumberFormat('#,##0');

    // --- 재계산 (보유현황·실현손익·종목지표·대시보드 연쇄) ---
    updatePositionFromLedger();

    // --- 전후 보유수량 (검증용; 전량매도면 행 사라져 0) ---
    let afterQty = 0;
    if (pos && pos.getLastRow() >= 2) {
      const pv2 = pos.getRange(2, 1, pos.getLastRow() - 1, 7).getValues();
      for (let i = 0; i < pv2.length; i++) {
        if (_normCode(String(pv2[i][0])) === code && String(pv2[i][3]).trim() === broker && String(pv2[i][4]).trim() === account) {
          afterQty = Number(pv2[i][6]) || 0; break;
        }
      }
    }

    return { success: true, already: false, row: newRowNum,
             trade: { date: dateStr, type: type, code: code, name: name, category: category, broker: broker, account: account, qty: qty, price: price, amount: amount, fee: fee, memo: memo },
             beforeQty: beforeQty, afterQty: afterQty, posFound: posFound };
  } catch (err) {
    return { success: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
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
  const skipAutoFilled = {};   // 자가치유(평가 빈칸→현재단가×수량) 행 키 — 아래 수식복원에서 평가/손익/수익률 제외
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
        // 자가치유: 평가금액(10) 비었고 현재단가(9)>0 → 평가=현재단가×수량, 손익·수익률 재계산.
        // (예금처럼 사용자가 현재단가만 넣고 평가금액을 비워 손익 셀에 잘못된 집계 수식이 남는 경우 교정.
        //  펀드·보험은 평가금액이 진짜값으로 채워져 있어 이 분기 안 탐 → 완전 불변. errors.md 참조)
        const buyAmt   = Number(row[8]) || 0;
        const curPrice = Number(row[9]) || 0;
        if (!(Number(row[10]) > 0) && curPrice > 0) {
          const qty     = Number(row[6]) || p.qty;
          const evalAmt = Math.round(curPrice * qty);
          row[10] = evalAmt;
          row[11] = evalAmt - buyAmt;
          row[12] = buyAmt > 0 ? Math.round((evalAmt - buyAmt) / buyAmt * 10000) / 100 : 0;
          skipAutoFilled[key] = true;
        }
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
  // 단, 자가치유한 행은 평가/손익/수익률(인덱스 10·11·12) 수식은 복원 안 함
  // (잘못된 집계 참조 수식을 재계산 값으로 대체 유지 — 예금 74M 오염 재발 방지)
  posRows.forEach((row, i) => {
    const cat = String(row[2]).trim();
    if (!NS.KIS_SKIP.includes(cat)) return;
    const key = `${String(row[1]).trim()}|${String(row[3]).trim()}|${String(row[4]).trim()}`;
    const fml = skipFormulaMap[key];
    if (!fml) return;
    const auto = skipAutoFilled[key];
    fml.forEach((f, c) => {
      if (auto && (c === 10 || c === 11 || c === 12)) return;   // 평가/손익/수익률 수식 제외
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
  buildSoldTracker();      // 매도 종목 What-if 스냅샷 재계산 (SoldTracker.js)
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

  const writeRow = todayRow || (sheet.getLastRow() + 1);

  // KIS 조회 실패 종목은 빈 셀(→ 평가금액 0원) 대신 직전 거래일 가격을 유지 (carry-forward)
  let prevPrices = [];
  const prevRow = todayRow ? (todayRow - 1) : sheet.getLastRow();
  if (prevRow >= 2) {
    prevPrices = sheet.getRange(prevRow, 2, 1, existingCodes.length).getValues()[0];
  }
  const carried = [];
  const priceRow = existingCodes.map((code, i) => {
    const fresh = Number(trackerPriceMap[code]) || 0;
    if (fresh > 0) return fresh;
    const prev = prevPrices[i];
    if (prev !== '' && prev != null && Number(prev) > 0) { carried.push(code); return prev; }
    return '';
  });

  sheet.getRange(writeRow, 1).setValue(todayDT);
  if (priceRow.length > 0) {
    sheet.getRange(writeRow, 2, 1, priceRow.length).setValues([priceRow])
      .setNumberFormat('#,##0');
  }

  // 갱신 상태 기록 — 텔레그램 푸시가 "오늘 +0원"이 stale(carry-forward)인지 단서 표기에 사용
  // (carried=0도 저장해 전일 플래그 자동 해제. docs/plans/2026-07-04-푸시-0원-stale단서.md)
  try {
    PropertiesService.getScriptProperties().setProperty('kis_carried_status', JSON.stringify({
      date: today, carried: carried.length, total: existingCodes.length
    }));
  } catch (e) { Logger.log('kis_carried_status 저장 실패: ' + e); }

  Logger.log('updateNewPriceHistory 완료: ' + Object.keys(trackerPriceMap).length + '개 종목 업데이트');
  if (carried.length > 0) {
    Logger.log('⚠️ KIS 조회 실패 → 직전가 유지 ' + carried.length + '종목 [' + carried.join(', ') + ']');
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'KIS 조회 실패 ' + carried.length + '종목 — 직전가 유지: ' + carried.join(', '),
        '⚠️ 가격 누락', 8);
    } catch (e) {}
  }
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

  // ── 재시도 1회 — 조회 실패(누락) 종목만 ──
  const missing = codes.filter(c => !(priceMap[c] > 0));
  if (missing.length > 0) {
    Logger.log('_fetchPricesFromKIS 재시도: ' + missing.length + '종목 [' + missing.join(', ') + ']');
    Utilities.sleep(500);
    const md = missing.filter(c => !/^[A-Z]+$/.test(c));
    const mo = missing.filter(c =>  /^[A-Z]+$/.test(c));
    if (md.length > 0) {
      const batch2 = KIS_API.getKisPricesBatch(md);
      Object.keys(batch2).forEach(c => {
        const p = Number(batch2[c]) || 0;
        if (p > 0) priceMap[c] = p;
      });
    }
    mo.forEach(code => {
      try {
        const info = KIS_API.getOverseasStockInfoAuto(code);
        const foreign = (info && info.price) ? Number(info.price) : 0;
        if (foreign > 0) {
          const rate = (info.exchange === 'LSE') ? fx.gbp : fx.usd;
          if (rate > 0) priceMap[code] = Math.round(foreign * rate);
        }
        Utilities.sleep(150);
      } catch (e) {
        Logger.log('해외 가격 재시도 실패(' + code + '): ' + e);
      }
    });
  }

  return priceMap;
}
