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
  const posSheet       = ss.getSheetByName(NS.POSITION);
  const pnlSheet       = ss.getSheetByName(NS.REALIZED_PNL);
  const priceHistSheet = ss.getSheetByName(NS.PRICE_HISTORY);

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
  const totalBuy    = posRows.reduce((s, r) => s + (Number(r[8]) || 0), 0);
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

  // ── 시트 준비 ──
  let dash = ss.getSheetByName(DB.SHEET);
  if (!dash) dash = ss.insertSheet(DB.SHEET);
  dash.clearContents();
  dash.clearFormats();
  [160, 110, 110, 110, 110, 110, 110, 110, 90]
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
  // [2] 요약 카드 (2행 × 4열)
  // ══════════════════════════════════
  r = _dbSectionTitle(dash, r, '요약', 8);

  const todayBg  = todayProfit === null ? DB.BG_CARD_NEU
                 : todayProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG;
  const todayVal = todayProfit === null ? '─'
                 : (todayProfit >= 0 ? '+' : '') + Math.round(todayProfit).toLocaleString('ko-KR');
  const fxVal    = (fx.usd > 0 || fx.gbp > 0)
    ? 'USD ₩' + Math.round(fx.usd).toLocaleString('ko-KR') + '\nGBP ₩' + Math.round(fx.gbp).toLocaleString('ko-KR')
    : '갱신 필요';

  const cardMatrix = [
    // ── 1행: 핵심 수치 ──
    [
      { label: '총 매입금액',    val: _dbNum(totalBuy),    sub: '',                               bg: DB.BG_CARD_NEU, signed: false },
      { label: '총 평가금액',    val: _dbNum(totalCur),    sub: '',                               bg: DB.BG_CARD_NEU, signed: false },
      { label: '총 수익',        val: _dbPnl(totalProfit), sub: '',                               bg: totalProfit >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
      { label: '오늘의 수익',    val: todayVal,            sub: '',                               bg: todayBg, signed: todayProfit !== null },
    ],
    // ── 2행: 세부 지표 ──
    [
      { label: 'USD / GBP',     val: fxVal,               sub: '',                               bg: DB.BG_CARD_NEU, signed: false },
      { label: '승률',           val: _dbRate(winRate),    sub: winCount + '/' + pnlRows.length + '건', bg: DB.BG_CARD_NEU, signed: false },
      { label: '확정 수익',      val: _dbPnl(cfProfit),    sub: pnlRows.length + '건 매도',       bg: cfProfit  >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
      { label: '운용 손익',      val: _dbPnl(opProfit),    sub: _dbRate(opRate),                  bg: opProfit  >= 0 ? DB.BG_CARD_POS : DB.BG_CARD_NEG, signed: true },
    ],
  ];

  for (const rowCards of cardMatrix) {
    // 라벨 행
    for (let j = 0; j < 4; j++) {
      const c = rowCards[j];
      dash.getRange(r, j * 2 + 1, 1, 2).merge()
        .setValue(c.label).setFontWeight('bold').setFontSize(10)
        .setBackground(c.bg).setFontColor('#555555')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
    }
    r++;
    // 값 행
    for (let j = 0; j < 4; j++) {
      const c = rowCards[j];
      const isNeg = c.signed && String(c.val).startsWith('-');
      const fg = c.signed ? (isNeg ? DB.FG_NEG : DB.FG_POS) : '#222222';
      dash.getRange(r, j * 2 + 1, 1, 2).merge()
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
  r = _dbSectionTitle(dash, r, '계좌별 현황', 8);
  _dbHeader(dash, r, 1, ['증권사', '계좌', '종목수', '매입금액', '평가금액', '손익', '수익률', '비중']);
  r++;

  const acctMap = {};
  posRows.forEach(row => {
    const key = row[3] + '||' + row[4];
    if (!acctMap[key]) acctMap[key] = { broker: String(row[3]), acct: String(row[4]), cnt: 0, buy: 0, cur: 0 };
    acctMap[key].cnt++;
    acctMap[key].buy += Number(row[8]) || 0;
    acctMap[key].cur += Number(row[10]) || 0;
  });

  Object.values(acctMap)
    .sort((a, b) => a.broker.localeCompare(b.broker) || a.acct.localeCompare(b.acct))
    .forEach((a, i) => {
      const pnl = a.cur - a.buy;
      const rate = a.buy > 0 ? pnl / a.buy * 100 : 0;
      const wt   = totalCur > 0 ? a.cur / totalCur * 100 : 0;
      dash.getRange(r, 1, 1, 8).setValues([[_shortBroker(a.broker), a.acct, a.cnt,
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
    catMap[cat].buy += Number(row[8]) || 0;
    catMap[cat].cur += Number(row[10]) || 0;
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
  r = _dbSectionTitle(dash, r, '보유 종목 현황 (수익률 순)', 9);
  _dbHeader(dash, r, 1, ['종목명', '분류', '증권사 / 계좌', '수량', '평균단가', '현재단가', '손익', '수익률', '보유기간']);
  r++;

  [...posRows]
    .sort((a, b) => (Number(b[12]) || 0) - (Number(a[12]) || 0))
    .forEach((row, i) => {
      const pnl  = Number(row[11]) || 0;
      const rate = Number(row[12]) || 0;
      dash.getRange(r, 1, 1, 9).setValues([[
        row[1], row[2], _shortBroker(row[3]) + ' / ' + row[4],
        _dbNum(row[6]), _dbNum(row[7]), _dbNum(row[9]),
        _dbPnl(pnl), _dbRate(rate), row[5]
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

function _shortBroker(s) { return String(s || '').slice(0, 2); }
function _dbNum(n)  { return (Number(n) || 0).toLocaleString('ko-KR'); }
function _dbPnl(n)  { const v = Number(n) || 0; return (v >= 0 ? '+' : '') + v.toLocaleString('ko-KR'); }
function _dbRate(n) { const v = Number(n) || 0; return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'; }

// ── 오늘의 수익 계산 ──────────────────────────────────
// 날짜 기준으로 오늘 최신 행 vs 전일 최신 행 비교 × 보유수량 합산
// 오늘 or 전일 데이터 없으면 null 반환
function _calcTodayProfit(priceHistSheet, posRows) {
  if (!priceHistSheet || priceHistSheet.getLastRow() < 3) return null;
  const lastRow = priceHistSheet.getLastRow();
  const lastCol = priceHistSheet.getLastColumn();
  if (lastCol < 2) return null;

  const today    = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const dataRows = lastRow - 1;
  const dates    = priceHistSheet.getRange(2, 1, dataRows, 1).getValues();

  let todayRowIdx = -1;  // 오늘 날짜 행 중 마지막 (sheet row = idx+2)
  let prevRowIdx  = -1;  // 오늘 이전 날짜 행 중 마지막

  for (let i = 0; i < dataRows; i++) {
    const raw = dates[i][0];
    const d   = raw instanceof Date
      ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(raw).slice(0, 10);
    if (d === today)  todayRowIdx = i;
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

// ── 환율 읽기 (투자수익 트래커 Named Range) ──────────
function _getFxRates(ss) {
  try {
    const usd = Number(getNamedRange(ss, CONFIG.NAMED_RANGES.FX_USD).getValue()) || 0;
    const gbp = Number(getNamedRange(ss, CONFIG.NAMED_RANGES.FX_GBP).getValue()) || 0;
    return { usd, gbp };
  } catch (e) {
    return { usd: 0, gbp: 0 };
  }
}
