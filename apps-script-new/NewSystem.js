/**
 * NewSystem.js — 새 포트폴리오 DB 시스템
 *
 * 시트 구성:
 *   *거래_원장*    : 전체 거래 이력 (불변 원장)
 *   *거래_입력폼*  : 거래 입력 UI (체크박스 → 원장 자동 추가)
 *   *현재가_이력*: 날짜 × 종목코드 Wide 포맷 현재단가
 *   *보유현황*       : 원장 기반 현재 보유현황 자동 계산
 *   *실현손익*     : 매도 완료 건별 확정 손익
 */

const NS = {
  LEDGER:        '*거래_원장*',
  FORM:          '*거래_입력폼*',
  PRICE_HISTORY: '*현재가_이력*',
  POSITION:      '*보유현황*',
  REALIZED_PNL:  '*실현손익*',
  STOCK_STATUS:  '*종목상태*',
  SETTINGS:      '*설정*',
  TREND:         '*추이 기록*',

  BROKERS:    ['미래에셋투자증권', '삼성증권'],
  ACCOUNTS: {
    '미래에셋투자증권': ['종합_랩', '퇴직연금_개인IRP'],
    '삼성증권':        ['종합', 'ISA', '퇴직연금_개인IRP(범용)'],
  },
  CATEGORIES: ['국내주식', '국내ETF', '해외주식', '해외ETF', '펀드', '예금', '보험', '기타'],
  TX_TYPES:   ['매수', '매도'],
  KIS_SKIP:   ['펀드', '예금', '보험', '기타'],

  // *거래_입력폼* 입력셀 위치 (B열 = col 2)
  FORM_COL: 2,
  FR: { DATE:3, TYPE:4, CODE:5, NAME:6, CAT:7, BROKER:8, ACCT:9, QTY:10, PRICE:11, AMT:12, FEE:13, MEMO:14, SUBMIT:16 },

  // *거래_원장* 컬럼 순서 (1-based)
  LC: { DATE:1, TYPE:2, CODE:3, NAME:4, CAT:5, BROKER:6, ACCT:7, QTY:8, PRICE:9, AMT:10, FEE:11, MEMO:12 },

  HDR_BG:   '#1a1a2e',
  HDR_FG:   '#ffffff',
  ROW_EVEN: '#f8f9fa',
  ROW_ODD:  '#ffffff',
};

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

  // 기존 원장 데이터 + 신규 데이터 합쳐서 날짜순 정렬 후 전체 재작성
  const lastRow = ledger.getLastRow();
  const existing = lastRow >= 2
    ? ledger.getRange(2, 1, lastRow - 1, 12).getValues()
    : [];

  const all = [...existing, ...data].filter(r => r[0] && r[3]);
  all.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  // 기존 데이터 지우고 재작성
  if (lastRow >= 2) ledger.getRange(2, 1, lastRow - 1, 12).clearContent().clearFormat();
  ledger.getRange(2, 1, all.length, 12).setValues(all);
  all.forEach((_, i) => {
    ledger.getRange(i + 2, 1, 1, 12).setBackground(i % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
  });
  ledger.getRange(2, 8, all.length, 4).setNumberFormat('#,##0');
  ledger.getRange(2, 11, all.length, 1).setNumberFormat('#,##0');

  Logger.log('importHistoricalTrades 완료: 신규 ' + data.length + '건 추가, 전체 ' + all.length + '건');
  ss.toast('과거 이력 ' + data.length + '건 추가 완료 (전체 ' + all.length + '건)', '✅ 완료', 5);
}

// ═══════════════════════════════════════════════════
//  [수동 실행] 새 시스템 4개 시트 초기화
// ═══════════════════════════════════════════════════

function setupNewSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  _setupLedgerSheet(ss);
  _setupFormSheet(ss);
  _setupPriceHistorySheet(ss);
  _setupPositionSheet(ss);
  _setupRealizedPnLSheet(ss);
  _ensureStockStatusSheet(ss);
  ss.toast('새 시스템 시트 6개 생성 완료', '✅ 완료', 4);
  Logger.log('setupNewSystem 완료');
}

// ───────────────────────────────────────────────────
//  *거래_원장*
// ───────────────────────────────────────────────────

function _setupLedgerSheet(ss) {
  if (ss.getSheetByName(NS.LEDGER)) { Logger.log('*거래_원장* 이미 존재'); return; }
  const sheet = ss.insertSheet(NS.LEDGER);

  // 헤더
  const header = ['날짜','구분','종목코드','종목명','분류','증권사','계좌','수량','단가','금액','수수료','메모'];
  sheet.getRange(1, 1, 1, header.length)
    .setValues([header]).setFontWeight('bold')
    .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sheet.setFrozenRows(1);

  // 열 너비
  [110, 60, 90, 220, 80, 130, 160, 70, 110, 130, 80, 160]
    .forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // 초기 데이터 (현재 보유 내역 전체 매수 입력)
  const data = [
    // ── 미래에셋투자증권 / 종합_랩 ──
    ['2025-11-21','매수','000660','SK하이닉스',        '국내주식','미래에셋투자증권','종합_랩',           30,  525500, 15765000,   0,''],
    ['2025-05-13','매수','257720','실리콘투',           '국내주식','미래에셋투자증권','종합_랩',          430,   40441, 17389630,   0,''],
    ['2026-04-01','매수','009150','삼성전기',           '국내주식','미래에셋투자증권','종합_랩',           35,  510571, 17870000,   0,''],
    ['2025-12-29','매수','455850','SOL AI반도체소부장', '국내ETF', '미래에셋투자증권','종합_랩',          900,   19597, 17637300,   0,''],
    ['2026-01-06','매수','445290','KODEX 로봇액티브',   '국내ETF', '미래에셋투자증권','종합_랩',          300,   26455,  7936500,   0,''],
    ['2025-05-21','매수','0047A0','TIGER 차이나테크 TOP10','국내ETF','미래에셋투자증권','종합_랩',       1500,   10031, 15046500,   0,''],
    ['2026-04-01','매수','487240','KODEX AI전력핵심설비','국내ETF','미래에셋투자증권','종합_랩',          890,   32333, 28776100,   0,''],
    // ── 미래에셋투자증권 / 퇴직연금_개인IRP ──
    ['2024-06-18','매수','483280','KODEX 미국AI테크TOP10타겟커버드콜','국내ETF','미래에셋투자증권','퇴직연금_개인IRP', 859, 10960,  9414640,  0,''],
    ['2025-05-29','매수','0047A0','TIGER 차이나테크 TOP10','국내ETF','미래에셋투자증권','퇴직연금_개인IRP',1198,  9695, 11614610,  0,''],
    ['2026-02-27','매수','487240','KODEX AI전력핵심설비','국내ETF','미래에셋투자증권','퇴직연금_개인IRP',  290, 34795, 10090550,  0,''],
    ['2024-03-29','매수','','유리필라델피아반도체인덱스증권자투자신탁UH[주식] Class C-P1e','펀드','미래에셋투자증권','퇴직연금_개인IRP',1,838,838,0,''],
    ['2025-09-22','매수','','미래에세차이나과창판증권투자신탁(주식) 종류 C-P2e','펀드','미래에셋투자증권','퇴직연금_개인IRP',1,620477,620477,0,''],
    ['2024-10-30','매수','','삼성글로벌 Chat AI 증권자투자신탁UH[주식]_Cpe(퇴직연금)','펀드','미래에셋투자증권','퇴직연금_개인IRP',1,478554,478554,0,''],
    ['2023-06-09','매수','','(신) 신한정기예금 DC/IRP 3Y_퇴직','예금','미래에셋투자증권','퇴직연금_개인IRP',1,42847287,42847287,0,''],
    ['2024-06-13','매수','','(통합)무배당 교보 이율보증형보험 3년형(DC/IRP)','보험','미래에셋투자증권','퇴직연금_개인IRP',1,9581,9581,0,''],
    // ── 삼성증권 / 종합 ──
    ['2026-02-27','매수','005930','삼성전자',           '국내주식','삼성증권','종합',  72, 212333, 15287976, 378,''],
    ['2026-01-06','매수','196170','알테오젠',           '국내주식','삼성증권','종합',  42, 470000, 19740000, 532,''],
    ['2026-02-27','매수','487240','KODEX AI전력핵심설비','국내ETF','삼성증권','종합', 577,  34795, 20076715,   0,''],
    ['2024-08-08','매수','AVGO',  '브로드컴',           '해외주식','삼성증권','종합',   1, 194565,   194565,   0,''],
    // ── 삼성증권 / ISA ──
    ['2025-06-11','매수','0047A0','TIGER 차이나테크 TOP10','국내ETF','삼성증권','ISA',1367,  9800, 13396600, 563,''],
    ['2026-02-19','매수','471990','KODEX AI반도체핵심장비','국내ETF','삼성증권','ISA', 970, 20810, 20185700, 849,''],
    ['2026-02-19','매수','495230','KoAct 코리아밸류업액티브','국내ETF','삼성증권','ISA',800, 25155, 20124000, 846,''],
    ['2026-02-24','매수','396500','TIGER 반도체TOP10',  '국내ETF','삼성증권','ISA',   504, 31530, 15891120, 855,''],
    // ── 삼성증권 / 퇴직연금_개인IRP(범용) ──
    ['2026-03-18','매수','0163Y0','KoAct 코스닥액티브', '국내ETF','삼성증권','퇴직연금_개인IRP(범용)',1772, 12955, 22956260, 0,''],
    ['2026-02-03','매수','447660','PLUS 애플채권혼합',  '국내ETF','삼성증권','퇴직연금_개인IRP(범용)', 762, 13160, 10027920, 0,''],
    ['2026-01-15','매수','438100','ACE 미국나스닥100미국채혼합50','국내ETF','삼성증권','퇴직연금_개인IRP(범용)',588,14895,8758260,0,''],
    ['2023-01-16','매수','','우리은행 정기예금 5년',   '예금',   '삼성증권','퇴직연금_개인IRP(범용)',   1, 4294230,  4294230, 0,''],
  ];

  sheet.getRange(2, 1, data.length, 12).setValues(data);

  // 교대 행 색상 + 숫자 형식
  data.forEach((_, i) => {
    const r = i + 2;
    sheet.getRange(r, 1, 1, 12).setBackground(i % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
  });
  sheet.getRange(2, 8, data.length, 4).setNumberFormat('#,##0'); // 수량~금액
  sheet.getRange(2, 11, data.length, 1).setNumberFormat('#,##0'); // 수수료
}

// ───────────────────────────────────────────────────
//  *거래_입력폼*
// ───────────────────────────────────────────────────

function _setupFormSheet(ss) {
  if (ss.getSheetByName(NS.FORM)) { Logger.log('*거래_입력폼* 이미 존재'); return; }
  const sheet = ss.insertSheet(NS.FORM);
  const C = NS.FORM_COL;
  const FR = NS.FR;

  // 타이틀
  sheet.getRange(1, 1, 1, 3).merge()
    .setValue('📝 거래 입력')
    .setFontSize(13).setFontWeight('bold')
    .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  // 라벨 목록 [행, 라벨, 기본값]
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
    [FR.AMT,   '금액',   ''],   // 자동계산
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

  // 날짜 형식
  sheet.getRange(FR.DATE, C).setNumberFormat('yyyy-MM-dd');

  // 드롭다운
  const dv = (list) => SpreadsheetApp.newDataValidation().requireValueInList(list, true).build();
  sheet.getRange(FR.TYPE,   C).setDataValidation(dv(NS.TX_TYPES));
  sheet.getRange(FR.CAT,    C).setDataValidation(dv(NS.CATEGORIES));
  sheet.getRange(FR.BROKER, C).setDataValidation(dv(NS.BROKERS));
  const allAccounts = [...new Set(Object.values(NS.ACCOUNTS).flat())];
  sheet.getRange(FR.ACCT,   C).setDataValidation(dv(allAccounts));

  // 구분선
  sheet.getRange(FR.SUBMIT - 1, 1, 1, 3).setBackground('#dddddd').setHeight
  sheet.setRowHeight(FR.SUBMIT - 1, 6);

  // 제출 체크박스
  sheet.getRange(FR.SUBMIT, 1).setValue('✅ 체크하면 원장에 추가')
    .setFontWeight('bold').setBackground('#fff3cd');
  sheet.getRange(FR.SUBMIT, C).insertCheckboxes()
    .setBackground('#fff3cd');

  // 최근 입력 프리뷰
  sheet.getRange(FR.SUBMIT + 2, 1, 1, 4).merge()
    .setValue('📋 최근 입력 5건').setFontWeight('bold').setBackground('#f0f4f8');

  // 열 너비
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
  Logger.log('*현재가_이력* 생성 완료 — 종목 열은 첫 업데이트 시 자동 추가');
}

// ───────────────────────────────────────────────────
//  *보유현황*
// ───────────────────────────────────────────────────

function _setupPositionSheet(ss) {
  if (ss.getSheetByName(NS.POSITION)) { Logger.log('*보유현황* 이미 존재'); return; }
  const sheet = ss.insertSheet(NS.POSITION);
  const header = ['종목코드','종목명','분류','증권사','계좌','보유기간','보유수량','평균단가','매입금액','현재단가','평가금액','손익','수익률(%)','수동평가금액','비고','등락','등락률(%)','1M','3M','6M','1Y','52주최고','52주최저'];
  sheet.getRange(1, 1, 1, header.length)
    .setValues([header]).setFontWeight('bold')
    .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  sheet.setFrozenRows(1);
  [90,220,80,130,170,90,70,110,130,110,130,110,90,120,100,80,90,70,70,70,70,100,100]
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
  Logger.log('*실현손익* 생성 완료');
}

// ═══════════════════════════════════════════════════
//  폼 제출 처리 (onEdit 체크박스 → 호출)
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

  // 값 읽기
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

  // 유효성 검사
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

  // *거래_원장*에 추가
  const ledger = ss.getSheetByName(NS.LEDGER);
  const newRowNum = ledger.getLastRow() + 1;
  const newRow = [dateStr, type, code, name, category, broker, account, qty, price, amount, fee, memo];
  ledger.getRange(newRowNum, 1, 1, 12).setValues([newRow])
    .setBackground(newRowNum % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
  ledger.getRange(newRowNum, 8, 1, 4).setNumberFormat('#,##0');
  ledger.getRange(newRowNum, 11, 1, 1).setNumberFormat('#,##0');

  // 폼 초기화
  form.getRange(FR.DATE,  C).setValue(new Date());
  form.getRange(FR.CODE,  C).setValue('');
  form.getRange(FR.NAME,  C).setValue('');
  form.getRange(FR.QTY,   C).setValue('');
  form.getRange(FR.PRICE, C).setValue('');
  form.getRange(FR.FEE,   C).setValue(0);
  form.getRange(FR.MEMO,  C).setValue('');
  form.getRange(FR.SUBMIT, C).setValue(false);

  // 최근 입력 프리뷰 갱신
  _refreshFormPreview(ss, form, ledger);

  // 보유현황 자동 갱신
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

/**
 * [수동 실행 or 자동] *거래_원장* 기반 *보유현황* 재계산
 */
function updatePositionFromLedger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ledger   = ss.getSheetByName(NS.LEDGER);
  const posSheet = ss.getSheetByName(NS.POSITION);
  if (!ledger || !posSheet) return;

  // 헤더가 구형이거나 새 컬럼(등락~52주)이 없으면 23열로 업데이트
  const hdrRange = posSheet.getRange(1, 1, 1, Math.max(posSheet.getLastColumn(), 23));
  const currentHdr = hdrRange.getValues()[0];
  if (currentHdr[5] !== '보유기간' || currentHdr[15] !== '등락') {
    const newHeader = ['종목코드','종목명','분류','증권사','계좌','보유기간','보유수량','평균단가','매입금액','현재단가','평가금액','손익','수익률(%)','수동평가금액','비고','등락','등락률(%)','1M','3M','6M','1Y','52주최고','52주최저'];
    posSheet.getRange(1, 1, 1, newHeader.length)
      .setValues([newHeader]).setFontWeight('bold')
      .setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
    [90,220,80,130,170,90,70,110,130,110,130,110,90,120,100,80,90,70,70,70,70,100,100]
      .forEach((w, i) => posSheet.setColumnWidth(i + 1, w));
  }

  const lastRow = ledger.getLastRow();
  if (lastRow < 2) return;

  const rows = ledger.getRange(2, 1, lastRow - 1, 12).getValues();

  // 보유현황 맵: key = '코드||이름||증권사||계좌'
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

  // 현재가·등락·52주·1M~1Y (*종목상태* 우선, 없으면 *현재가_이력* fallback)
  const statusMap = _getStockStatusMap(ss);
  const priceMap  = _getLatestPrices(ss);

  // 보유 중인 보유현황만, 증권사/계좌 순 정렬
  const positions = Object.values(posMap)
    .filter(p => p.qty > 0.0001)
    .sort((a, b) => a.broker.localeCompare(b.broker) || a.acct.localeCompare(b.acct));

  // KIS_SKIP(펀드·예금·보험) 행 전체 백업 — 지우기 전에 그대로 보존
  const skipRowMap = {};
  if (posSheet.getLastRow() > 1) {
    const sheetCols   = posSheet.getLastColumn();
    const isOldLayout = sheetCols < 15;
    posSheet.getRange(2, 1, posSheet.getLastRow() - 1, sheetCols).getValues()
      .forEach(r => {
        if (String(r[1]).trim() === '합계' || String(r[0]).trim() === '합계') return;
        const cat = String(r[2]).trim();
        if (!NS.KIS_SKIP.includes(cat)) return;
        const k   = `${String(r[1]).trim()}|${String(r[3]).trim()}|${String(r[4]).trim()}`;
        let row   = r.slice(0, sheetCols);
        // 구형(14열) 행이면 보유기간 열(인덱스 5)을 빈 칸으로 삽입
        if (isOldLayout) row.splice(5, 0, '');
        // 23열로 패딩 (신규 컬럼 없는 구 데이터 보완)
        while (row.length < 23) row.push('');
        skipRowMap[k] = row.slice(0, 23);
      });
  }

  // 기존 데이터 지우기 (헤더 제외)
  if (posSheet.getLastRow() > 1) {
    posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 23).clearContent().clearFormat();
  }
  if (positions.length === 0) return;

  const posRows = positions.map(p => {
    const key = `${String(p.name).trim()}|${String(p.broker).trim()}|${String(p.acct).trim()}`;

    if (NS.KIS_SKIP.includes(p.cat)) {
      // 펀드·예금·보험: 기존 행 전체를 그대로 보존 (보유기간만 최신화)
      if (skipRowMap[key]) {
        const row = skipRowMap[key].slice();
        row[5] = _holdingPeriod(p.firstDate);
        return row;
      }
      // 시트에 없는 신규 항목: 빈 값으로 초기화 (사용자가 직접 입력)
      const avgPrice = p.qty > 0 ? Math.round(p.totalCost / p.qty) : 0;
      return [p.code, p.name, p.cat, p.broker, p.acct,
              _holdingPeriod(p.firstDate), p.qty, avgPrice, Math.round(p.totalCost),
              0, 0, 0, 0, 0, '',
              0, '', '-', '-', '-', '-', 0, 0];
    }

    const normCode   = _normCode(p.code);
    const s          = statusMap[normCode] || {};
    const avgPrice   = p.qty > 0 ? Math.round(p.totalCost / p.qty) : 0;
    const buyAmt     = Math.round(p.totalCost);
    const curPrice   = s.price || priceMap[normCode] || 0;
    const curAmt     = curPrice > 0 ? Math.round(curPrice * p.qty) : 0;
    const profit     = curAmt > 0 ? curAmt - buyAmt : 0;
    const profitRate = buyAmt > 0 && curAmt > 0
      ? Math.round(profit / buyAmt * 10000) / 100 : 0;
    return [p.code, p.name, p.cat, p.broker, p.acct,
            _holdingPeriod(p.firstDate),
            p.qty, avgPrice, buyAmt, curPrice, curAmt, profit, profitRate, 0, '',
            s.change || 0, s.changePct || '',
            s.m1 || '-', s.m3 || '-', s.m6 || '-', s.m1y || '-',
            s.high52 || 0, s.low52 || 0];
  });

  posSheet.getRange(2, 1, posRows.length, 23).setValues(posRows);

  // 서식
  posRows.forEach((_, i) => {
    posSheet.getRange(i + 2, 1, 1, 23)
      .setBackground(i % 2 === 0 ? NS.ROW_EVEN : NS.ROW_ODD);
  });
  posSheet.getRange(2, 7,  posRows.length, 1).setNumberFormat('#,##0');         // 수량
  posSheet.getRange(2, 8,  posRows.length, 5).setNumberFormat('#,##0');         // 단가~손익
  posSheet.getRange(2, 13, posRows.length, 1).setNumberFormat('0.00"%"');       // 수익률
  posSheet.getRange(2, 14, posRows.length, 1).setNumberFormat('#,##0');         // 수동평가금액
  posSheet.getRange(2, 16, posRows.length, 1).setNumberFormat('#,##0');         // 등락
  posSheet.getRange(2, 22, posRows.length, 2).setNumberFormat('#,##0');         // 52주최고·최저

  // 합계행
  const sumRow = posRows.length + 2;
  const totalBuy    = posRows.reduce((s, r) => s + (r[8]  || 0), 0);
  const totalCur    = posRows.reduce((s, r) => s + (r[10] || 0), 0);
  const totalProfit = posRows.reduce((s, r) => s + (r[11] || 0), 0);
  const totalRate   = totalBuy > 0 && totalCur > 0
    ? Math.round(totalProfit / totalBuy * 10000) / 100 : 0;
  posSheet.getRange(sumRow, 1, 1, 23)
    .setValues([['합계','','','','','','','',totalBuy,'',totalCur,totalProfit,totalRate,'','','','','','','','','','']])
    .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  posSheet.getRange(sumRow, 9, 1, 4).setNumberFormat('#,##0');
  posSheet.getRange(sumRow, 13, 1, 1).setNumberFormat('0.00"%"');

  Logger.log('updatePositionFromLedger 완료: ' + positions.length + '개 종목');

  // *실현손익* 시트 갱신 (없으면 자동 생성)
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
      pnlSheet.getRange(2, 7,  realizedRows.length, 6).setNumberFormat('#,##0'); // 수량~매입원가
      pnlSheet.getRange(2, 12, realizedRows.length, 2).setNumberFormat('#,##0'); // 수수료~실현손익
      pnlSheet.getRange(2, 14, realizedRows.length, 1).setNumberFormat('0.00"%"'); // 수익률

      // 합계행
      const sumRow = realizedRows.length + 2;
      const totalRealized = realizedRows.reduce((s, r) => s + (r[12] || 0), 0);
      const totalCost     = realizedRows.reduce((s, r) => s + (r[10] || 0), 0);
      const totalRate     = totalCost > 0 ? Math.round(totalRealized / totalCost * 10000) / 100 : 0;
      pnlSheet.getRange(sumRow, 1, 1, 14)
        .setValues([['합계','','','','','','','','','','','' ,totalRealized, totalRate]])
        .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
      pnlSheet.getRange(sumRow, 13, 1, 1).setNumberFormat('#,##0');
      pnlSheet.getRange(sumRow, 14, 1, 1).setNumberFormat('0.00"%"');
    }
    Logger.log('*실현손익* 갱신 완료: ' + realizedRows.length + '건');
  }

  buildDashboard();
  buildAnalysisDashboard();
  SpreadsheetApp.flush();
  _updateNewTrend(ss);
}

// 보유기간 → "X년 Y개월 Z일" 형식 (0년/0개월은 생략)
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

// 순수 숫자 코드는 앞 0 제거 (005930 → 5930), 혼합 코드는 유지 (0047A0 → 0047A0)
function _normCode(c) {
  const s = String(c || '').trim();
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s;
}

// ═══════════════════════════════════════════════════
//  [수동 실행] 새 구글 시트로 마이그레이션
//  실행 후 Apps Script 로그에서 새 시트 URL + ID 확인
// ═══════════════════════════════════════════════════
function migrateToNewSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const newSs = SpreadsheetApp.create('FD5to6 뉴시스템');
  Logger.log('새 스프레드시트 생성: ' + newSs.getUrl());
  Logger.log('스프레드시트 ID: ' + newSs.getId());

  // 데이터 시트 복사 (보유현황·대시보드·입력폼은 새 시트에서 재생성)
  [NS.LEDGER, NS.PRICE_HISTORY, NS.REALIZED_PNL].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ' 없음 — 건너뜀'); return; }
    const copied = sheet.copyTo(newSs);
    copied.setName(name);
    Logger.log(name + ' 복사 완료');
  });

  // 기본 Sheet1 제거
  const def = newSs.getSheetByName('Sheet1');
  if (def && newSs.getSheets().length > 1) newSs.deleteSheet(def);

  // 나머지 시트 신규 생성 (데이터 없는 시트들)
  _setupPositionSheet(newSs);
  _setupFormSheet(newSs);
  _setupSettingsSheet(newSs);

  const url = newSs.getUrl();
  Logger.log('──────────────────────────────────────────');
  Logger.log('✅ 마이그레이션 완료');
  Logger.log('새 시트 URL: ' + url);
  Logger.log('새 시트 Script ID는 새 시트에서 확장 → Apps Script → 프로젝트 설정에서 확인');
  Logger.log('──────────────────────────────────────────');
  ss.toast('마이그레이션 완료! Apps Script 로그(Ctrl+Enter)에서 URL 확인', '✅', 10);
}

// FX 환율 수동 입력 시트
function _setupSettingsSheet(ss) {
  if (ss.getSheetByName('*설정*')) return;
  const sheet = ss.insertSheet('*설정*');
  const hdr = [['항목', '값', '설명']];
  sheet.getRange(1, 1, 1, 3).setValues(hdr).setFontWeight('bold')
    .setBackground('#1a1a2e').setFontColor('#ffffff');
  sheet.getRange(2, 1, 2, 3).setValues([
    ['USD/KRW', 1400, 'USD 환율 (직접 입력)'],
    ['GBP/KRW', 1700, 'GBP 환율 (직접 입력)'],
  ]);
  [120, 100, 200].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(1);
}

/**
 * *설정* 시트에 "대기중" 대기자금 수동 입력 섹션 추가
 * GAS 에디터에서 1회 수동 실행
 */
function setupPendingCashSection() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.SETTINGS);
  if (!sheet) { Logger.log('*설정* 시트 없음'); return; }

  // 열 너비 재조정 (4열: 증권사/구분/대기자금/비고)
  [150, 170, 120, 180].forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // 빈 행 찾아서 섹션 시작행 결정 (기존 데이터 아래 + 1행 여백)
  const startRow = sheet.getLastRow() + 2;

  const TITLE_BG  = '#c9daf8'; // 연파랑
  const HDR_BG    = '#a4c2f4'; // 중간파랑
  const SS_COLOR  = '#1c4587'; // 삼성증권 짙은파랑
  const MA_COLOR  = '#b45309'; // 미래애셋 주황
  const SUM_BG    = '#1155cc'; // 합계 셀 파랑

  const dataRows = [
    ['미래애셋투자증권', '종합_랩',              '', '일임형 랩'],
    ['미래애셋투자증권', '퇴직연금_개인IRP',     '', ''],
    ['삼성증권',         '종합',                 '', ''],
    ['삼성증권',         'ISA',                  '', ''],
    ['삼성증권',         '퇴직연금(다이렉트IRP)', '', ''],
    ['삼성증권',         'CMA',                  '', ''],
  ];
  const dataCount = dataRows.length;
  const sumRow    = startRow + 2 + dataCount; // title(1) + header(1) + data rows

  // 타이틀 행 (병합 + 연파랑)
  const titleRange = sheet.getRange(startRow, 1, 1, 4);
  titleRange.merge().setValue('대기중')
    .setBackground(TITLE_BG).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setFontSize(11).setBorder(true, true, true, true, false, false);

  // 헤더 행
  const hdrRange = sheet.getRange(startRow + 1, 1, 1, 4);
  hdrRange.setValues([['증권사', '구분', '대기자금', '비고']])
    .setBackground(HDR_BG).setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, true, true);

  // 데이터 행
  sheet.getRange(startRow + 2, 1, dataCount, 4).setValues(dataRows)
    .setBorder(true, true, true, true, true, true);

  // 증권사 글자색 지정
  for (let i = 0; i < dataCount; i++) {
    const row   = startRow + 2 + i;
    const name  = dataRows[i][0];
    const color = name === '미래애셋투자증권' ? MA_COLOR : SS_COLOR;
    sheet.getRange(row, 1).setFontColor(color).setFontWeight('bold');
  }

  // 대기자금 열 숫자 포맷
  sheet.getRange(startRow + 2, 3, dataCount, 1).setNumberFormat('#,##0');

  // 합계 행
  const sumFormula = `=SUM(C${startRow + 2}:C${startRow + 1 + dataCount})`;
  sheet.getRange(sumRow, 1, 1, 4).setBorder(true, true, true, true, true, true);
  sheet.getRange(sumRow, 1, 1, 2).merge().setValue('합계')
    .setHorizontalAlignment('center').setFontWeight('bold');
  sheet.getRange(sumRow, 3).setFormula(sumFormula)
    .setBackground(SUM_BG).setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center').setNumberFormat('#,##0');

  Logger.log('대기중 섹션 생성 완료 — startRow=' + startRow + ', sumRow=' + sumRow);
  Logger.log('합계 셀 위치: C' + sumRow + ' (이 주소를 _getPendingTotal()에 사용)');
}

/**
 * *설정* 시트 대기중 합계 읽기
 * setupPendingCashSection() 실행 후 합계 셀 주소가 확정되면 아래 주소를 맞게 수정
 */
function _getPendingTotal(ss) {
  try {
    const sheet = ss.getSheetByName(NS.SETTINGS);
    if (!sheet) return 0;
    const rows = sheet.getDataRange().getValues();
    // '합계' 레이블 행의 C열 값을 찾아서 반환
    for (let i = rows.length - 1; i >= 0; i--) {
      const a = String(rows[i][0] || '').trim();
      const b = String(rows[i][1] || '').trim();
      if ((a === '합계' || b === '합계') && rows[i][2] !== '') {
        return Number(rows[i][2]) || 0;
      }
    }
  } catch (_) {}
  return 0;
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

function _getActiveCodes(ss) {
  const ledger = ss.getSheetByName(NS.LEDGER);
  if (!ledger || ledger.getLastRow() < 2) return [];
  const rows = ledger.getRange(2, 1, ledger.getLastRow() - 1, 5).getValues();
  const codeSet = new Set();
  rows.forEach(r => {
    const code = _normCode(r[2]);
    const cat  = String(r[4] || '').trim();
    if (code && !NS.KIS_SKIP.includes(cat)) codeSet.add(code);
  });
  return [...codeSet].sort();
}

function _readStockStatusRaw(ss) {
  const map = {};
  const sheet = ss.getSheetByName(NS.STOCK_STATUS);
  if (!sheet || sheet.getLastRow() < 2) return map;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
  rows.forEach(r => { const code = _normCode(r[0]); if (code) map[code] = r.slice(); });
  return map;
}

function _writeStockStatusRows(ss, statusRows) {
  const sheet = ss.getSheetByName(NS.STOCK_STATUS);
  if (sheet.getLastRow() > 1)
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).clearContent();
  if (statusRows.length > 0) {
    sheet.getRange(2, 1, statusRows.length, 11).setValues(statusRows);
    sheet.getRange(2, 2, statusRows.length, 3).setNumberFormat('#,##0');
    sheet.getRange(2, 5, statusRows.length, 2).setNumberFormat('#,##0');
  }
}

// ═══════════════════════════════════════════════════
//  *종목상태* / *현재가_이력* 업데이트
// ═══════════════════════════════════════════════════

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

function _getSettingsFxRate(ss, key) {
  const sheet = ss.getSheetByName('*설정*');
  if (!sheet || sheet.getLastRow() < 2) return 1400;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const row = rows.find(r => String(r[0]).trim() === key);
  return row ? (Number(row[1]) || 1400) : 1400;
}

function _ensureStockStatusSheet(ss) {
  if (ss.getSheetByName(NS.STOCK_STATUS)) return;
  const sheet = ss.insertSheet(NS.STOCK_STATUS);
  const header = ['종목코드','현재단가','등락','등락률(%)','52주최고','52주최저','1M','3M','6M','1Y','갱신시간'];
  sheet.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
  [80,100,90,90,100,100,80,80,80,80,140].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(1);
}

function _getStockStatusMap(ss) {
  const map = {};
  const sheet = ss.getSheetByName(NS.STOCK_STATUS);
  if (!sheet || sheet.getLastRow() < 2) return map;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  rows.forEach(r => {
    const code = _normCode(r[0]);
    if (!code) return;
    map[code] = {
      price:     Number(r[1]) || 0,
      change:    Number(r[2]) || 0,
      changePct: r[3] || '',
      high52:    Number(r[4]) || 0,
      low52:     Number(r[5]) || 0,
      m1:        r[6] || '-',
      m3:        r[7] || '-',
      m6:        r[8] || '-',
      m1y:       r[9] || '-',
    };
  });
  return map;
}

/**
 * 현재가·등락만 업데이트 — 장중 여러 번 호출용
 * 1M~1Y·52주 컬럼은 건드리지 않고 기존 값 보존
 */
function updateNewCurrentPrice(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  _ensureStockStatusSheet(ss);

  const allCodes = _getActiveCodes(ss);
  if (allCodes.length === 0) return;

  const domCodes = allCodes.filter(c => !/^[A-Za-z]{1,5}$/.test(c));
  const ovsCodes = allCodes.filter(c => /^[A-Za-z]{1,5}$/.test(c));

  KIS_API.ensureToken();
  const usdKrw = _getSettingsFxRate(ss, 'USD/KRW');

  const domInfoMap = {};
  if (domCodes.length > 0) {
    const kisCodes = domCodes.map(c => /^\d+$/.test(c) ? c.padStart(6, '0') : c);
    const raw = KIS_API.getKisStockInfoBatch(kisCodes);
    domCodes.forEach((nc, i) => { const info = raw[kisCodes[i]]; if (info) domInfoMap[nc] = info; });
  }
  const ovsInfoMap = {};
  if (ovsCodes.length > 0) {
    const raw = KIS_API.getOverseasStockInfoBatch(ovsCodes);
    ovsCodes.forEach(nc => { const info = raw[nc]; if (info) ovsInfoMap[nc] = info; });
  }

  const existing = _readStockStatusRaw(ss);
  const now = new Date();
  const updatedAt = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  const statusMap = {};

  const statusRows = allCodes.map(nc => {
    const isDom = !/^[A-Za-z]{1,5}$/.test(nc);
    const info  = isDom ? domInfoMap[nc] : ovsInfoMap[nc];
    const ex    = existing[nc] || [];
    const rawP  = info ? (info.price || 0) : 0;
    const price = info ? (isDom ? rawP : Math.round(rawP * usdKrw)) : (ex[1] || 0);
    const change = info ? (isDom ? (info.change || 0) : Math.round((info.change || 0) * usdKrw)) : (ex[2] || 0);
    const changePct = info && info.changeRate != null
      ? (info.changeRate.toFixed ? info.changeRate.toFixed(2) + '%' : String(info.changeRate))
      : (ex[3] || '');
    statusMap[nc] = { price };
    // 1M~1Y·52주는 기존 값 그대로 보존
    return [nc, price, change, changePct,
            ex[4] || 0, ex[5] || 0,
            ex[6] || '-', ex[7] || '-', ex[8] || '-', ex[9] || '-',
            updatedAt];
  });

  _writeStockStatusRows(ss, statusRows);
  _updatePriceHistory(ss, allCodes, statusMap, now);
  _appendStockStatusHistory(ss);
  Logger.log('updateNewCurrentPrice 완료: ' + statusRows.length + '개 종목');
}

// ═══════════════════════════════════════════════════
//  [자동] *종목상태_이력* 시트에 일자별 종목 상태 upsert
//  - 같은 날짜+종목코드 행이 있으면 덮어쓰기, 없으면 append
//  - 매번 가격 갱신 시 호출되므로 하루에 한 행 (마지막 값)만 유지
// ═══════════════════════════════════════════════════
function _appendStockStatusHistory(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const stat = ss.getSheetByName(NS.STOCK_STATUS);
  if (!stat || stat.getLastRow() < 2) return;

  const HIST_NAME = '*종목상태_이력*';
  let hist = ss.getSheetByName(HIST_NAME);
  if (!hist) {
    hist = ss.insertSheet(HIST_NAME);
    const header = ['날짜','종목코드','종목명','현재단가','등락','등락률(%)','52주최고','52주최저','1M','3M','6M','1Y'];
    hist.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
    [110,80,220,100,90,90,100,100,80,80,80,80].forEach((w, i) => hist.setColumnWidth(i + 1, w));
    hist.setFrozenRows(1);
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');

  // *종목상태* 전체 행 (10열)
  const statRows = stat.getRange(2, 1, stat.getLastRow() - 1, 10).getValues();

  // 종목명 매핑 (*보유현황*에서 코드 → 종목명)
  const nameMap = {};
  const pos = ss.getSheetByName(NS.POSITION);
  if (pos && pos.getLastRow() >= 2) {
    pos.getRange(2, 1, pos.getLastRow() - 1, 2).getValues().forEach(r => {
      const code = _normCode(r[0]);
      if (code && !nameMap[code]) nameMap[code] = String(r[1] || '');
    });
  }

  // *종목상태_이력* 의 today 행 매핑 (date+code → 행번호)
  const todayMap = {};
  if (hist.getLastRow() >= 2) {
    const idx = hist.getRange(2, 1, hist.getLastRow() - 1, 2).getValues();
    idx.forEach((r, i) => {
      const date = r[0] instanceof Date
        ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd')
        : String(r[0]).slice(0, 10);
      const code = _normCode(r[1]);
      if (date === today && code) todayMap[code] = i + 2;
    });
  }

  // 종목별 upsert / append
  const appendBuf = [];
  statRows.forEach(s => {
    const code = _normCode(s[0]);
    if (!code) return;
    const name = nameMap[code] || '';
    const row = [today, s[0], name, s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9]];
    if (todayMap[code]) {
      hist.getRange(todayMap[code], 1, 1, 12).setValues([row]);
    } else {
      appendBuf.push(row);
    }
  });
  if (appendBuf.length > 0) {
    hist.getRange(hist.getLastRow() + 1, 1, appendBuf.length, 12).setValues(appendBuf);
  }
}

/**
 * 히스토리(1M~1Y·52주) 업데이트 — 7:55 AM 1회 실행
 * 현재가도 함께 갱신하고 *종목상태* M1에 타임스탬프 기록
 */
function updateNewStockHistory(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  _ensureStockStatusSheet(ss);

  const allCodes = _getActiveCodes(ss);
  if (allCodes.length === 0) return;

  const domCodes = allCodes.filter(c => !/^[A-Za-z]{1,5}$/.test(c));
  const ovsCodes = allCodes.filter(c => /^[A-Za-z]{1,5}$/.test(c));

  KIS_API.ensureToken();
  const usdKrw = _getSettingsFxRate(ss, 'USD/KRW');

  const domInfoMap = {};
  if (domCodes.length > 0) {
    const kisCodes = domCodes.map(c => /^\d+$/.test(c) ? c.padStart(6, '0') : c);
    const raw = KIS_API.getKisStockInfoBatch(kisCodes);
    domCodes.forEach((nc, i) => { const info = raw[kisCodes[i]]; if (info) domInfoMap[nc] = info; });
  }
  const ovsInfoMap = {};
  if (ovsCodes.length > 0) {
    const raw = KIS_API.getOverseasStockInfoBatch(ovsCodes);
    ovsCodes.forEach(nc => { const info = raw[nc]; if (info) ovsInfoMap[nc] = info; });
  }

  // 히스토리 조회
  const histItems = [
    ...domCodes.map(c => ({ code: /^\d+$/.test(c) ? c.padStart(6, '0') : c, isOverseas: false, _norm: c })),
    ...ovsCodes.map(c => ({
      code: c, isOverseas: true,
      exchange: (ovsInfoMap[c] && ovsInfoMap[c].exchange) || 'NAS',
      _norm: c
    })),
  ];
  const histMap = {};
  try {
    const rawHist = KIS_API.fetchAllStockHistory(histItems);
    histItems.forEach(item => {
      const weeklyH = (rawHist.weekly || {})[item.code] || [];
      const dailyH  = (rawHist.daily  || {})[item.code] || [];
      const info    = domInfoMap[item._norm] || ovsInfoMap[item._norm];
      if (!info) return;
      // 1차: KIS 주봉/일봉 기반 통계 (52주 최고/최저 포함)
      const kisStats = (weeklyH.length > 0)
        ? KIS_API.calculateStats(weeklyH, info.price, dailyH) : {};
      // 2차: *현재가_이력* 기반 1M/3M/6M/1Y — 신규 상장 종목·주봉 오차 보정
      const histStats = _calcReturnFromHistory(ss, item._norm, info.price);
      if (histStats) {
        ['return1M', 'return3M', 'return6M', 'return1Y'].forEach(k => {
          if (histStats[k]) kisStats[k] = histStats[k];
        });
      }
      histMap[item._norm] = kisStats;
    });
  } catch (e) { Logger.log('히스토리 조회 실패: ' + e); }

  const now = new Date();
  const updatedAt = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  const statusMap = {};

  const statusRows = allCodes.map(nc => {
    const isDom  = !/^[A-Za-z]{1,5}$/.test(nc);
    const info   = isDom ? domInfoMap[nc] : ovsInfoMap[nc];
    const stats  = histMap[nc] || {};
    const rawP   = info ? (info.price || 0) : 0;
    const price  = info ? (isDom ? rawP : Math.round(rawP * usdKrw)) : 0;
    const change = info ? (isDom ? (info.change || 0) : Math.round((info.change || 0) * usdKrw)) : 0;
    const changePct = info && info.changeRate != null
      ? (info.changeRate.toFixed ? info.changeRate.toFixed(2) + '%' : String(info.changeRate))
      : '';
    statusMap[nc] = { price };
    return [nc, price, change, changePct,
            isDom ? (info ? info.high52 || 0 : 0) : Math.round((stats.high52 || 0) * usdKrw),
            isDom ? (info ? info.low52  || 0 : 0) : Math.round((stats.low52  || 0) * usdKrw),
            stats.return1M || '-', stats.return3M || '-',
            stats.return6M || '-', stats.return1Y || '-',
            updatedAt];
  });

  _writeStockStatusRows(ss, statusRows);

  // 히스토리 갱신 타임스탬프를 M1에 기록
  ss.getSheetByName(NS.STOCK_STATUS).getRange(1, 13).setValue(updatedAt);

  _updatePriceHistory(ss, allCodes, statusMap, now);
  Logger.log('updateNewStockHistory 완료: ' + statusRows.length + '개 종목');
}

// 전체 갱신 wrapper (초기 설정 또는 수동 전체 실행)
function updateNewStockStatus(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  updateNewStockHistory(ss);
}

function _updatePriceHistory(ss, allCodes, statusMap, now) {
  const sheet = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!sheet) return;

  // 헤더 열 확인 및 신규 코드 추가
  const lastCol = sheet.getLastColumn();
  const existingCodes = lastCol >= 2
    ? sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0].map(_normCode).filter(Boolean)
    : [];
  allCodes.forEach(code => {
    if (!existingCodes.includes(code)) {
      const newCol = existingCodes.length + 2;
      sheet.getRange(1, newCol).setValue(code)
        .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
      sheet.setColumnWidth(newCol, 100);
      existingCodes.push(code);
    }
  });

  // 오늘 날짜 행 upsert
  const today   = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');
  const todayDT = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  const lastDataRow = sheet.getLastRow();
  let writeRow = lastDataRow + 1;
  if (lastDataRow >= 2) {
    const dates = sheet.getRange(2, 1, lastDataRow - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      const raw = dates[i][0];
      const d   = raw instanceof Date
        ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
        : String(raw).slice(0, 10);
      if (d === today) { writeRow = i + 2; break; }
    }
  }

  const priceRow = existingCodes.map(code => (statusMap[code] && statusMap[code].price) || '');
  sheet.getRange(writeRow, 1).setValue(todayDT);
  if (priceRow.length > 0) {
    sheet.getRange(writeRow, 2, 1, priceRow.length).setValues([priceRow]).setNumberFormat('#,##0');
  }
}

// Main.js 호환 wrapper
function updateNewPriceHistory(ss) {
  updateNewCurrentPrice(ss || SpreadsheetApp.getActiveSpreadsheet());
}

// ═══════════════════════════════════════════════════
//  [진단] 특정 종목의 *현재가_이력* 시계열 + 1M/3M/6M/1Y 계산 결과 출력
//  사용: 신시스템 GAS 에디터에서 함수 실행 → Logger.log 확인
// ═══════════════════════════════════════════════════
function debugPriceHistory487240() {
  debugPriceHistoryFor('487240', 58885);
}

function debugPriceHistoryFor(code, currentPrice) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!sheet) { Logger.log('*현재가_이력* 없음'); return; }

  const lastCol  = sheet.getLastColumn();
  const headRow  = sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];
  const headers  = headRow.map(_normCode);
  const targetNc = _normCode(code);
  const colIdx   = headers.indexOf(targetNc);
  Logger.log('=== ' + code + ' (정규화 ' + targetNc + ') ===');
  Logger.log('시트 헤더 (코드 ' + headers.length + '개): ' + headRow.slice(0, 5).join(', ') + '...');
  if (colIdx < 0) {
    Logger.log('!! ' + code + ' 컬럼 없음 — *현재가_이력* 미누적');
    return;
  }
  const dataCol = colIdx + 2;
  Logger.log('컬럼 위치: ' + dataCol);

  const lastRow = sheet.getLastRow();
  const dates   = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const prices  = sheet.getRange(2, dataCol, lastRow - 1, 1).getValues();

  const points = [];
  for (let i = 0; i < dates.length; i++) {
    const raw = dates[i][0];
    if (!raw) continue;
    const d = raw instanceof Date ? raw : new Date(String(raw).slice(0, 10));
    if (isNaN(d.getTime())) continue;
    const p = Number(prices[i][0]);
    points.push({
      date: d,
      dateStr: Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd'),
      price: p
    });
  }
  Logger.log('데이터 행 수: ' + points.length + ' (시작 ' + (points[0] ? points[0].dateStr : '-') + ' ~ 끝 ' + (points[points.length-1] ? points[points.length-1].dateStr : '-') + ')');

  // 모든 시계열 출력
  points.forEach(p => Logger.log('  ' + p.dateStr + ' → ' + p.price));

  // 정렬 후 N개월 전 가격 추정
  const validPts = points.filter(p => isFinite(p.price) && p.price > 0).sort((a, b) => b.date - a.date);
  Logger.log('--- 유효 데이터(>0): ' + validPts.length + '개 ---');

  const now = new Date();
  const cp  = Number(currentPrice) || (validPts[0] ? validPts[0].price : 0);
  Logger.log('현재가 (계산 기준): ' + cp);

  [1, 3, 6, 12].forEach(months => {
    const target = new Date(now);
    target.setMonth(target.getMonth() - months);
    const targetStr = Utilities.formatDate(target, 'Asia/Seoul', 'yyyy-MM-dd');
    const cand = validPts.filter(p => p.date <= target);
    if (cand.length === 0) {
      Logger.log(months + 'M (target ' + targetStr + '): 데이터 없음 → null');
    } else {
      const past = cand[0];
      const rate = ((cp - past.price) / past.price * 100).toFixed(2);
      Logger.log(months + 'M (target ' + targetStr + '): ' + past.dateStr + ' @' + past.price + ' → ' + rate + '%');
    }
  });
}

/**
 * *현재가_이력* 시트 기반 1M/3M/6M/1Y 수익률 직접 계산.
 * KIS API 주봉 데이터의 ±7일 오차 + 신규 상장 종목 과거 데이터 부족 문제를 해결.
 *
 * @return { return1M, return3M, return6M, return1Y } 또는 null (이력 부재)
 *         각 항목은 '12.34%' 문자열 또는 null (해당 기간 데이터 없음)
 */
function _calcReturnFromHistory(ss, normCode, currentPrice) {
  const sheet = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 2) return null;

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0].map(_normCode);
  const colIdx  = headers.indexOf(normCode);
  if (colIdx < 0) return null;
  const dataCol = colIdx + 2;

  const lastRow    = sheet.getLastRow();
  const dateVals   = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const priceVals  = sheet.getRange(2, dataCol, lastRow - 1, 1).getValues();

  const points = [];
  for (let i = 0; i < dateVals.length; i++) {
    const raw = dateVals[i][0];
    if (!raw) continue;
    const d = raw instanceof Date ? raw : new Date(String(raw).slice(0, 10));
    if (isNaN(d.getTime())) continue;
    const p = Number(priceVals[i][0]);
    if (!isFinite(p) || p <= 0) continue;
    points.push({ date: d, price: p });
  }
  if (points.length === 0) return null;

  points.sort((a, b) => b.date - a.date);  // 내림차순 (최신 먼저)

  const now = new Date();
  const findPriceAgo = (months) => {
    const target = new Date(now);
    target.setMonth(target.getMonth() - months);
    const cand = points.filter(p => p.date <= target);
    return cand.length > 0 ? cand[0].price : null;
  };

  const calcRate = (past) => past ? ((currentPrice - past) / past * 100).toFixed(2) + '%' : null;
  return {
    return1M: calcRate(findPriceAgo(1)),
    return3M: calcRate(findPriceAgo(3)),
    return6M: calcRate(findPriceAgo(6)),
    return1Y: calcRate(findPriceAgo(12)),
  };
}

/**
 * [수동 실행] *현재가_이력* 과거 데이터 백필 (최대 4개월치 일봉)
 * 신시스템 초기 설정 후 1회 실행하여 기간별 수익 계산에 필요한 이력을 채운다.
 * NewSystem.js > backfillPriceHistory 실행
 */
function backfillPriceHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const allCodes = _getActiveCodes(ss);
  if (allCodes.length === 0) { Logger.log('백필: 활성 종목 없음'); return; }

  const domCodes = allCodes.filter(c => !/^[A-Za-z]{1,5}$/.test(c));
  const ovsCodes = allCodes.filter(c => /^[A-Za-z]{1,5}$/.test(c));

  KIS_API.ensureToken();
  const usdKrw = _getSettingsFxRate(ss, 'USD/KRW');

  // 해외 종목 거래소 정보 조회 (실패 시 NAS 기본값)
  const ovsExchangeMap = {};
  if (ovsCodes.length > 0) {
    try {
      const raw = KIS_API.getOverseasStockInfoBatch(ovsCodes);
      ovsCodes.forEach(c => { ovsExchangeMap[c] = (raw[c] && raw[c].exchange) || 'NAS'; });
    } catch (e) {
      ovsCodes.forEach(c => { ovsExchangeMap[c] = 'NAS'; });
    }
  }

  const histItems = [
    ...domCodes.map(c => ({
      code: /^\d+$/.test(c) ? c.padStart(6, '0') : c,
      isOverseas: false,
      _norm: c
    })),
    ...ovsCodes.map(c => ({
      code: c,
      isOverseas: true,
      exchange: ovsExchangeMap[c] || 'NAS',
      _norm: c
    })),
  ];

  Logger.log('백필 시작: ' + histItems.length + '개 종목 일봉 조회 중...');
  const rawHist = KIS_API.fetchAllStockHistory(histItems);

  // date(YYYYMMDD) → normCode → priceKrw
  const dateMap = {};
  histItems.forEach(item => {
    const dailyH = (rawHist.daily || {})[item.code] || [];
    dailyH.forEach(row => {
      if (!row.date || !row.close || row.close <= 0) return;
      const d = String(row.date);
      const dateStr = d.length === 8
        ? d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8)
        : d.substring(0, 10);
      if (!dateStr || dateStr.length < 10) return;
      if (!dateMap[dateStr]) dateMap[dateStr] = {};
      dateMap[dateStr][item._norm] = item.isOverseas
        ? Math.round(row.close * usdKrw)
        : Math.round(row.close);
    });
  });

  const sortedDates = Object.keys(dateMap).sort();
  if (sortedDates.length === 0) { Logger.log('백필: 조회된 이력 없음'); return; }

  const histSheet = ss.getSheetByName(NS.PRICE_HISTORY);
  if (!histSheet) { Logger.log('백필: *현재가_이력* 시트 없음'); return; }

  // 기존 날짜 목록
  const lastRow = histSheet.getLastRow();
  const existingDates = new Set();
  if (lastRow >= 2) {
    histSheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(r => {
      const raw = r[0];
      const d = raw instanceof Date
        ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
        : String(raw).slice(0, 10);
      if (d && d.length === 10) existingDates.add(d);
    });
  }

  // 헤더 코드 확인 및 신규 코드 추가
  const curLastCol = histSheet.getLastColumn();
  const headerCodes = curLastCol >= 2
    ? histSheet.getRange(1, 2, 1, curLastCol - 1).getValues()[0].map(c => _normCode(String(c)))
    : [];
  allCodes.forEach(code => {
    if (!headerCodes.includes(code)) {
      const newCol = headerCodes.length + 2;
      histSheet.getRange(1, newCol).setValue(code)
        .setFontWeight('bold').setBackground(NS.HDR_BG).setFontColor(NS.HDR_FG);
      histSheet.setColumnWidth(newCol, 100);
      headerCodes.push(code);
    }
  });

  // 신규 날짜만 추가 (오름차순으로 이미 정렬된 sortedDates)
  let insertedCount = 0;
  sortedDates.forEach(dateStr => {
    if (existingDates.has(dateStr)) return;
    const priceRow = headerCodes.map(code => dateMap[dateStr][code] || '');
    const writeRow = histSheet.getLastRow() + 1;
    histSheet.getRange(writeRow, 1).setValue(dateStr);
    if (priceRow.length > 0) {
      histSheet.getRange(writeRow, 2, 1, priceRow.length).setValues([priceRow]).setNumberFormat('#,##0');
    }
    insertedCount++;
  });

  // 날짜 오름차순 정렬 (기존 행과 신규 행 섞였을 경우)
  if (insertedCount > 0 && histSheet.getLastRow() > 2) {
    histSheet.getRange(2, 1, histSheet.getLastRow() - 1, histSheet.getLastColumn()).sort(1);
  }

  Logger.log('백필 완료: ' + insertedCount + '개 날짜 추가, 총 ' + (existingDates.size + insertedCount) + '개 행');
}

/**
 * *추이 기록* 시트에 3개 섹션 기록
 * A(업데이트별 추이 B~L) + B(일별 추이 N~S) + C(수익 추이 U~AF)
 * updateNewCurrentPrice() 호출 시 자동 실행
 */
function _updateNewTrend(ss, now) {
  ss  = ss  || SpreadsheetApp.getActiveSpreadsheet();
  now = now || new Date();

  const tz     = 'Asia/Seoul';
  const fmtNum = v => isNaN(v) ? 0 : Math.round(Number(v));
  // ⚠️ 숫자(소숫점 2자리)로 반환 — 셀에 setNumberFormat('0.00"%"') 적용해야 % 표시
  const fmtPct = n => Math.round((isFinite(n) ? n : 0) * 100) / 100;
  const toNum  = v => {
    if (v === '' || v == null) return 0;
    const n = Number(String(v).replace(/,/g, '').replace('%', ''));
    return isNaN(n) ? 0 : n;
  };

  // ── 운용 수익 (*보유현황* 합계행에서 직접 읽기) ──
  const posSheet = ss.getSheetByName(NS.POSITION);
  const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);
  if (!posSheet || posSheet.getLastRow() < 2) return;

  const posAllRows = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 13).getValues();
  const posSumRow  = posAllRows.find(r => String(r[0]) === '합계');
  const opBuy    = posSumRow ? (Number(posSumRow[8])  || 0) : 0;
  const opNow    = posSumRow ? (Number(posSumRow[10]) || 0) : 0;
  const opProfit = opNow - opBuy;
  const opRate   = opBuy ? opProfit / opBuy * 100 : 0;

  // ── 확정 수익 (*실현손익*) ──
  // ⚠️ 합계행은 r[0]='합계' / r[2]=''(빈 종목명). 필터를 r[0] 기준으로 해야 합계행 제외됨
  const pnlRows = (pnlSheet && pnlSheet.getLastRow() >= 2)
    ? pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
        .filter(r => r[0] && String(r[0]) !== '합계')
    : [];
  const cfSell   = pnlRows.reduce((s, r) => s + (Number(r[8])  || 0), 0);
  const cfBuy    = pnlRows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
  const cfProfit = pnlRows.reduce((s, r) => s + (Number(r[12]) || 0), 0);
  const cfRate   = cfBuy ? cfProfit / cfBuy * 100 : 0;
  const totProfit = Math.round(opProfit + cfProfit);

  // ── 대기합계 (*설정* 시트 수동 입력) ──
  const pendNow = _getPendingTotal(ss);
  const sumNow  = opNow + pendNow;

  // ── *추이 기록* 시트 ──
  let sheet = ss.getSheetByName(NS.TREND);
  if (!sheet) {
    sheet = ss.insertSheet(NS.TREND);
    sheet.setFrozenRows(1);
  }

  // 레이아웃 감지: U열(col 21) 5~50행에 날짜 문자열이 있으면 구시스템 붙여넣기 형식
  const useOldCol = (() => {
    const maxRow = sheet.getLastRow();
    if (maxRow < 5) return false;
    const checkH = Math.min(maxRow, 50) - 4;
    return sheet.getRange(5, 21, checkH, 1).getValues()
      .some(r => /^\d{4}-\d{2}-\d{2}/.test(String(r[0])));
  })();
  const writeCol = useOldCol ? 21 : 1;

  const today   = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd (EEE)');
  const timeStr = Utilities.formatDate(now, tz, 'a h시 m분 s초')
    .replace('AM', '오전').replace('PM', '오후');

  // ════════════════════════════════════════════════
  // Section A: 업데이트별 추이 (B~L, col 2~12, 11열)
  // 항상 append + B2:L2 스냅샷
  // ════════════════════════════════════════════════
  {
    const aStart = 5, aCol = 2, aCols = 11;
    const aLast  = sheet.getLastRow();
    let aLastFilled = aStart - 1;
    if (aLast >= aStart) {
      const colB = sheet.getRange(aStart, aCol, aLast - aStart + 1, 1).getValues();
      for (let i = colB.length - 1; i >= 0; i--) {
        if (colB[i][0] !== '' && colB[i][0] != null) { aLastFilled = aStart + i; break; }
      }
    }
    let prevOp = 0, prevPend = 0, prevSum = 0;
    if (aLastFilled >= aStart) {
      const prev = sheet.getRange(aLastFilled, aCol, 1, aCols).getValues()[0];
      prevOp   = toNum(prev[2]); // D: 운용합계
      prevPend = toNum(prev[5]); // G: 대기합계
      prevSum  = toNum(prev[8]); // J: 전체합계
    }
    const opCh   = opNow   - prevOp;
    const pendCh = pendNow - prevPend;
    const sumCh  = sumNow  - prevSum;
    const aRow = [
      dateStr, timeStr,
      fmtNum(opNow),   fmtNum(opCh),   fmtPct(prevOp   ? opCh   / prevOp   * 100 : 0),
      fmtNum(pendNow), fmtNum(pendCh), fmtPct(prevPend ? pendCh / prevPend * 100 : 0),
      fmtNum(sumNow),  fmtNum(sumCh),  fmtPct(prevSum  ? sumCh  / prevSum  * 100 : 0),
    ];
    const aWriteRow = Math.max(aLastFilled, aStart - 1) + 1;
    sheet.getRange(aWriteRow, aCol, 1, aCols).setValues([aRow]);
    sheet.getRange(2, aCol, 1, aCols).setValues([aRow]); // B2:L2 스냅샷
    // 포맷 적용 (writeRow + row 2)
    [aWriteRow, 2].forEach(r => {
      sheet.getRange(r, aCol + 2, 1, 2).setNumberFormat('#,##0');           // D, E (opNow, opCh)
      sheet.getRange(r, aCol + 4, 1, 1).setNumberFormat('0.00"%"');         // F (opChRate)
      sheet.getRange(r, aCol + 5, 1, 2).setNumberFormat('#,##0');           // G, H
      sheet.getRange(r, aCol + 7, 1, 1).setNumberFormat('0.00"%"');         // I
      sheet.getRange(r, aCol + 8, 1, 2).setNumberFormat('#,##0');           // J, K
      sheet.getRange(r, aCol + 10, 1, 1).setNumberFormat('0.00"%"');        // L
    });
  }

  // ════════════════════════════════════════════════
  // Section B: 일별 추이 (N~S, col 14~19, 6열)
  // upsert(날짜 기준) + N2:S2 스냅샷
  // ════════════════════════════════════════════════
  {
    const bStart = 5, bCol = 14, bCols = 6;
    const bLast  = sheet.getLastRow();
    let bTodayRow = null, bLastFilled = bStart - 1;
    if (bLast >= bStart) {
      const colN = sheet.getRange(bStart, bCol, bLast - bStart + 1, 1).getValues();
      for (let i = 0; i < colN.length; i++) {
        const d = String(colN[i][0] || '').slice(0, 10);
        if (d === today) bTodayRow = bStart + i;
        if (colN[i][0] !== '' && colN[i][0] != null) bLastFilled = bStart + i;
      }
    }
    const bPrevRow = bTodayRow ? bTodayRow - 1 : bLastFilled;
    let prevSum = 0;
    if (bPrevRow >= bStart) {
      prevSum = toNum(sheet.getRange(bPrevRow, bCol + 3, 1, 1).getValue()); // Q: 전체합계
    }
    const bDiff = sumNow - prevSum;
    const bRow  = [
      dateStr + ' ' + timeStr,
      fmtNum(opNow), fmtNum(pendNow), fmtNum(sumNow),
      fmtNum(bDiff), fmtPct(prevSum ? bDiff / prevSum * 100 : 0),
    ];
    const bWriteRow = bTodayRow || Math.max(bLastFilled, bStart - 1) + 1;
    sheet.getRange(bWriteRow, bCol, 1, bCols).setValues([bRow]);
    sheet.getRange(2, bCol, 1, bCols).setValues([bRow]); // N2:S2 스냅샷
    // 포맷 적용
    [bWriteRow, 2].forEach(r => {
      sheet.getRange(r, bCol + 1, 1, 4).setNumberFormat('#,##0');           // O~R
      sheet.getRange(r, bCol + 5, 1, 1).setNumberFormat('0.00"%"');         // S
    });
  }

  // ════════════════════════════════════════════════
  // Section C: 수익 추이 (writeCol~, 12열)
  // upsert(row 5~) + row 2 스냅샷 + AH/AI/AJ/AK row 2 기준
  //
  // ⚠️ writeRow 계산은 반드시 writeCol(=날짜 열) 기준으로!
  //    sheet.getLastRow()는 Section A append 로 증가하므로 사용 금지.
  // ════════════════════════════════════════════════
  const cStart  = 5;
  const sheetLastRow = sheet.getLastRow();

  // row 2 읽기 (AH/AI/AJ/AK 캐시 용도. prevTotProfit 은 last data row 에서 직접 계산)
  const prevU2     = sheetLastRow >= 2
    ? sheet.getRange(2, writeCol, 1, 17).getValues()[0] : [];
  const prevU2Date = String(prevU2[0] || '').slice(0, 10);

  // writeCol(날짜 열) 기준으로 today 행 + last filled (today 제외) 탐색
  let writeRow      = cStart;
  let cLastFilled   = cStart - 1;
  let prevTotRow    = -1;  // last data row (today 제외) — prevTotProfit 출처
  if (sheetLastRow >= cStart) {
    const dates = sheet.getRange(cStart, writeCol, sheetLastRow - cStart + 1, 1).getValues();
    let todayRow = null;
    for (let i = 0; i < dates.length; i++) {
      const raw = dates[i][0];
      if (raw === '' || raw == null) continue;
      cLastFilled = cStart + i;
      const d = raw instanceof Date
        ? Utilities.formatDate(raw, tz, 'yyyy-MM-dd')
        : String(raw).slice(0, 10);
      if (d === today && todayRow === null) todayRow = cStart + i;
      else                                   prevTotRow = cStart + i;  // today 가 아닌 마지막 행
    }
    writeRow = todayRow !== null ? todayRow : cLastFilled + 1;
  }
  // prevTotProfit: last data row (today 행 제외) 의 AD 컬럼 값
  const prevTotProfit = prevTotRow >= cStart
    ? toNum(sheet.getRange(prevTotRow, writeCol + 9, 1, 1).getValue())
    : 0;

  const diffProfit = totProfit - prevTotProfit;
  const diffRate   = prevTotProfit ? diffProfit / prevTotProfit * 100 : 0;

  const cRow = [
    dateStr + ' ' + timeStr,
    fmtNum(cfBuy), fmtNum(cfSell),
    fmtNum(cfProfit), fmtPct(cfRate),
    fmtNum(opBuy), fmtNum(opNow),
    fmtNum(opProfit), fmtPct(opRate),
    fmtNum(totProfit), fmtNum(diffProfit),
    fmtPct(diffRate),
  ];

  const _nowDow       = now.getDay();
  const _todayTrading = _nowDow !== 0 && _nowDow !== 6 && !_isKoreanHoliday(now);

  // AJ/AK 백업: 날짜 바뀌었고 양쪽 모두 거래일 → AH/AI(index 13/14) → AJ/AK
  if (prevU2Date && prevU2Date !== today && _todayTrading) {
    const prevDateObj = new Date(prevU2Date);
    const pd = prevDateObj.getDay();
    if (pd !== 0 && pd !== 6 && !_isKoreanHoliday(prevDateObj)) {
      sheet.getRange(2, writeCol + 15, 1, 2).setValues([[prevU2[13], prevU2[14]]]);
    }
  }

  // Section C 역사 행 기록
  sheet.getRange(writeRow, writeCol, 1, 12).setValues([cRow]);

  // row 2 스냅샷: U2=현재 타임스탬프, V2:AD2=마지막 데이터 행 V~AD 값
  sheet.getRange(2, writeCol, 1, 1).setValues([[cRow[0]]]);
  sheet.getRange(2, writeCol + 1, 1, 9).setValues([cRow.slice(1, 10)]);

  // 포맷 적용 (writeRow + row 2)
  [writeRow, 2].forEach(r => {
    sheet.getRange(r, writeCol + 1, 1, 3).setNumberFormat('#,##0');           // V, W, X (cfBuy/Sell/Profit)
    sheet.getRange(r, writeCol + 4, 1, 1).setNumberFormat('0.00"%"');         // Y (cfRate)
    sheet.getRange(r, writeCol + 5, 1, 3).setNumberFormat('#,##0');           // Z, AA, AB (opBuy/Now/Profit)
    sheet.getRange(r, writeCol + 8, 1, 1).setNumberFormat('0.00"%"');         // AC (opRate)
    sheet.getRange(r, writeCol + 9, 1, 2).setNumberFormat('#,##0');           // AD, AE (totProfit/diffProfit)
    sheet.getRange(r, writeCol + 11, 1, 1).setNumberFormat('0.00"%"');        // AF (diffRate)
  });

  // AH/AI 캐시: 거래일에만 갱신
  if (_todayTrading) {
    sheet.getRange(2, writeCol + 13, 1, 2).setValues([[fmtNum(diffProfit), fmtPct(diffRate)]]);
    sheet.getRange(2, writeCol + 13, 1, 1).setNumberFormat('#,##0');         // AH
    sheet.getRange(2, writeCol + 14, 1, 1).setNumberFormat('0.00"%"');       // AI
  }

  Logger.log('_updateNewTrend: ' + today + ' 합계수익=' + totProfit + ' 대기=' + pendNow);
}
