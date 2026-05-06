/**
 * Dashboard.js — *대시보드* 시트 생성/갱신
 * updatePositionFromLedger() 완료 후 자동 호출, 또는 수동 실행
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
  FG_POS:      '#1565c0',
  FG_NEG:      '#c62828',
  BG_CARD_POS: '#e8f5e9',
  BG_CARD_NEG: '#fce4ec',
  BG_CARD_NEU: '#f3f4f6',
};

function buildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const posSheet = ss.getSheetByName(NS.POSITION);
  const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);

  if (!posSheet) {
    ss.toast('*포지션* 없음 — updatePositionFromLedger 먼저 실행', '⚠️', 4);
    return;
  }

  // ── 데이터 읽기 ──
  const posRows = posSheet.getLastRow() >= 2
    ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 12).getValues()
        .filter(r => String(r[0]) !== '합계' && Number(r[5]) > 0)
    : [];

  const pnlRows = (pnlSheet && pnlSheet.getLastRow() >= 2)
    ? pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
        .filter(r => r[0] && String(r[0]) !== '합계')
    : [];

  // ── 요약 지표 ──
  const totalBuy    = posRows.reduce((s, r) => s + (Number(r[7]) || 0), 0);
  const totalCur    = posRows.reduce((s, r) => s + (Number(r[9]) || 0), 0);
  const opProfit    = totalCur - totalBuy;
  const opRate      = totalBuy > 0 ? opProfit / totalBuy * 100 : 0;
  const cfProfit    = pnlRows.reduce((s, r) => s + (Number(r[12]) || 0), 0);
  const totalProfit = opProfit + cfProfit;
  const winCount    = pnlRows.filter(r => Number(r[12]) > 0).length;
  const winRate     = pnlRows.length > 0 ? winCount / pnlRows.length * 100 : 0;

  // ── 시트 준비 ──
  let dash = ss.getSheetByName(DB.SHEET);
  if (!dash) dash = ss.insertSheet(DB.SHEET);
  dash.clearContents();
  dash.clearFormats();
  [160, 110, 110, 110, 110, 110, 110, 110]
    .forEach((w, i) => dash.setColumnWidth(i + 1, w));

  let r = 1;

  // ══════════════════════════════════
  // [1] 타이틀
  // ══════════════════════════════════
  dash.getRange(r, 1, 1, 8).merge()
    .setValue('📊 포트폴리오 대시보드')
    .setFontSize(16).setFontWeight('bold')
    .setBackground(DB.BG_TITLE).setFontColor(DB.FG_TITLE)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(r, 44);
  r++;

  dash.getRange(r, 1, 1, 8).merge()
    .setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm 기준'))
    .setFontSize(10).setFontColor('#888888')
    .setHorizontalAlignment('right').setBackground('#f8f9fa');
  r += 2;

  // ══════════════════════════════════
  // [2] 요약 카드 (2행 × 3열)
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '요약', 8);

  const cards = [
    { label: '총 매입금액',  val: _dbNum(totalBuy),     sub: '',                              bg: DB.BG_CARD_NEU, signed: false },
    { label: '총 평가금액',  val: _dbNum(totalCur),     sub: '',                              bg: DB.BG_CARD_NEU, signed: false },
    { label: '운용 손익',    val: _dbPnl(opProfit),     sub: _dbRate(opRate),                 bg: opProfit  >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
    { label: '확정 수익',    val: _dbPnl(cfProfit),     sub: pnlRows.length + '건 매도',      bg: cfProfit  >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
    { label: '총 수익',      val: _dbPnl(totalProfit),  sub: '',                              bg: totalProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
    { label: '승률',         val: _dbRate(winRate),     sub: winCount + '/' + pnlRows.length + '건', bg: DB.BG_CARD_NEU, signed: false },
  ];

  for (let ci = 0; ci < 6; ci += 3) {
    for (let j = 0; j < 3; j++) {
      const c = cards[ci + j];
      dash.getRange(r, j * 2 + 1, 1, 2).merge()
        .setValue(c.label).setFontWeight('bold').setFontSize(10)
        .setBackground(c.bg).setFontColor('#555555')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
    }
    r++;
    for (let j = 0; j < 3; j++) {
      const c = cards[ci + j];
      const isNeg = c.signed && String(c.val).startsWith('-');
      const fg = c.signed ? (isNeg ? DB.FG_NEG : DB.FG_POS) : '#222222';
      dash.getRange(r, j * 2 + 1, 1, 2).merge()
        .setValue(c.val + (c.sub ? '\n' + c.sub : ''))
        .setFontSize(13).setFontWeight('bold').setBackground(c.bg).setFontColor(fg)
        .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
      dash.setRowHeight(r, 42);
    }
    r++;
  }
  r++;

  // ══════════════════════════════════
  // [3] 계좌별 현황
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '계좌별 현황', 8);
  _dbHeader(dash, r, 1, ['증권사', '계좌', '종목수', '매입금액', '평가금액', '손익', '수익률', '비중']);
  r++;

  const acctMap = {};
  posRows.forEach(row => {
    const key = row[3] + '||' + row[4];
    if (!acctMap[key]) acctMap[key] = { broker: String(row[3]), acct: String(row[4]), cnt: 0, buy: 0, cur: 0 };
    acctMap[key].cnt++;
    acctMap[key].buy += Number(row[7]) || 0;
    acctMap[key].cur += Number(row[9]) || 0;
  });

  Object.values(acctMap)
    .sort((a, b) => a.broker.localeCompare(b.broker) || a.acct.localeCompare(b.acct))
    .forEach((a, i) => {
      const pnl = a.cur - a.buy;
      const rate = a.buy > 0 ? pnl / a.buy * 100 : 0;
      const wt   = totalCur > 0 ? a.cur / totalCur * 100 : 0;
      dash.getRange(r, 1, 1, 8).setValues([[a.broker, a.acct, a.cnt,
        _dbNum(a.buy), _dbNum(a.cur), _dbPnl(pnl), _dbRate(rate), _dbRate(wt)]]);
      dash.getRange(r, 1, 1, 8).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      _dbColorCell(dash, r, 6, pnl); _dbColorCell(dash, r, 7, rate);
      r++;
    });

  dash.getRange(r, 1, 1, 8)
    .setValues([['합계', '', posRows.length, _dbNum(totalBuy), _dbNum(totalCur),
      _dbPnl(opProfit), _dbRate(opRate), '100%']])
    .setFontWeight('bold').setBackground(DB.BG_TOTAL);
  _dbColorCell(dash, r, 6, opProfit); _dbColorCell(dash, r, 7, opRate);
  r += 2;

  // ══════════════════════════════════
  // [4] 분류별 현황
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '분류별 현황', 7);
  _dbHeader(dash, r, 1, ['분류', '종목수', '매입금액', '평가금액', '손익', '수익률', '비중']);
  r++;

  const catMap = {};
  posRows.forEach(row => {
    const cat = String(row[2]) || '기타';
    if (!catMap[cat]) catMap[cat] = { cnt: 0, buy: 0, cur: 0 };
    catMap[cat].cnt++;
    catMap[cat].buy += Number(row[7]) || 0;
    catMap[cat].cur += Number(row[9]) || 0;
  });

  ['국내주식','국내ETF','해외주식','해외ETF','펀드','예금','보험','기타']
    .filter(c => catMap[c])
    .forEach((cat, i) => {
      const c = catMap[cat];
      const pnl = c.cur - c.buy;
      const rate = c.buy > 0 ? pnl / c.buy * 100 : 0;
      const wt   = totalCur > 0 ? c.cur / totalCur * 100 : 0;
      dash.getRange(r, 1, 1, 7).setValues([[cat, c.cnt,
        _dbNum(c.buy), _dbNum(c.cur), _dbPnl(pnl), _dbRate(rate), _dbRate(wt)]]);
      dash.getRange(r, 1, 1, 7).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      _dbColorCell(dash, r, 5, pnl); _dbColorCell(dash, r, 6, rate);
      r++;
    });

  dash.getRange(r, 1, 1, 7)
    .setValues([['합계', posRows.length, _dbNum(totalBuy), _dbNum(totalCur),
      _dbPnl(opProfit), _dbRate(opRate), '100%']])
    .setFontWeight('bold').setBackground(DB.BG_TOTAL);
  _dbColorCell(dash, r, 5, opProfit); _dbColorCell(dash, r, 6, opRate);
  r += 2;

  // ══════════════════════════════════
  // [5] 보유 종목 현황 (수익률 순)
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '보유 종목 현황 (수익률 순)', 8);
  _dbHeader(dash, r, 1, ['종목명', '분류', '증권사 / 계좌', '수량', '평균단가', '현재단가', '손익', '수익률']);
  r++;

  [...posRows]
    .sort((a, b) => (Number(b[11]) || 0) - (Number(a[11]) || 0))
    .forEach((row, i) => {
      const pnl  = Number(row[10]) || 0;
      const rate = Number(row[11]) || 0;
      dash.getRange(r, 1, 1, 8).setValues([[
        row[1], row[2], row[3] + ' / ' + row[4],
        _dbNum(row[5]), _dbNum(row[6]), _dbNum(row[8]),
        _dbPnl(pnl), _dbRate(rate)
      ]]);
      dash.getRange(r, 1, 1, 8).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      _dbColorCell(dash, r, 7, pnl); _dbColorCell(dash, r, 8, rate);
      r++;
    });
  r++;

  // ══════════════════════════════════
  // [6] 확정 수익 월별 요약
  // ══════════════════════════════════
  if (pnlRows.length > 0) {
    r = _dbSectionTitle(dash, r, '확정 수익 — 월별', 6);
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
      const d = mMap[m];
      const wr = d.cnt > 0 ? d.win / d.cnt * 100 : 0;
      dash.getRange(r, 1, 1, 6).setValues([[
        m, d.cnt, d.win, d.cnt - d.win, _dbPnl(d.pnl), _dbRate(wr)
      ]]);
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
    r = _dbSectionTitle(dash, r, '수익 Top 5  ·  손실 Top 5', 8);
    _dbHeader(dash, r, 1, ['종목명', '매도일', '실현손익', '수익률'], '#1b5e20', '#ffffff');
    _dbHeader(dash, r, 5, ['종목명', '매도일', '실현손익', '수익률'], '#b71c1c', '#ffffff');
    r++;

    const sorted = [...pnlRows].sort((a, b) => (Number(b[12]) || 0) - (Number(a[12]) || 0));
    const top5   = sorted.slice(0, 5);
    const bot5   = sorted.slice(-5).reverse();

    for (let i = 0; i < 5; i++) {
      const t = top5[i], b = bot5[i];
      if (t) {
        dash.getRange(r, 1, 1, 4)
          .setValues([[t[2], String(t[0]).slice(0, 10), _dbPnl(Number(t[12])), _dbRate(Number(t[13]))]])
          .setBackground('#e8f5e9');
        dash.getRange(r, 3).setFontColor(DB.FG_POS).setFontWeight('bold');
      }
      if (b) {
        dash.getRange(r, 5, 1, 4)
          .setValues([[b[2], String(b[0]).slice(0, 10), _dbPnl(Number(b[12])), _dbRate(Number(b[13]))]])
          .setBackground('#fce4ec');
        dash.getRange(r, 7).setFontColor(DB.FG_NEG).setFontWeight('bold');
      }
      r++;
    }
  }

  dash.setFrozenRows(1);
  ss.setActiveSheet(dash);
  ss.toast('대시보드 갱신 완료', '📊', 3);
  Logger.log('buildDashboard 완료 — ' + r + '행');
}

// ── 헬퍼 ──────────────────────────────────────────

function _dbSectionTitle(sheet, row, title, cols) {
  sheet.getRange(row, 1, 1, cols).merge()
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
  if (v > 0) sheet.getRange(row, col).setFontColor(DB.FG_POS);
  else if (v < 0) sheet.getRange(row, col).setFontColor(DB.FG_NEG);
}

function _dbNum(n)  { return (Number(n) || 0).toLocaleString('ko-KR'); }
function _dbPnl(n)  { const v = Number(n) || 0; return (v >= 0 ? '+' : '') + v.toLocaleString('ko-KR'); }
function _dbRate(n) { const v = Number(n) || 0; return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }
