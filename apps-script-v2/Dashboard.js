/**
 * Dashboard.js — *대시보드* 시트 생성/갱신 (신시스템, 19컬럼 레이아웃)
 *
 * 보유 종목 현황 컬럼 (19):
 *   종목명 | 분류 | 증권사/계좌 | 수량 | 평균단가 | 현재단가 | 매입금액 |
 *   손익 | 수익률 | 보유기간 |
 *   당일 등락액 | 당일 등락률 | 당일 손익 | 1주일 손익 | 1달 손익 |
 *   1M | 3M | 6M | 1Y
 *
 * 1주일/1달 손익 = (오늘 평가금액) − (N일전 평가금액)
 *   - 오늘 평가금액 = 오늘가 × 현재 수량
 *   - N일전 평가금액 = N일전 가격 × N일전 시점 수량 (원장 누적 재구성)
 * 1M/3M/6M/1Y = (오늘가 − N일전 가격) / N일전 가격 × 100  (단순 가격 변동률)
 *
 * 정렬 드롭다운: 헤더 위 셀에서 컬럼/방향 선택 → onEdit 트리거로 재정렬
 */

const DB = {
  SHEET:        '*대시보드*',
  BG_TITLE:     '#1a1a2e',
  FG_TITLE:     '#ffffff',
  BG_SECTION:   '#2d3561',
  FG_SECTION:   '#ffffff',
  BG_HDR:       '#e8eaf6',
  FG_HDR:       '#1a237e',
  BG_EVEN:      '#f8f9fa',
  BG_ODD:       '#ffffff',
  BG_TOTAL:     '#e3f2fd',
  FG_POS:       '#c62828',   // 상승 = 빨강 (한국식)
  FG_NEG:       '#1565c0',   // 하락 = 파랑
  BG_CARD_POS:  '#fde8e8',
  BG_CARD_NEG:  '#e8f0fe',
  BG_CARD_NEU:  '#f3f4f6',
  COLS:         20,
  PROP_SORT_KEY: 'DASH_POS_SORT_KEY',
  PROP_SORT_DIR: 'DASH_POS_SORT_DIR',
};

// 보유 종목 정렬 옵션
// type: 'str' | 'num' | 'date' | 'extra'
//   col   = posRow의 인덱스 (col 또는 extra 중 하나)
//   extra = extraMap[code][key]에서 가져옴
const DB_POS_SORT_OPTS = {
  '기본 (계좌순)': null,
  '종목명':       { col: 1,  type: 'str'  },
  '분류':         { col: 2,  type: 'str'  },
  '계좌':         { col: 4,  type: 'str'  },
  '수량':         { col: 6,  type: 'num'  },
  '평균단가':     { col: 7,  type: 'num'  },
  '현재단가':     { col: 9,  type: 'num'  },
  '매입금액':     { col: 8,  type: 'num'  },
  '평가금액':     { col: 10, type: 'num'  },
  '손익':         { col: 11, type: 'num'  },
  '수익률':       { col: 12, type: 'num'  },
  '보유기간':     { col: 5,  type: 'date' },
  '당일 등락액':  { type: 'extra', key: 'todayChange'    },
  '당일 등락률':  { type: 'extra', key: 'todayChangePct' },
  '당일 손익':    { type: 'extra', key: 'todayPnl'       },
  '1주일 손익':   { type: 'extra', key: 'w1Pnl'          },
  '1달 손익':     { type: 'extra', key: 'm1Pnl'          },
  '1M':           { type: 'extra', key: 'm1Pct'          },
  '3M':           { type: 'extra', key: 'm3Pct'          },
  '6M':           { type: 'extra', key: 'm6Pct'          },
  '1Y':           { type: 'extra', key: 'y1Pct'          },
};

function buildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const posSheet       = ss.getSheetByName(NS.POSITION);
  const pnlSheet       = ss.getSheetByName(NS.REALIZED_PNL);
  const priceHistSheet = ss.getSheetByName(NS.PRICE_HISTORY);
  const ledgerSheet    = ss.getSheetByName(NS.LEDGER);

  if (!posSheet) {
    ss.toast('*보유현황* 없음 — updatePositionFromLedger 먼저 실행', '⚠️', 4);
    return;
  }

  // ── 데이터 읽기 ──
  const posRows = posSheet.getLastRow() >= 2
    ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 13).getValues()
        .filter(r => String(r[0]) !== '합계' && Number(r[6]) > 0)
    : [];

  const pnlRows = (pnlSheet && pnlSheet.getLastRow() >= 2)
    ? pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
        .filter(r => r[0] && String(r[0]) !== '합계')
    : [];

  // ── 요약 지표 ──
  const totalBuy    = posRows.reduce((s, r) => s + (Number(r[8])  || 0), 0);
  const totalCur    = posRows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
  const opProfit    = totalCur - totalBuy;
  const opRate      = totalBuy > 0 ? opProfit / totalBuy * 100 : 0;
  const cfProfit    = pnlRows.reduce((s, r) => s + (Number(r[12]) || 0), 0);
  const totalProfit = opProfit + cfProfit;
  const winCount    = pnlRows.filter(r => Number(r[12]) > 0).length;
  const winRate     = pnlRows.length > 0 ? winCount / pnlRows.length * 100 : 0;

  const todayProfit = _calcTodayProfit(priceHistSheet, posRows);
  const extraMap    = _calcExtraColumns(priceHistSheet, posRows, ledgerSheet);
  const fx          = _getFxRates(ss);

  // ── 시트 준비 ──
  let dash = ss.getSheetByName(DB.SHEET);
  if (!dash) dash = ss.insertSheet(DB.SHEET);
  dash.clearContents();
  dash.clearFormats();
  dash.getRange(1, 1, dash.getMaxRows(), dash.getMaxColumns()).clearDataValidations();
  // 컬럼 너비 (20개)
  [155, 85, 110, 65, 90, 90, 100, 100, 90, 75, 75, 85, 80, 90, 95, 95, 68, 68, 68, 68]
    .forEach((w, i) => dash.setColumnWidth(i + 1, w));

  let r = 1;

  // ══════════════════════════════════
  // [1] 타이틀
  // ══════════════════════════════════
  dash.getRange(r, 1, 1, DB.COLS).merge()
    .setValue('📊 포트폴리오 대시보드')
    .setFontSize(16).setFontWeight('bold')
    .setBackground(DB.BG_TITLE).setFontColor(DB.FG_TITLE)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(r, 44);
  r++;

  dash.getRange(r, 1, 1, DB.COLS).merge()
    .setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm 기준'))
    .setFontSize(10).setFontColor('#888888')
    .setHorizontalAlignment('right').setBackground('#f8f9fa');
  r += 2;

  // ══════════════════════════════════
  // [2] 요약 카드 (4 카드 × 2행, 각 카드는 약 5컬럼 폭)
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '요약');

  const todayBg  = todayProfit === null ? DB.BG_CARD_NEU
                 : todayProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG;
  const todayVal = todayProfit === null ? '─'
                 : (todayProfit >= 0 ? '+' : '') + Math.round(todayProfit).toLocaleString('ko-KR');
  const fxVal    = (fx.usd > 0 || fx.gbp > 0)
    ? 'USD ₩' + Math.round(fx.usd).toLocaleString('ko-KR') + '\nGBP ₩' + Math.round(fx.gbp).toLocaleString('ko-KR')
    : '갱신 필요';

  const cardStarts = [1, 6, 11, 16];
  const cardSpans  = [5, 5, 5, 5];   // 합계 = 20
  const cardMatrix = [
    [
      { label: '총 매입금액',  val: _dbNum(totalBuy),    sub: '',                                              bg: DB.BG_CARD_NEU, signed: false },
      { label: '총 평가금액',  val: _dbNum(totalCur),    sub: '',                                              bg: DB.BG_CARD_NEU, signed: false },
      { label: '총 수익',      val: _dbPnl(totalProfit), sub: '',                                              bg: totalProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
      { label: '오늘의 수익',  val: todayVal,            sub: '',                                              bg: todayBg, signed: todayProfit !== null },
    ],
    [
      { label: 'USD / GBP',   val: fxVal,                sub: '',                                              bg: DB.BG_CARD_NEU, signed: false },
      { label: '승률',         val: _dbRate(winRate),    sub: winCount + '/' + pnlRows.length + '건',          bg: DB.BG_CARD_NEU, signed: false },
      { label: '확정 수익',    val: _dbPnl(cfProfit),    sub: pnlRows.length + '건 매도',                      bg: cfProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
      { label: '운용 손익',    val: _dbPnl(opProfit),    sub: _dbRate(opRate),                                 bg: opProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
    ],
  ];

  for (const rowCards of cardMatrix) {
    for (let j = 0; j < 4; j++) {
      const c = rowCards[j];
      dash.getRange(r, cardStarts[j], 1, cardSpans[j]).merge()
        .setValue(c.label).setFontWeight('bold').setFontSize(10)
        .setBackground(c.bg).setFontColor('#555555')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
    }
    r++;
    for (let j = 0; j < 4; j++) {
      const c = rowCards[j];
      const isNeg = c.signed && String(c.val).startsWith('-');
      const fg = c.signed ? (isNeg ? DB.FG_NEG : DB.FG_POS) : '#222222';
      dash.getRange(r, cardStarts[j], 1, cardSpans[j]).merge()
        .setValue(c.val + (c.sub ? '\n' + c.sub : ''))
        .setFontSize(12).setFontWeight('bold').setBackground(c.bg).setFontColor(fg)
        .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
      dash.setRowHeight(r, 46);
    }
    r++;
  }
  r++;

  // ══════════════════════════════════
  // [3] 보유 종목 현황 (19컬럼 + 정렬 컨트롤)
  // ══════════════════════════════════
  const sortKey = PropertiesService.getScriptProperties().getProperty(DB.PROP_SORT_KEY) || '기본 (계좌순)';
  const sortDir = PropertiesService.getScriptProperties().getProperty(DB.PROP_SORT_DIR) || '↓';
  r = _dbSectionTitle(dash, r, '보유 종목 현황 (' + sortKey + (sortKey === '기본 (계좌순)' ? '' : ' ' + sortDir) + ')');

  // 정렬 컨트롤
  dash.getRange(r, 1, 1, 2).merge().setValue('🔀 정렬').setBackground('#fff3cd')
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange(r, 3, 1, 3).merge().setValue(sortKey).setBackground('#fff3cd')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange(r, 6, 1, 2).merge().setValue(sortDir).setBackground('#fff3cd')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.getRange(r, 3, 1, 3).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(Object.keys(DB_POS_SORT_OPTS), true).setAllowInvalid(false).build()
  );
  dash.getRange(r, 6, 1, 2).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['↓', '↑'], true).setAllowInvalid(false).build()
  );
  dash.getRange(r, 8, 1, DB.COLS - 7).merge()
    .setValue('컬럼 또는 방향을 선택하면 보유 종목만 다시 정렬됩니다 (다른 섹션 영향 없음)')
    .setFontSize(9).setFontColor('#666666').setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setBackground('#fff3cd');
  r++;

  _dbHeader(dash, r, 1, [
    '종목명', '분류', '증권사 / 계좌', '수량', '평균단가', '현재단가', '매입금액', '평가금액',
    '손익', '수익률', '보유기간',
    '당일 등락액', '당일 등락률', '당일 손익', '1주일 손익', '1달 손익',
    '1M', '3M', '6M', '1Y'
  ]);
  r++;

  const POS_ORDER = {
    '미래에셋투자증권|종합_랩': 0, '미래에셋투자증권|퇴직연금_개인IRP': 1,
    '삼성증권|종합': 2, '삼성증권|ISA': 3, '삼성증권|퇴직연금_개인IRP(범용)': 4,
  };

  const sortOpt = DB_POS_SORT_OPTS[sortKey];
  const sortMul = sortDir === '↑' ? 1 : -1;

  const sortedPos = [...posRows].sort((a, b) => {
    if (!sortOpt) {
      const ka = POS_ORDER[String(a[3]) + '|' + String(a[4])] ?? 99;
      const kb = POS_ORDER[String(b[3]) + '|' + String(b[4])] ?? 99;
      return ka !== kb ? ka - kb : String(a[1]).localeCompare(String(b[1]));
    }
    if (sortOpt.type === 'extra') {
      const keyA = _normCode(String(a[0])) + '||' + String(a[3] || '') + '||' + String(a[4] || '');
      const keyB = _normCode(String(b[0])) + '||' + String(b[3] || '') + '||' + String(b[4] || '');
      const ea = extraMap.get(keyA) || {};
      const eb = extraMap.get(keyB) || {};
      const va = ea[sortOpt.key], vb = eb[sortOpt.key];
      const na = va == null ? -Infinity : Number(va);
      const nb = vb == null ? -Infinity : Number(vb);
      return sortMul * (na - nb);
    }
    const va = a[sortOpt.col], vb = b[sortOpt.col];
    if (sortOpt.type === 'str') {
      return sortMul * String(va || '').localeCompare(String(vb || ''));
    } else if (sortOpt.type === 'date') {
      return sortMul * (_dbParseHoldingDays(va) - _dbParseHoldingDays(vb));
    } else {
      return sortMul * ((Number(va) || 0) - (Number(vb) || 0));
    }
  });

  sortedPos.forEach((row, i) => {
    const pnl  = Number(row[11]) || 0;
    const rate = Number(row[12]) || 0;
    const buy  = Number(row[8])  || 0;
    const code = _normCode(String(row[0]));
    const key  = code + '||' + String(row[3] || '') + '||' + String(row[4] || '');
    const ex   = extraMap.get(key) || {};
    const tCh  = ex.todayChange,    tPct = ex.todayChangePct, tPnl = ex.todayPnl;
    const w1   = ex.w1Pnl,          m1L  = ex.m1Pnl;
    const m1P  = ex.m1Pct, m3P = ex.m3Pct, m6P = ex.m6Pct, y1P = ex.y1Pct;

    dash.getRange(r, 1, 1, DB.COLS).setValues([[
      row[1], row[2], _shortBroker(row[3]) + ' / ' + _shortAcct(row[4]),
      _dbNum(row[6]), _dbNum(row[7]), _dbNum(row[9]),
      _dbNum(buy),
      _dbNum(Number(row[10]) || 0),    // 평가금액 (신규)
      _dbPnl(pnl), _dbRate(rate), row[5],
      tCh  == null ? '─' : _dbPnl(tCh),
      tPct == null ? '─' : _dbRate(tPct),
      tPnl == null ? '─' : _dbPnl(tPnl),
      w1   == null ? '─' : _dbPnl(w1),
      m1L  == null ? '─' : _dbPnl(m1L),
      m1P  == null ? '─' : _dbRate(m1P),
      m3P  == null ? '─' : _dbRate(m3P),
      m6P  == null ? '─' : _dbRate(m6P),
      y1P  == null ? '─' : _dbRate(y1P)
    ]]);
    dash.getRange(r, 1, 1, DB.COLS).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
    dash.getRange(r, 1, 1, 3).setHorizontalAlignment('center');
    dash.getRange(r, 4, 1, 7).setHorizontalAlignment('right');   // 수량~수익률 (7개: +평가금액)
    dash.getRange(r, 11).setHorizontalAlignment('center');       // 보유기간 (10→11)
    dash.getRange(r, 12, 1, 9).setHorizontalAlignment('right');  // 신규 5개 + 1M~1Y (11→12)
    _dbColorCell(dash, r, 9, pnl);         // 손익 (8→9)
    _dbColorCell(dash, r, 10, rate);       // 수익률 (9→10)
    if (tCh  != null) _dbColorCell(dash, r, 12, tCh);
    if (tPct != null) _dbColorCell(dash, r, 13, tPct);
    if (tPnl != null) _dbColorCell(dash, r, 14, tPnl);
    if (w1   != null) _dbColorCell(dash, r, 15, w1);
    if (m1L  != null) _dbColorCell(dash, r, 16, m1L);
    if (m1P  != null) _dbColorCell(dash, r, 17, m1P);
    if (m3P  != null) _dbColorCell(dash, r, 18, m3P);
    if (m6P  != null) _dbColorCell(dash, r, 19, m6P);
    if (y1P  != null) _dbColorCell(dash, r, 20, y1P);
    r++;
  });

  // 합계 행 (매입금액·평가금액·손익·당일손익·1주일손익·1달손익)
  {
    let sumBuy = 0, sumCur = 0, sumPnl = 0;
    let sumTodayPnl = 0, sumW1Pnl = 0, sumM1Pnl = 0;
    sortedPos.forEach(row => {
      sumBuy += Number(row[8])  || 0;
      sumCur += Number(row[10]) || 0;
      sumPnl += Number(row[11]) || 0;
      const key = _normCode(String(row[0])) + '||' + String(row[3] || '') + '||' + String(row[4] || '');
      const ex = extraMap.get(key) || {};
      if (ex.todayPnl != null) sumTodayPnl += ex.todayPnl;
      if (ex.w1Pnl    != null) sumW1Pnl    += ex.w1Pnl;
      if (ex.m1Pnl    != null) sumM1Pnl    += ex.m1Pnl;
    });
    dash.getRange(r, 1, 1, DB.COLS).setValues([[
      '합계', '', '', '', '', '',
      _dbNum(sumBuy), _dbNum(sumCur), _dbPnl(sumPnl),
      '', '', '', '',
      _dbPnl(sumTodayPnl), _dbPnl(sumW1Pnl), _dbPnl(sumM1Pnl),
      '', '', '', ''
    ]]).setFontWeight('bold').setBackground(DB.BG_TOTAL);
    dash.getRange(r, 1).setHorizontalAlignment('center');
    dash.getRange(r, 7, 1, 3).setHorizontalAlignment('right');
    dash.getRange(r, 14, 1, 3).setHorizontalAlignment('right');
    _dbColorCell(dash, r, 9,  sumPnl);
    _dbColorCell(dash, r, 14, sumTodayPnl);
    _dbColorCell(dash, r, 15, sumW1Pnl);
    _dbColorCell(dash, r, 16, sumM1Pnl);
    r++;
  }
  r++;

  // ══════════════════════════════════
  // [4] 계좌별 현황
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '계좌별 현황');
  _dbHeader(dash, r, 1, ['증권사', '계좌', '종목수', '매입금액', '평가금액', '손익', '수익률', '비중']);
  r++;

  const acctMap = {};
  posRows.forEach(row => {
    const key = row[3] + '||' + row[4];
    if (!acctMap[key]) acctMap[key] = { broker: String(row[3]), acct: String(row[4]), cnt: 0, buy: 0, cur: 0 };
    acctMap[key].cnt++;
    acctMap[key].buy += Number(row[8])  || 0;
    acctMap[key].cur += Number(row[10]) || 0;
  });

  const ACCT_ORDER = {
    '미래에셋투자증권|종합_랩': 0, '미래에셋투자증권|퇴직연금_개인IRP': 1,
    '삼성증권|종합': 2, '삼성증권|ISA': 3, '삼성증권|퇴직연금_개인IRP(범용)': 4,
  };

  Object.values(acctMap)
    .sort((a, b) => {
      const ka = ACCT_ORDER[a.broker + '|' + a.acct] ?? 99;
      const kb = ACCT_ORDER[b.broker + '|' + b.acct] ?? 99;
      return ka - kb;
    })
    .forEach((a, i) => {
      const pnl  = a.cur - a.buy;
      const rate = a.buy > 0 ? pnl / a.buy * 100 : 0;
      const wt   = totalCur > 0 ? a.cur / totalCur * 100 : 0;
      const rng  = dash.getRange(r, 1, 1, 8);
      rng.setValues([[_shortBroker(a.broker), _shortAcct(a.acct), a.cnt,
        _dbNum(a.buy), _dbNum(a.cur), _dbPnl(pnl), _dbRate(rate), _dbRate(wt)]]);
      rng.setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      dash.getRange(r, 1, 1, 2).setHorizontalAlignment('center');
      dash.getRange(r, 3, 1, 6).setHorizontalAlignment('right');
      _dbColorCell(dash, r, 6, pnl); _dbColorCell(dash, r, 7, rate);
      r++;
    });

  dash.getRange(r, 1, 1, 8)
    .setValues([['합계', '', posRows.length, _dbNum(totalBuy), _dbNum(totalCur),
      _dbPnl(opProfit), _dbRate(opRate), '100%']])
    .setFontWeight('bold').setBackground(DB.BG_TOTAL);
  dash.getRange(r, 1, 1, 2).setHorizontalAlignment('center');
  dash.getRange(r, 3, 1, 6).setHorizontalAlignment('right');
  _dbColorCell(dash, r, 6, opProfit); _dbColorCell(dash, r, 7, opRate);
  r += 2;

  // ══════════════════════════════════
  // [5] 분류별 현황
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '분류별 현황');
  _dbHeader(dash, r, 1, ['분류', '종목수', '매입금액', '평가금액', '손익', '수익률', '비중']);
  r++;

  const catMap = {};
  posRows.forEach(row => {
    const cat = String(row[2]) || '기타';
    if (!catMap[cat]) catMap[cat] = { cnt: 0, buy: 0, cur: 0 };
    catMap[cat].cnt++;
    catMap[cat].buy += Number(row[8])  || 0;
    catMap[cat].cur += Number(row[10]) || 0;
  });

  ['국내주식','국내ETF','해외주식','해외ETF','펀드','예금','보험','기타']
    .filter(c => catMap[c])
    .forEach((cat, i) => {
      const c    = catMap[cat];
      const pnl  = c.cur - c.buy;
      const rate = c.buy > 0 ? pnl / c.buy * 100 : 0;
      const wt   = totalCur > 0 ? c.cur / totalCur * 100 : 0;
      dash.getRange(r, 1, 1, 7).setValues([[cat, c.cnt,
        _dbNum(c.buy), _dbNum(c.cur), _dbPnl(pnl), _dbRate(rate), _dbRate(wt)]]);
      dash.getRange(r, 1, 1, 7).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      dash.getRange(r, 1).setHorizontalAlignment('center');
      dash.getRange(r, 2, 1, 6).setHorizontalAlignment('right');
      _dbColorCell(dash, r, 5, pnl); _dbColorCell(dash, r, 6, rate);
      r++;
    });

  dash.getRange(r, 1, 1, 7)
    .setValues([['합계', posRows.length, _dbNum(totalBuy), _dbNum(totalCur),
      _dbPnl(opProfit), _dbRate(opRate), '100%']])
    .setFontWeight('bold').setBackground(DB.BG_TOTAL);
  dash.getRange(r, 1).setHorizontalAlignment('center');
  dash.getRange(r, 2, 1, 6).setHorizontalAlignment('right');
  _dbColorCell(dash, r, 5, opProfit); _dbColorCell(dash, r, 6, opRate);
  r += 2;

  // ══════════════════════════════════
  // [6] 확정 수익 월별 + Top/Bottom 5
  // ══════════════════════════════════
  if (pnlRows.length > 0) {
    r = _dbSectionTitle(dash, r, '확정 수익 — 월별');
    _dbHeader(dash, r, 1, ['월', '매도 건수', '수익 건수', '손실 건수', '실현손익', '승률']);
    r++;

    const mMap = {};
    pnlRows.forEach(row => {
      const m = String(row[0]).slice(0, 7);
      if (!mMap[m]) mMap[m] = { pnl: 0, cnt: 0, win: 0 };
      const p = Number(row[12]) || 0;
      mMap[m].pnl += p; mMap[m].cnt++;
      if (p > 0) mMap[m].win++;
    });

    Object.keys(mMap).sort().forEach((m, i) => {
      const d  = mMap[m];
      const wr = d.cnt > 0 ? d.win / d.cnt * 100 : 0;
      dash.getRange(r, 1, 1, 6).setValues([[m, d.cnt, d.win, d.cnt - d.win, _dbPnl(d.pnl), _dbRate(wr)]]);
      dash.getRange(r, 1, 1, 6).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      dash.getRange(r, 1).setHorizontalAlignment('center');
      dash.getRange(r, 2, 1, 5).setHorizontalAlignment('right');
      _dbColorCell(dash, r, 5, d.pnl);
      r++;
    });

    dash.getRange(r, 1, 1, 6)
      .setValues([['합계', pnlRows.length, winCount, pnlRows.length - winCount,
        _dbPnl(cfProfit), _dbRate(winRate)]])
      .setFontWeight('bold').setBackground(DB.BG_TOTAL);
    dash.getRange(r, 1).setHorizontalAlignment('center');
    dash.getRange(r, 2, 1, 5).setHorizontalAlignment('right');
    _dbColorCell(dash, r, 5, cfProfit);
    r += 2;

    // Top 5 / Bottom 5
    r = _dbSectionTitle(dash, r, '수익 Top 5  ·  손실 Top 5');
    _dbHeader(dash, r, 1, ['종목명', '매도일', '실현손익', '수익률'], '#b71c1c', '#ffffff');
    _dbHeader(dash, r, 5, ['종목명', '매도일', '실현손익', '수익률'], '#1565c0', '#ffffff');
    r++;

    const sorted = [...pnlRows].sort((a, b) => (Number(b[12]) || 0) - (Number(a[12]) || 0));
    const top5   = sorted.slice(0, 5);
    const bot5   = sorted.slice(-5).reverse();

    for (let i = 0; i < 5; i++) {
      const t = top5[i], b = bot5[i];
      if (t) {
        dash.getRange(r, 1, 1, 4)
          .setValues([[t[2], String(t[0]).slice(0, 10), _dbPnl(Number(t[12])), _dbRate(Number(t[13]))]])
          .setBackground('#fde8e8');
        dash.getRange(r, 3, 1, 2).setHorizontalAlignment('right');
        dash.getRange(r, 3).setFontColor(DB.FG_POS).setFontWeight('bold');
      }
      if (b) {
        dash.getRange(r, 5, 1, 4)
          .setValues([[b[2], String(b[0]).slice(0, 10), _dbPnl(Number(b[12])), _dbRate(Number(b[13]))]])
          .setBackground('#e8f0fe');
        dash.getRange(r, 7, 1, 2).setHorizontalAlignment('right');
        dash.getRange(r, 7).setFontColor(DB.FG_NEG).setFontWeight('bold');
      }
      r++;
    }
  }

  dash.setFrozenRows(1);
  ss.toast('대시보드 갱신 완료', '📊', 3);
  Logger.log('buildDashboard 완료 — ' + r + '행');
}

// ── 헬퍼 ──────────────────────────────────────────

function _dbSectionTitle(sheet, row, title) {
  sheet.getRange(row, 1, 1, DB.COLS).merge()
    .setValue('▌ ' + title)
    .setFontSize(11).setFontWeight('bold')
    .setBackground(DB.BG_SECTION).setFontColor(DB.FG_SECTION)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(row, 28);
  return row + 1;
}

function _dbHeader(sheet, row, col, labels, bg, fg) {
  bg = bg || DB.BG_HDR; fg = fg || DB.FG_HDR;
  sheet.getRange(row, col, 1, labels.length).setValues([labels])
    .setFontWeight('bold').setBackground(bg).setFontColor(fg)
    .setHorizontalAlignment('center');
}

function _dbColorCell(sheet, row, col, value) {
  const v = Number(value) || 0;
  if (v > 0)      sheet.getRange(row, col).setFontColor(DB.FG_POS);
  else if (v < 0) sheet.getRange(row, col).setFontColor(DB.FG_NEG);
}

function _shortBroker(s) { return String(s || '').slice(0, 2); }
function _shortAcct(s) {
  return String(s || '')
    .replace('퇴직연금_개인IRP(범용)', '퇴직IRP(범용)')
    .replace('퇴직연금_개인IRP', '퇴직IRP');
}
function _dbNum(n)  { return (Number(n) || 0).toLocaleString('ko-KR'); }
function _dbPnl(n)  { const v = Number(n) || 0; return (v >= 0 ? '+' : '') + Math.round(v).toLocaleString('ko-KR'); }
function _dbRate(n) { const v = Number(n) || 0; return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }

// "1년 2개월 3일" 류를 일수로 환산
function _dbParseHoldingDays(s) {
  if (!s) return 0;
  const str = String(s);
  const y = parseInt((str.match(/(\d+)년/)   || [0, 0])[1], 10);
  const m = parseInt((str.match(/(\d+)개월/) || [0, 0])[1], 10);
  const d = parseInt((str.match(/(\d+)일/)   || [0, 0])[1], 10);
  return y * 365 + m * 30 + d;
}

// onEdit 트리거 — 정렬 드롭다운 감지 (Main.js onEdit에서 호출)
function _handleDashSortChange(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== DB.SHEET) return;
  const val = e.value;
  if (val === undefined || val === null) return;
  let changed = false;
  if (Object.prototype.hasOwnProperty.call(DB_POS_SORT_OPTS, val)) {
    PropertiesService.getScriptProperties().setProperty(DB.PROP_SORT_KEY, val);
    changed = true;
  } else if (val === '↑' || val === '↓') {
    PropertiesService.getScriptProperties().setProperty(DB.PROP_SORT_DIR, val);
    changed = true;
  }
  if (changed) {
    try { buildDashboard(); } catch (err) { Logger.log('정렬 후 buildDashboard 실패: ' + err); }
  }
}

// ── 오늘의 수익 ──────────────────────────────────
function _calcTodayProfit(priceHistSheet, posRows) {
  if (!priceHistSheet || priceHistSheet.getLastRow() < 3) return null;
  const lastRow = priceHistSheet.getLastRow();
  const lastCol = priceHistSheet.getLastColumn();
  if (lastCol < 2) return null;

  const today    = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const dataRows = lastRow - 1;
  const dates    = priceHistSheet.getRange(2, 1, dataRows, 1).getValues();

  let todayRowIdx = -1, prevRowIdx = -1;
  for (let i = 0; i < dataRows; i++) {
    const raw = dates[i][0];
    const d   = raw instanceof Date
      ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(raw).slice(0, 10);
    if (d === today)                       todayRowIdx = i;
    else if (d < today && d.length === 10) prevRowIdx  = i;
  }
  if (todayRowIdx === -1 || prevRowIdx === -1) return null;

  const colCount   = lastCol - 1;
  const codes      = priceHistSheet.getRange(1, 2, 1, colCount).getValues()[0];
  const curPrices  = priceHistSheet.getRange(todayRowIdx + 2, 2, 1, colCount).getValues()[0];
  const prevPrices = priceHistSheet.getRange(prevRowIdx  + 2, 2, 1, colCount).getValues()[0];

  const diffMap = {};
  codes.forEach((code, i) => {
    if (!code) return;
    const p = Number(prevPrices[i]) || 0;
    const c = Number(curPrices[i])  || 0;
    if (p > 0 && c > 0) diffMap[_normCode(String(code))] = c - p;
  });

  let total = 0;
  posRows.forEach(row => {
    const code = _normCode(String(row[0]));
    const qty  = Number(row[6]) || 0;
    const diff = diffMap[code];
    if (diff !== undefined) total += diff * qty;
  });
  return Math.round(total);
}

// ── 종목별 확장 컬럼 계산 ─────────────────────────
// 당일 등락액/율/손익 + 1주일/1달 손익(평가금액 차이) + 1M/3M/6M/1Y % 수익률
function _calcExtraColumns(priceHistSheet, posRows, ledgerSheet) {
  const result = new Map();
  if (!priceHistSheet || priceHistSheet.getLastRow() < 3) return result;

  const lastRow = priceHistSheet.getLastRow();
  const lastCol = priceHistSheet.getLastColumn();
  if (lastCol < 2) return result;

  const rawDates = priceHistSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const dates = rawDates.map(r => {
    const raw = r[0];
    return raw instanceof Date
      ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(raw).slice(0, 10);
  });
  const codes  = priceHistSheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];
  const prices = priceHistSheet.getRange(2, 2, lastRow - 1, lastCol - 1).getValues();

  const codeColMap = {};
  codes.forEach((c, i) => { if (c) codeColMap[_normCode(String(c))] = i; });

  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  let todayIdx = -1, prevIdx = -1;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] === today) todayIdx = i;
    else if (dates[i] < today && dates[i].length === 10) prevIdx = i;
  }
  if (todayIdx === -1 || prevIdx === -1) return result;

  const findNDaysAgo = (n) => {
    const targetMs = new Date(today).getTime() - n * 86400000;
    let best = -1;
    for (let i = 0; i < dates.length; i++) {
      if (dates[i].length !== 10) continue;
      const ms = new Date(dates[i]).getTime();
      if (ms <= targetMs && (best === -1 || ms > new Date(dates[best]).getTime())) {
        best = i;
      }
    }
    return best;
  };
  const w1Idx = findNDaysAgo(7);
  const m1Idx = findNDaysAgo(30);
  const m3Idx = findNDaysAgo(90);
  const m6Idx = findNDaysAgo(180);
  const y1Idx = findNDaysAgo(365);

  // 원장 → 종목별 매수/매도 시계열
  const txByCode = {};
  if (ledgerSheet && ledgerSheet.getLastRow() >= 2) {
    const lRows = ledgerSheet.getRange(2, 1, ledgerSheet.getLastRow() - 1, 8).getValues();
    lRows.forEach(r => {
      const dRaw = r[0];
      const d = dRaw instanceof Date
        ? Utilities.formatDate(dRaw, 'Asia/Seoul', 'yyyy-MM-dd')
        : String(dRaw).slice(0, 10);
      const type = String(r[1] || '').trim();
      const code = _normCode(String(r[2] || ''));
      const qty  = Number(r[7]) || 0;
      if (!code || !d || qty === 0) return;
      const sign = type === '매수' ? 1 : type === '매도' ? -1 : 0;
      if (sign === 0) return;
      if (!txByCode[code]) txByCode[code] = [];
      txByCode[code].push({ date: d, qty: qty * sign });
    });
    Object.keys(txByCode).forEach(c =>
      txByCode[c].sort((a, b) => a.date < b.date ? -1 : 1));
  }

  const qtyAtDate = (code, dateStr) => {
    const txs = txByCode[code] || [];
    let q = 0;
    for (const tx of txs) {
      if (tx.date <= dateStr) q += tx.qty;
      else break;
    }
    return q;
  };

  posRows.forEach(row => {
    const code = _normCode(String(row[0]));
    const broker = String(row[3] || '');
    const acct   = String(row[4] || '');
    const key    = code + '||' + broker + '||' + acct;
    const curQty = Number(row[6]) || 0;
    const colIdx = codeColMap[code];
    if (colIdx === undefined) { result.set(key, {}); return; }

    const tPrice = Number(prices[todayIdx][colIdx]) || 0;
    const pPrice = Number(prices[prevIdx][colIdx])  || 0;

    const todayChange    = (tPrice > 0 && pPrice > 0) ? (tPrice - pPrice) : null;
    const todayChangePct = (todayChange !== null && pPrice > 0) ? (todayChange / pPrice * 100) : null;
    const todayPnl       = (todayChange !== null) ? todayChange * curQty : null;

    const pnlAt = (idx) => {
      if (idx === -1 || tPrice <= 0) return null;
      const pastPrice = Number(prices[idx][colIdx]) || 0;
      if (pastPrice <= 0) return null;
      // 기간 내 수량 변화 있는 종목은 "가격 변동만"의 의미가 무너지므로 비교 불가
      if (qtyAtDate(code, dates[idx]) !== curQty) return null;
      return (tPrice - pastPrice) * curQty;
    };
    const pctAt = (idx) => {
      if (idx === -1 || tPrice <= 0) return null;
      const pastPrice = Number(prices[idx][colIdx]) || 0;
      if (pastPrice <= 0) return null;
      return (tPrice - pastPrice) / pastPrice * 100;
    };

    result.set(key, {
      todayChange, todayChangePct, todayPnl,
      w1Pnl: pnlAt(w1Idx),
      m1Pnl: pnlAt(m1Idx),
      m1Pct: pctAt(m1Idx),
      m3Pct: pctAt(m3Idx),
      m6Pct: pctAt(m6Idx),
      y1Pct: pctAt(y1Idx),
    });
  });

  return result;
}

// ── 환율 (*설정* 시트) ──────────────────────────
function _getFxRates(ss) {
  try {
    const sheet = ss.getSheetByName(NS.SETTINGS);
    if (!sheet) return { usd: 0, gbp: 0 };
    return {
      usd: Number(sheet.getRange(2, 2).getValue()) || 0,
      gbp: Number(sheet.getRange(3, 2).getValue()) || 0,
    };
  } catch (e) { return { usd: 0, gbp: 0 }; }
}
