/**
 * Dashboard.js — *대시보드* 시트 생성/갱신 (13컬럼 레이아웃)
 */

const DB = {
  SHEET:       '*대시보드*',
  BG_TITLE:    '#1a1a2e',
  FG_TITLE:    '#ffffff',
  BG_SECTION:  '#2d3561',
  FG_SECTION:  '#ffffff',
  BG_HDR:      '#e8eaf6',
  FG_HDR:      '#1a237e',
  BG_EVEN:     '#f8f9fa',
  BG_ODD:      '#ffffff',
  BG_TOTAL:    '#e3f2fd',
  FG_POS:      '#c62828',
  FG_NEG:      '#1565c0',
  BG_CARD_POS: '#fde8e8',
  BG_CARD_NEG: '#e8f0fe',
  BG_CARD_NEU: '#f3f4f6',
  COLS:        14,
  // 보유 종목 정렬 (PropertiesService 키)
  PROP_SORT_KEY: 'DASH_POS_SORT_KEY',
  PROP_SORT_DIR: 'DASH_POS_SORT_DIR',
};

// 보유 종목 정렬 옵션 (드롭다운 표시값 → 정렬 인덱스/타입)
// SORT_OPTS[label] = { idx: posRow의 인덱스, type: 'num'|'str'|'rate'|'date' }
const DB_POS_SORT_OPTS = {
  '기본 (계좌순)': null,
  '종목명':   { col: 1,  type: 'str'  },
  '분류':     { col: 2,  type: 'str'  },
  '계좌':     { col: 4,  type: 'str'  },
  '수량':     { col: 6,  type: 'num'  },
  '평균단가': { col: 7,  type: 'num'  },
  '현재단가': { col: 9,  type: 'num'  },
  '매입금액': { col: 8,  type: 'num'  },
  '손익':     { col: 11, type: 'num'  },
  '수익률':   { col: 12, type: 'num'  },
  '보유기간': { col: 5,  type: 'date' },
  '1M':       { col: 17, type: 'rate' },
  '3M':       { col: 18, type: 'rate' },
  '6M':       { col: 19, type: 'rate' },
  '1Y':       { col: 20, type: 'rate' },
};

function buildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const posSheet       = ss.getSheetByName(NS.POSITION);
  const pnlSheet       = ss.getSheetByName(NS.REALIZED_PNL);
  const priceHistSheet = ss.getSheetByName(NS.PRICE_HISTORY);

  if (!posSheet) {
    ss.toast('*보유현황* 없음 — updatePositionFromLedger 먼저 실행', '⚠️', 4);
    return;
  }

  // ── 데이터 읽기 (*보유현황* 23컬럼) ──
  const posRows = posSheet.getLastRow() >= 2
    ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 21).getValues()
        .filter(r => String(r[0]) !== '합계' && Number(r[6]) > 0)
    : [];

  // *종목상태* 에서 1M/3M/6M/1Y 직접 가져옴 — *보유현황* 갱신 안 해도 항상 최신값 표시
  const statusMap = _getStockStatusMap(ss);

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

  // ── 오늘의 수익 ──
  const todayProfit = _calcTodayProfit(priceHistSheet, posRows);

  // ── 환율 ──
  const fx = _getFxRates(ss);

  // ── 히스토리 갱신 시간 ──
  const histUpdatedAt = _getHistoryUpdatedAt(ss);

  // ── 시트 준비 ──
  let dash = ss.getSheetByName(DB.SHEET);
  if (!dash) dash = ss.insertSheet(DB.SHEET);
  dash.clearContents();
  dash.clearFormats();
  // 이전 빌드의 데이터 유효성 검사(드롭다운) 잔존 제거 — 새로 그릴 자리에 옛 검증이 남으면 위반 에러
  dash.getRange(1, 1, dash.getMaxRows(), dash.getMaxColumns()).clearDataValidations();
  [155, 85, 110, 65, 90, 90, 100, 90, 75, 75, 68, 68, 68, 68]
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

  // 기준시각 + 히스토리 갱신 시각
  dash.getRange(r, 1, 1, 8).merge()
    .setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm 기준'))
    .setFontSize(10).setFontColor('#888888')
    .setHorizontalAlignment('left').setBackground('#f8f9fa');
  dash.getRange(r, 9, 1, DB.COLS - 8).merge()
    .setValue(histUpdatedAt ? '1M~1Y 갱신: ' + histUpdatedAt.slice(0, 16) : '1M~1Y 미갱신')
    .setFontSize(10).setFontColor(histUpdatedAt ? '#1565c0' : '#999999')
    .setHorizontalAlignment('right').setBackground('#f8f9fa');
  r += 2;

  // ══════════════════════════════════
  // [2] 요약 카드
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '요약');

  const todayBg  = todayProfit === null ? DB.BG_CARD_NEU
                 : todayProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG;
  const todayVal = todayProfit === null ? '─'
                 : (todayProfit >= 0 ? '+' : '') + Math.round(todayProfit).toLocaleString('ko-KR');
  const fxVal    = (fx.usd > 0 || fx.gbp > 0)
    ? 'USD ₩' + Math.round(fx.usd).toLocaleString('ko-KR') + '\nGBP ₩' + Math.round(fx.gbp).toLocaleString('ko-KR')
    : '갱신 필요';

  // 카드: 4열 × 3컬럼씩 = 12컬럼 + 나머지 1컬럼
  const cardCols = [1, 4, 7, 10]; // 각 카드 시작 컬럼
  const cardSpan = 3;
  const cardMatrix = [
    [
      { label: '총 매입금액',  val: _dbNum(totalBuy),    sub: '',                bg: DB.BG_CARD_NEU, signed: false },
      { label: '총 평가금액',  val: _dbNum(totalCur),    sub: '',                bg: DB.BG_CARD_NEU, signed: false },
      { label: '총 수익',      val: _dbPnl(totalProfit), sub: '',                bg: totalProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
      { label: '오늘의 수익',  val: todayVal,            sub: '',                bg: todayBg, signed: todayProfit !== null },
    ],
    [
      { label: 'USD / GBP',   val: fxVal,               sub: '',                bg: DB.BG_CARD_NEU, signed: false },
      { label: '승률',         val: _dbRate(winRate),    sub: winCount + '/' + pnlRows.length + '건', bg: DB.BG_CARD_NEU, signed: false },
      { label: '확정 수익',    val: _dbPnl(cfProfit),    sub: pnlRows.length + '건 매도', bg: cfProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
      { label: '운용 손익',    val: _dbPnl(opProfit),    sub: _dbRate(opRate),   bg: opProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
    ],
  ];

  for (const rowCards of cardMatrix) {
    for (let j = 0; j < 4; j++) {
      const c = rowCards[j];
      dash.getRange(r, cardCols[j], 1, cardSpan).merge()
        .setValue(c.label).setFontWeight('bold').setFontSize(10)
        .setBackground(c.bg).setFontColor('#555555')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
    }
    r++;
    for (let j = 0; j < 4; j++) {
      const c = rowCards[j];
      const isNeg = c.signed && String(c.val).startsWith('-');
      const fg = c.signed ? (isNeg ? DB.FG_NEG : DB.FG_POS) : '#222222';
      dash.getRange(r, cardCols[j], 1, cardSpan).merge()
        .setValue(c.val + (c.sub ? '\n' + c.sub : ''))
        .setFontSize(12).setFontWeight('bold').setBackground(c.bg).setFontColor(fg)
        .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
      dash.setRowHeight(r, 46);
    }
    r++;
  }
  r++;

  // ══════════════════════════════════
  // [3] 계좌별 현황
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
  // [4] 분류별 현황
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
      const c   = catMap[cat];
      const pnl  = c.cur - c.buy;
      const rate = c.buy > 0 ? pnl / c.buy * 100 : 0;
      const wt   = totalCur > 0 ? c.cur / totalCur * 100 : 0;
      dash.getRange(r, 1, 1, 7).setValues([[cat, c.cnt,
        _dbNum(c.buy), _dbNum(c.cur), _dbPnl(pnl), _dbRate(rate), _dbRate(wt)]]);
      dash.getRange(r, 1, 1, 7).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      dash.getRange(r, 1, 1, 1).setHorizontalAlignment('center');
      dash.getRange(r, 2, 1, 6).setHorizontalAlignment('right');
      _dbColorCell(dash, r, 5, pnl); _dbColorCell(dash, r, 6, rate);
      r++;
    });

  dash.getRange(r, 1, 1, 7)
    .setValues([['합계', posRows.length, _dbNum(totalBuy), _dbNum(totalCur),
      _dbPnl(opProfit), _dbRate(opRate), '100%']])
    .setFontWeight('bold').setBackground(DB.BG_TOTAL);
  dash.getRange(r, 1, 1, 1).setHorizontalAlignment('center');
  dash.getRange(r, 2, 1, 6).setHorizontalAlignment('right');
  _dbColorCell(dash, r, 5, opProfit); _dbColorCell(dash, r, 6, opRate);
  r += 2;

  // ══════════════════════════════════
  // [5] 보유 종목 현황 — 14컬럼 + 정렬 컨트롤
  // ══════════════════════════════════
  const sortKey = PropertiesService.getScriptProperties().getProperty(DB.PROP_SORT_KEY) || '기본 (계좌순)';
  const sortDir = PropertiesService.getScriptProperties().getProperty(DB.PROP_SORT_DIR) || '↓';
  r = _dbSectionTitle(dash, r, '보유 종목 현황 (' + sortKey + (sortKey === '기본 (계좌순)' ? '' : ' ' + sortDir) + ')');

  // 정렬 컨트롤 행 (헤더 바로 위)
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

  _dbHeader(dash, r, 1, ['종목명', '분류', '증권사 / 계좌', '수량', '평균단가', '현재단가', '매입금액', '손익', '수익률', '보유기간', '1M', '3M', '6M', '1Y']);
  r++;

  const POS_ORDER = {
    '미래에셋투자증권|종합_랩': 0, '미래에셋투자증권|퇴직연금_개인IRP': 1,
    '삼성증권|종합': 2, '삼성증권|ISA': 3, '삼성증권|퇴직연금_개인IRP(범용)': 4,
  };

  const sortOpt = DB_POS_SORT_OPTS[sortKey];
  const sortMul = sortDir === '↑' ? 1 : -1;

  const sortedPos = [...posRows].sort((a, b) => {
    if (!sortOpt) {
      // 기본: 계좌순 → 종목명순
      const ka = POS_ORDER[String(a[3]) + '|' + String(a[4])] ?? 99;
      const kb = POS_ORDER[String(b[3]) + '|' + String(b[4])] ?? 99;
      return ka !== kb ? ka - kb : String(a[1]).localeCompare(String(b[1]));
    }
    const va = a[sortOpt.col];
    const vb = b[sortOpt.col];
    if (sortOpt.type === 'str') {
      return sortMul * String(va || '').localeCompare(String(vb || ''));
    } else if (sortOpt.type === 'rate') {
      return sortMul * (parseFloat(String(va).replace('%','')) - parseFloat(String(vb).replace('%','')));
    } else if (sortOpt.type === 'date') {
      // 보유기간 문자열 "X년 Y개월 Z일" → 일수 환산
      return sortMul * (_dbParseHoldingDays(va) - _dbParseHoldingDays(vb));
    } else {
      return sortMul * ((Number(va) || 0) - (Number(vb) || 0));
    }
  });

  sortedPos.forEach((row, i) => {
      const pnl  = Number(row[11]) || 0;
      const rate = Number(row[12]) || 0;
      const buy  = Number(row[8])  || 0;  // 매입금액
      // 1M/3M/6M/1Y 는 *종목상태* 에서 직접 — *보유현황* 갱신 안 됐어도 즉시 반영
      const s    = statusMap[_normCode(row[0])] || {};
      const m1   = s.m1  || row[17] || '-';
      const m3   = s.m3  || row[18] || '-';
      const m6   = s.m6  || row[19] || '-';
      const m1y  = s.m1y || row[20] || '-';
      dash.getRange(r, 1, 1, DB.COLS).setValues([[
        row[1], row[2], _shortBroker(row[3]) + ' / ' + _shortAcct(row[4]),
        _dbNum(row[6]), _dbNum(row[7]), _dbNum(row[9]),
        _dbNum(buy),
        _dbPnl(pnl), _dbRate(rate), row[5],
        _fmtRateStr(m1), _fmtRateStr(m3), _fmtRateStr(m6), _fmtRateStr(m1y)
      ]]);
      dash.getRange(r, 1, 1, DB.COLS).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      dash.getRange(r, 1, 1, 3).setHorizontalAlignment('center');  // 종목명·분류·증권사
      dash.getRange(r, 4, 1, 6).setHorizontalAlignment('right');   // 수량~수익률 (수량/평단/현재/매입/손익/수익률)
      dash.getRange(r, 10, 1, 1).setHorizontalAlignment('center'); // 보유기간
      dash.getRange(r, 11, 1, 4).setHorizontalAlignment('right');  // 1M~1Y
      _dbColorCell(dash, r, 8, pnl);
      _dbColorCell(dash, r, 9, rate);
      _dbColorRateStr(dash, r, 11, m1);
      _dbColorRateStr(dash, r, 12, m3);
      _dbColorRateStr(dash, r, 13, m6);
      _dbColorRateStr(dash, r, 14, m1y);
      r++;
    });
  r++;

  // ══════════════════════════════════
  // [6] 확정 수익 월별 요약
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
      _dbColorCell(dash, r, 5, d.pnl);
      r++;
    });

    dash.getRange(r, 1, 1, 6)
      .setValues([['합계', pnlRows.length, winCount, pnlRows.length - winCount,
        _dbPnl(cfProfit), _dbRate(winRate)]])
      .setFontWeight('bold').setBackground(DB.BG_TOTAL);
    _dbColorCell(dash, r, 5, cfProfit);
    r += 2;

    // ── Top 5 / Bottom 5 ──
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
        dash.getRange(r, 3).setFontColor(DB.FG_POS).setFontWeight('bold');
      }
      if (b) {
        dash.getRange(r, 5, 1, 4)
          .setValues([[b[2], String(b[0]).slice(0, 10), _dbPnl(Number(b[12])), _dbRate(Number(b[13]))]])
          .setBackground('#e8f0fe');
        dash.getRange(r, 7).setFontColor(DB.FG_NEG).setFontWeight('bold');
      }
      r++;
    }
  }

  dash.setFrozenRows(1);
  // setActiveSheet 제거 — 업데이트 중 시트 자동 이동 방지
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

// "1.23%" 또는 "-0.45%" 문자열을 파싱해 색상 적용
function _dbColorRateStr(sheet, row, col, val) {
  const s = String(val || '').replace('%', '');
  const v = parseFloat(s);
  if (!isNaN(v)) {
    if (v > 0)      sheet.getRange(row, col).setFontColor(DB.FG_POS);
    else if (v < 0) sheet.getRange(row, col).setFontColor(DB.FG_NEG);
  }
}

function _shortBroker(s) { return String(s || '').slice(0, 2); }
function _shortAcct(s) {
  return String(s || '')
    .replace('퇴직연금_개인IRP(범용)', '퇴직IRP(범용)')
    .replace('퇴직연금_개인IRP', '퇴직IRP');
}
function _dbNum(n)  { return (Number(n) || 0).toLocaleString('ko-KR'); }
function _dbPnl(n)  { const v = Number(n) || 0; return (v >= 0 ? '+' : '') + v.toLocaleString('ko-KR'); }
function _dbRate(n) { const v = Number(n) || 0; return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
function _fmtRateStr(val) {
  if (!val || val === '-') return '-';
  const v = parseFloat(String(val));
  if (isNaN(v)) return String(val);
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}

// "1년 2개월 3일" / "2개월 5일" / "12일" 문자열을 일수로 환산
function _dbParseHoldingDays(s) {
  if (!s) return 0;
  const str = String(s);
  const y = parseInt((str.match(/(\d+)년/) || [0, 0])[1], 10);
  const m = parseInt((str.match(/(\d+)개월/) || [0, 0])[1], 10);
  const d = parseInt((str.match(/(\d+)일/) || [0, 0])[1], 10);
  return y * 365 + m * 30 + d;
}

// onEdit 트리거: 대시보드 정렬 드롭다운 변경 감지 → PropertiesService 저장 + 재정렬
function _handleDashSortChange(e) {
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
    if (d === today)             todayRowIdx = i;
    else if (d < today && d.length === 10) prevRowIdx = i;
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

// ── 히스토리 갱신 시간 (*종목상태* M1) ──────────
function _getHistoryUpdatedAt(ss) {
  try {
    const sheet = ss.getSheetByName(NS.STOCK_STATUS);
    if (!sheet) return null;
    const val = sheet.getRange(1, 13).getValue();
    return val ? String(val).slice(0, 19) : null;
  } catch (e) { return null; }
}
