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
    ['2021-01-20','매수','066570','LG전자','국내주식','삼성증권','종합',65,158000,10270000,0,''],
    ['2024-06-17','매수','381170','미래에셋TIGER미국테크TOP10INDXX증권상장지수투자신탁(주식)','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',1164,24282,28264248,1183,''],
    ['2024-06-21','매수','MU','Micron Technology','해외주식','삼성증권','종합',95,209269,19880521,0,''],
    ['2025-01-02','매수','379800','삼성KODEX미국S&P500 ETF','국내ETF','미래에셋투자증권','종합_랩',1513,19820,29987660,1090,''],
    ['2025-02-11','매도','379800','삼성KODEX미국S&P500 ETF','국내ETF','미래에셋투자증권','종합_랩',1513,20120,30441560,1100,''],
    ['2025-05-12','매수','379810','KODEX 미국나스닥100','국내ETF','삼성증권','ISA',1134,19140,21704760,913,''],
    ['2025-05-12','매수','379800','KODEX 미국S&P500','국내ETF','삼성증권','ISA',1142,18400,21012800,884,''],
    ['2025-05-12','매수','360750','TIGER 미국S&P500','국내ETF','미래에셋투자증권','퇴직연금_개인IRP',565,20020,11311300,0,''],
    ['2025-05-13','매도','379810','KODEX 미국나스닥100','국내ETF','삼성증권','ISA',1134,19670,22305780,937,''],
    ['2025-05-13','매도','379800','KODEX 미국S&P500','국내ETF','삼성증권','ISA',1142,18875,21555250,907,''],
    ['2025-05-13','매도','360750','TIGER 미국S&P500','국내ETF','미래에셋투자증권','퇴직연금_개인IRP',565,20510,11588150,0,''],
    ['2025-05-13','매수','257720','실리콘투','국내주식','미래에셋투자증권','종합_랩',300,39175,11752500,0,''],
    ['2025-05-13','매수','007340','DN오토모티브','국내주식','미래에셋투자증권','종합_랩',500,20800,10400000,0,''],
    ['2025-05-21','매수','071050','한국금융지주','국내주식','미래에셋투자증권','종합_랩',100,97800,9780000,0,''],
    ['2025-05-21','매수','0047A0','TIGER 차이나테크 TOP10','국내ETF','미래에셋투자증권','종합_랩',1490,10030,14944700,0,''],
    ['2025-06-11','매수','390390','KODEX 미국반도체','국내ETF','삼성증권','ISA',417,24450,10195650,428,''],
    ['2025-06-11','매수','381180','TIGER 미국필라델피아반도체나스닥','국내ETF','삼성증권','ISA',542,18790,10184180,428,''],
    ['2025-06-11','매수','497570','TIGER 미국필라델피아AI반도체나스닥','국내ETF','삼성증권','ISA',947,10705,10137635,426,''],
    ['2025-06-13','매도','257720','실리콘투','국내주식','미래에셋투자증권','종합_랩',300,54300,16290000,24433,''],
    ['2025-07-04','매도','390390','KODEX 미국반도체','국내ETF','삼성증권','ISA',417,26355,10990035,461,''],
    ['2025-07-04','매도','381180','TIGER 미국필라델피아반도체나스닥','국내ETF','삼성증권','ISA',542,20151,10922380,458,''],
    ['2025-07-04','매도','497570','TIGER 미국필라델피아AI반도체나스닥','국내ETF','삼성증권','ISA',947,11640,11023080,463,''],
    ['2025-07-09','매도','381170','미래에셋TIGER미국테크TOP10INDXX증권상장지수투자신탁(주식)','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',1164,24470,28483080,0,''],
    ['2025-07-09','매수','228790','TIGER 화장품','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',2370,4220,10001400,0,''],
    ['2025-07-10','매수','228790','TIGER 화장품','국내ETF','삼성증권','ISA',4749,4220,20040645,843,''],
    ['2025-08-05','매도','007340','DN오토모티브','국내주식','미래에셋투자증권','종합_랩',500,26750,13375000,0,''],
    ['2025-08-19','매수','196170','알테오젠','국내주식','삼성증권','ISA',25,419400,10485000,191,''],
    ['2025-09-12','매도','MU','Micron Technology','해외주식','삼성증권','종합',95,210512,19998640,5994,''],
    ['2025-09-16','매수','0048K0','KODEX 차이나휴머노이드로봇','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',900,11160,10044000,0,''],
    ['2025-09-17','매도','196170','알테오젠','국내주식','삼성증권','ISA',25,473000,11825000,18166,''],
    ['2025-09-17','매수','487240','KODEX AI전력핵심설비','국내ETF','삼성증권','ISA',143,17550,2509650,105,''],
    ['2025-09-17','매수','487240','KODEX AI전력핵심설비','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',503,17630,8867890,0,''],
    ['2025-09-22','매수','491010','TIGER 글로벌AI전력인프라액티브','국내ETF','삼성증권','종합',519,19400,10068600,423,''],
    ['2025-09-22','매수','0053L0','TIGER 차이나휴머노이드로봇','국내ETF','삼성증권','종합',800,13610,10888000,458,''],
    ['2025-09-24','매수','0091P0','TIGER 코리아원자력','국내ETF','삼성증권','ISA',1220,9660,11785200,495,''],
    ['2025-09-25','매수','487240','KODEX AI전력핵심설비','국내ETF','삼성증권','종합',298,16880,5030240,211,''],
    ['2025-10-27','매도','228790','TIGER 화장품','국내ETF','삼성증권','ISA',4749,3710,17618790,740,''],
    ['2025-10-27','매도','228790','TIGER 화장품','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',2370,3710,8792700,0,''],
    ['2025-10-27','매수','042660','한화오션','국내주식','삼성증권','종합',80,140900,11272000,304,''],
    ['2025-10-27','매수','042660','한화오션','국내주식','삼성증권','ISA',40,140900,5636000,304,''],
    ['2025-10-27','매수','396500','TIGER 반도체TOP10','국내ETF','삼성증권','종합',600,18375,11025000,463,''],
    ['2025-10-27','매수','000660','SK하이닉스','국내주식','삼성증권','종합',20,534000,10680000,339,''],
    ['2025-10-30','매도','042660','한화오션','국내주식','삼성증권','종합',80,148100,11848000,318,''],
    ['2025-10-30','매도','042660','한화오션','국내주식','삼성증권','ISA',40,148100,5924000,215,''],
    ['2025-11-04','매수','000660','SK하이닉스','국내주식','삼성증권','ISA',10,581000,5810000,155,''],
    ['2025-11-05','매도','0091P0','TIGER 코리아원자력','국내ETF','삼성증권','ISA',1220,10635,12974700,545,''],
    ['2025-11-05','매도','396500','TIGER 반도체TOP10','국내ETF','삼성증권','종합',600,18470,11082000,465,''],
    ['2025-11-05','매도','491010','TIGER 글로벌AI전력인프라액티브','국내ETF','삼성증권','종합',519,20740,10764060,107542,''],
    ['2025-11-05','매도','000660','SK하이닉스','국내주식','삼성증권','종합',20,575000,11500000,17560,''],
    ['2025-11-05','매도','000660','SK하이닉스','국내주식','삼성증권','ISA',10,575000,5750000,8779,''],
    ['2025-11-05','매도','487240','KODEX AI전력핵심설비','국내ETF','삼성증권','종합',298,25450,7584100,318,''],
    ['2025-11-05','매도','487240','KODEX AI전력핵심설비','국내ETF','삼성증권','ISA',143,25450,3639350,152,''],
    ['2025-11-05','매도','487240','KODEX AI전력핵심설비','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',503,25450,12801350,0,''],
    ['2025-11-21','매수','003230','삼양식품','국내주식','미래에셋투자증권','종합_랩',24,1336167,32068008,0,''],
    ['2025-12-20','매수','071050','한국금융지주','국내주식','미래에셋투자증권','종합_랩',100,97800,9780000,0,''],
    ['2025-12-29','매도','071050','한국금융지주','국내주식','미래에셋투자증권','종합_랩',100,168000,16800000,0,''],
    ['2026-01-02','매수','444200','SOL 코리아메가테크액티브','국내ETF','삼성증권','ISA',500,32000,16000000,672,''],
    ['2026-01-06','매도','071050','한국금융지주','국내주식','미래에셋투자증권','종합_랩',100,172900,17290000,0,''],
    ['2026-01-06','매수','005380','현대차','국내주식','삼성증권','ISA',65,307000,19955000,539,''],
    ['2026-01-06','매수','445290','KODEX 로봇액티브','국내ETF','삼성증권','ISA',702,26440,18560880,780,''],
    ['2026-01-06','매수','491820','HANARO 전력설비투자','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',709,29785,21117565,0,''],
    ['2026-01-06','매수','462900','KoACT 바이오헬스케어액티브','국내ETF','미래에셋투자증권','퇴직연금_개인IRP',406,23275,9449650,0,''],
    ['2026-01-06','매수','445290','KODEX 로봇액티브','국내ETF','미래에셋투자증권','종합_랩',350,26455,9259250,0,''],
    ['2026-01-15','매수','000660','SK하이닉스','국내주식','삼성증권','종합',27,740000,19980000,635,''],
    ['2026-01-23','매도','444200','SOL 코리아메가테크액티브','국내ETF','삼성증권','ISA',500,38640,19320000,812,''],
    ['2026-01-23','매도','005380','현대차','국내주식','삼성증권','ISA',65,511000,33215000,17664,''],
    ['2026-01-23','매도','445290','KODEX 로봇액티브','국내ETF','삼성증권','ISA',702,34125,23955750,1008,''],
    ['2026-01-28','매도','0048K0','KODEX 차이나휴머노이드로봇','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',900,11440,10296000,1008,''],
    ['2026-01-29','매수','229200','KODEX 코스닥150','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',1141,19888,22692208,0,''],
    ['2026-02-02','매도','000660','SK하이닉스','국내주식','삼성증권','종합',27,860000,23220000,1008,''],
    ['2026-02-02','매도','491820','HANARO 전력설비투자','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',709,31621,22419289,1008,''],
    ['2026-02-12','매도','066570','LG전자','국내주식','삼성증권','종합',65,121300,7884500,15980,''],
    ['2026-02-19','매수','0080G0','KODEX 방산TOP10','국내ETF','삼성증권','ISA',1600,12720,20352000,855,''],
    ['2026-02-27','매도','0053L0','TIGER 차이나휴머노이드로봇','국내ETF','삼성증권','종합',800,13225,10580000,445,''],
    ['2026-02-27','매도','462900','KoACT 바이오헬스케어액티브','국내ETF','미래에셋투자증권','퇴직연금_개인IRP',406,24570,9975420,445,''],
    ['2026-03-10','매도','0080G0','KODEX 방산TOP10','국내ETF','삼성증권','ISA',1600,14315,22904000,445,''],
    ['2026-03-18','매도','229200','KODEX 코스닥150','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',1141,20115,22951215,0,''],
    ['2026-03-18','매도','003230','삼양식품','국내주식','미래에셋투자증권','종합_랩',24,1109000,26616000,0,''],
    ['2026-04-01','매도','445290','KODEX 로봇액티브','국내ETF','미래에셋투자증권','종합_랩',350,31110,10888500,3210,''],
    ['2026-04-01','매도','0047A0','TIGER 차이나테크 TOP10','국내ETF','미래에셋투자증권','종합_랩',1490,11666,17381685,374962,''],
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
