/**
 * AnalysisDashboard.js — *분석* 시트 생성/갱신
 *
 * 섹션:
 *   [1] 수익률 히트맵   — 종목별 1M/3M/6M/1Y 색상 강도
 *   [2] 투자 매트릭스   — 투자금액 × 수익률 4분면
 *   [3] 계좌별 성과     — 운용·확정·합산 수익률 비교
 *   [4] 분류별 성과     — 자산군별 수익률·비중 비교
 *   [5] 52주 포지션     — 현재가의 52주 밴드 내 위치
 *   [6] 확정 수익 분석  — 연도별 합산 + 월별 최근 12개월
 *   [7] 집중도 분석     — 매입금액 기준 상위 종목 비중
 */

const AN = {
  SHEET: '*분석*',
  COLS:  13,
};

function buildAnalysisDashboard() {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const posSheet = ss.getSheetByName(NS.POSITION);
  const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);

  if (!posSheet) {
    ss.toast('*보유현황* 없음 — updatePositionFromLedger 먼저 실행', '⚠️', 4);
    return;
  }

  // ── 데이터 읽기 ──────────────────────────────────────
  const posRows = posSheet.getLastRow() >= 2
    ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 23).getValues()
        .filter(r => String(r[1]) !== '합계' && String(r[0]) !== '합계' && Number(r[6]) > 0)
    : [];

  // ⚠️ 합계행은 r[0]='합계' / r[2]=''(빈 종목명). r[0] 기준으로 필터해야 합계행 제외됨
  const pnlRows = (pnlSheet && pnlSheet.getLastRow() >= 2)
    ? pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
        .filter(r => r[0] && String(r[0]) !== '합계')
    : [];

  // ── 시트 준비 ─────────────────────────────────────────
  let an = ss.getSheetByName(AN.SHEET);
  if (!an) an = ss.insertSheet(AN.SHEET);
  an.clearContents();
  an.clearFormats();
  [155, 85, 110, 65, 90, 90, 90, 75, 75, 68, 68, 68, 68]
    .forEach((w, i) => an.setColumnWidth(i + 1, w));

  let r = 1;

  // ══════════════════════════════════════════════════════
  // 타이틀
  // ══════════════════════════════════════════════════════
  an.getRange(r, 1, 1, AN.COLS).merge()
    .setValue('🔬 포트폴리오 분석 대시보드')
    .setFontSize(16).setFontWeight('bold')
    .setBackground(DB.BG_TITLE).setFontColor(DB.FG_TITLE)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  an.setRowHeight(r, 44);
  r++;

  an.getRange(r, 1, 1, AN.COLS).merge()
    .setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm 기준'))
    .setFontSize(10).setFontColor('#888888')
    .setHorizontalAlignment('left').setBackground('#f8f9fa');
  r += 2;

  // ══════════════════════════════════════════════════════
  // [1] 수익률 히트맵
  // ══════════════════════════════════════════════════════
  r = _anSectionTitle(an, r, '수익률 히트맵 (보유 종목 — 현재수익률 순)');
  an.getRange(r, 1, 1, AN.COLS).setValues([[
    '종목명', '분류', '계좌', '수익률', '1M', '3M', '6M', '1Y', '매입금액', '', '', '', ''
  ]]).setFontWeight('bold').setBackground(DB.BG_HDR).setFontColor(DB.FG_HDR)
    .setHorizontalAlignment('center');
  r++;

  const sortedByRate = [...posRows].sort((a, b) => (Number(b[12]) || 0) - (Number(a[12]) || 0));

  sortedByRate.forEach((row, i) => {
    const name   = String(row[1]);
    const cat    = String(row[2]);
    const acct   = _shortBroker(row[3]) + '/' + _shortAcct(row[4]);
    const rate   = Number(row[12]) || 0;
    const m1     = _anParseRate(row[17]);
    const m3     = _anParseRate(row[18]);
    const m6     = _anParseRate(row[19]);
    const m1y    = _anParseRate(row[20]);
    const buyAmt = Number(row[8]) || 0;
    const bg     = i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD;

    an.getRange(r, 1, 1, 9).setValues([[
      name, cat, acct,
      _dbRate(rate),
      m1  !== null ? _dbRate(m1)  : '-',
      m3  !== null ? _dbRate(m3)  : '-',
      m6  !== null ? _dbRate(m6)  : '-',
      m1y !== null ? _dbRate(m1y) : '-',
      _dbNum(buyAmt),
    ]]).setBackground(bg);
    an.getRange(r, 1, 1, 3).setHorizontalAlignment('center');
    an.getRange(r, 4, 1, 6).setHorizontalAlignment('right');

    // 수익률 글자색
    _anColorVal(an, r, 4, rate);

    // 히트맵 배경 + 글자색
    if (m1  !== null) _anHeatCell(an, r, 5, m1);
    if (m3  !== null) _anHeatCell(an, r, 6, m3);
    if (m6  !== null) _anHeatCell(an, r, 7, m6);
    if (m1y !== null) _anHeatCell(an, r, 8, m1y);
    r++;
  });

  // 범례
  r++;
  const legend = [
    ['▓ +15% 이상', '#b71c1c', '#ffffff'],
    ['▓ +7~15%',   '#e53935', '#ffffff'],
    ['▓ +3~7%',    '#ef9a9a', '#333333'],
    ['▓ 0~+3%',    '#ffcdd2', '#333333'],
    ['▓ -3~0%',    '#bbdefb', '#333333'],
    ['▓ -7~-3%',   '#42a5f5', '#ffffff'],
    ['▓ -7% 이하', '#1565c0', '#ffffff'],
  ];
  an.getRange(r, 1, 1, AN.COLS).merge()
    .setValue('히트맵 범례:')
    .setFontSize(9).setFontColor('#888888')
    .setBackground('#f8f9fa').setHorizontalAlignment('left');
  r++;
  legend.forEach((item, i) => {
    an.getRange(r, i + 1).setValue(item[0])
      .setBackground(item[1]).setFontColor(item[2])
      .setFontSize(8).setHorizontalAlignment('center');
  });
  r += 2;

  // ══════════════════════════════════════════════════════
  // [2] 투자 매트릭스 (4분면)
  // ══════════════════════════════════════════════════════
  r = _anSectionTitle(an, r, '투자 매트릭스 (투자금액 × 수익률 4분면)');

  const buyAmts   = posRows.map(row => Number(row[8]) || 0);
  const medianBuy = _anMedian(buyAmts);

  // 분류
  const q = { HH: [], HL: [], LH: [], LL: [] };
  posRows.forEach(row => {
    const buy  = Number(row[8])  || 0;
    const rate = Number(row[12]) || 0;
    const name = String(row[1]);
    const isBig = buy >= medianBuy;
    const isPos = rate >= 0;
    if  (isBig && isPos)   q.HH.push({ name, rate });
    if  (isBig && !isPos)  q.HL.push({ name, rate });
    if  (!isBig && isPos)  q.LH.push({ name, rate });
    if  (!isBig && !isPos) q.LL.push({ name, rate });
  });

  // 기준 안내
  an.getRange(r, 1, 1, 6).merge()
    .setValue('◀ 소규모 (₩' + _dbNum(medianBuy) + ' 미만)')
    .setFontSize(9).setFontColor('#555555').setBackground('#f0f0f0').setHorizontalAlignment('center');
  an.getRange(r, 8, 1, 6).merge()
    .setValue('대규모 (₩' + _dbNum(medianBuy) + ' 이상) ▶')
    .setFontSize(9).setFontColor('#555555').setBackground('#f0f0f0').setHorizontalAlignment('center');
  r++;

  // ── 수익 구간 ──
  an.getRange(r, 1, 1, 13).merge()
    .setValue('▲  수익 구간 (수익률 ≥ 0)')
    .setFontSize(10).setFontWeight('bold')
    .setBackground(DB.BG_CARD_POS).setFontColor(DB.FG_POS)
    .setHorizontalAlignment('center');
  r++;

  an.getRange(r, 1, 1, 6).merge()
    .setValue('🔵 소형 수익  [' + q.LH.length + '종목]')
    .setFontWeight('bold').setBackground('#e3f2fd').setFontColor('#1565c0')
    .setHorizontalAlignment('center');
  an.getRange(r, 8, 1, 6).merge()
    .setValue('🔴 핵심 수익  [' + q.HH.length + '종목]')
    .setFontWeight('bold').setBackground('#fce4ec').setFontColor('#b71c1c')
    .setHorizontalAlignment('center');
  r++;

  const topRows = Math.max(q.LH.length, q.HH.length, 1);
  for (let i = 0; i < topRows; i++) {
    const lh = q.LH[i], hh = q.HH[i];
    an.getRange(r, 1, 1, 6).merge()
      .setValue(lh ? lh.name + '  ' + _dbRate(lh.rate) : '')
      .setBackground('#e3f2fd').setFontColor(DB.FG_POS)
      .setHorizontalAlignment('center').setFontSize(9);
    an.getRange(r, 8, 1, 6).merge()
      .setValue(hh ? hh.name + '  ' + _dbRate(hh.rate) : '')
      .setBackground('#fce4ec').setFontColor(DB.FG_POS)
      .setHorizontalAlignment('center').setFontSize(9);
    r++;
  }

  // ── 손실 구간 ──
  an.getRange(r, 1, 1, 13).merge()
    .setValue('▼  손실 구간 (수익률 < 0)')
    .setFontSize(10).setFontWeight('bold')
    .setBackground(DB.BG_CARD_NEG).setFontColor(DB.FG_NEG)
    .setHorizontalAlignment('center');
  r++;

  an.getRange(r, 1, 1, 6).merge()
    .setValue('🔵 소형 손실  [' + q.LL.length + '종목]')
    .setFontWeight('bold').setBackground('#e8eaf6').setFontColor('#283593')
    .setHorizontalAlignment('center');
  an.getRange(r, 8, 1, 6).merge()
    .setValue('🔴 요주의  [' + q.HL.length + '종목]')
    .setFontWeight('bold').setBackground('#fbe9e7').setFontColor('#bf360c')
    .setHorizontalAlignment('center');
  r++;

  const botRows = Math.max(q.LL.length, q.HL.length, 1);
  for (let i = 0; i < botRows; i++) {
    const ll = q.LL[i], hl = q.HL[i];
    an.getRange(r, 1, 1, 6).merge()
      .setValue(ll ? ll.name + '  ' + _dbRate(ll.rate) : '')
      .setBackground('#e8eaf6').setFontColor(DB.FG_NEG)
      .setHorizontalAlignment('center').setFontSize(9);
    an.getRange(r, 8, 1, 6).merge()
      .setValue(hl ? hl.name + '  ' + _dbRate(hl.rate) : '')
      .setBackground('#fbe9e7').setFontColor(DB.FG_NEG)
      .setHorizontalAlignment('center').setFontSize(9);
    r++;
  }
  r++;

  // ══════════════════════════════════════════════════════
  // [3] 계좌별 성과 비교
  // ══════════════════════════════════════════════════════
  r = _anSectionTitle(an, r, '계좌별 성과 비교');
  an.getRange(r, 1, 1, 10).setValues([[
    '증권사', '계좌', '종목수', '매입금액', '평가금액', '운용손익', '운용수익률', '확정손익', '합산손익', '비중'
  ]]).setFontWeight('bold').setBackground(DB.BG_HDR).setFontColor(DB.FG_HDR)
    .setHorizontalAlignment('center');
  r++;

  const acctMap = {};
  posRows.forEach(row => {
    const key = String(row[3]) + '||' + String(row[4]);
    if (!acctMap[key]) acctMap[key] = {
      broker: String(row[3]), acct: String(row[4]),
      cnt: 0, buy: 0, cur: 0, realized: 0,
    };
    acctMap[key].cnt++;
    acctMap[key].buy += Number(row[8])  || 0;
    acctMap[key].cur += Number(row[10]) || 0;
  });
  pnlRows.forEach(row => {
    const key = String(row[4]) + '||' + String(row[5]);
    if (acctMap[key]) acctMap[key].realized += Number(row[12]) || 0;
  });

  const totalCurAll = posRows.reduce((s, row) => s + (Number(row[10]) || 0), 0);
  const ACCT_ORDER = {
    '미래에셋투자증권|종합_랩': 0,        '미래에셋투자증권|퇴직연금_개인IRP': 1,
    '삼성증권|종합': 2,                    '삼성증권|ISA': 3,
    '삼성증권|퇴직연금_개인IRP(범용)': 4,
  };

  let sumBuyAll = 0, sumCurAll = 0, sumOpAll = 0, sumRzAll = 0, sumCntAll = 0;

  Object.values(acctMap)
    .sort((a, b) => (ACCT_ORDER[a.broker + '|' + a.acct] ?? 99) - (ACCT_ORDER[b.broker + '|' + b.acct] ?? 99))
    .forEach((a, i) => {
      const op   = a.cur - a.buy;
      const opR  = a.buy > 0 ? op / a.buy * 100 : 0;
      const wt   = totalCurAll > 0 ? a.cur / totalCurAll * 100 : 0;
      sumBuyAll += a.buy; sumCurAll += a.cur; sumOpAll += op;
      sumRzAll  += a.realized; sumCntAll += a.cnt;

      an.getRange(r, 1, 1, 10).setValues([[
        _shortBroker(a.broker), _shortAcct(a.acct), a.cnt,
        _dbNum(a.buy), _dbNum(a.cur),
        _dbPnl(op), _dbRate(opR),
        _dbPnl(a.realized), _dbPnl(op + a.realized),
        _dbRate(wt),
      ]]).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      an.getRange(r, 1, 1, 2).setHorizontalAlignment('center');
      an.getRange(r, 3, 1, 8).setHorizontalAlignment('right');
      _anColorVal(an, r, 6, op);
      _anColorVal(an, r, 7, opR);
      _anColorVal(an, r, 8, a.realized);
      _anColorVal(an, r, 9, op + a.realized);
      r++;
    });

  const totalOp  = sumCurAll - sumBuyAll;
  const totalOpR = sumBuyAll > 0 ? totalOp / sumBuyAll * 100 : 0;
  an.getRange(r, 1, 1, 10).setValues([[
    '합계', '', sumCntAll,
    _dbNum(sumBuyAll), _dbNum(sumCurAll),
    _dbPnl(sumOpAll), _dbRate(totalOpR),
    _dbPnl(sumRzAll), _dbPnl(sumOpAll + sumRzAll), '100%',
  ]]).setFontWeight('bold').setBackground(DB.BG_TOTAL);
  an.getRange(r, 1, 1, 2).setHorizontalAlignment('center');
  an.getRange(r, 3, 1, 8).setHorizontalAlignment('right');
  _anColorVal(an, r, 6, sumOpAll);
  _anColorVal(an, r, 7, totalOpR);
  _anColorVal(an, r, 8, sumRzAll);
  _anColorVal(an, r, 9, sumOpAll + sumRzAll);
  r += 2;

  // ══════════════════════════════════════════════════════
  // [4] 분류별 성과
  // ══════════════════════════════════════════════════════
  r = _anSectionTitle(an, r, '분류별 성과');
  an.getRange(r, 1, 1, 8).setValues([[
    '분류', '종목수', '매입금액', '평가금액', '운용손익', '수익률', '비중', '확정손익'
  ]]).setFontWeight('bold').setBackground(DB.BG_HDR).setFontColor(DB.FG_HDR)
    .setHorizontalAlignment('center');
  r++;

  const catMap = {};
  posRows.forEach(row => {
    const cat = String(row[2]) || '기타';
    if (!catMap[cat]) catMap[cat] = { cnt: 0, buy: 0, cur: 0, realized: 0 };
    catMap[cat].cnt++;
    catMap[cat].buy += Number(row[8])  || 0;
    catMap[cat].cur += Number(row[10]) || 0;
  });
  pnlRows.forEach(row => {
    const cat = String(row[3]) || '기타';
    if (catMap[cat]) catMap[cat].realized += Number(row[12]) || 0;
  });

  ['국내주식','국내ETF','해외주식','해외ETF','펀드','예금','보험','기타']
    .filter(c => catMap[c])
    .forEach((cat, i) => {
      const c    = catMap[cat];
      const pnl  = c.cur - c.buy;
      const rate = c.buy > 0 ? pnl / c.buy * 100 : 0;
      const wt   = totalCurAll > 0 ? c.cur / totalCurAll * 100 : 0;
      an.getRange(r, 1, 1, 8).setValues([[
        cat, c.cnt, _dbNum(c.buy), _dbNum(c.cur),
        _dbPnl(pnl), _dbRate(rate), _dbRate(wt), _dbPnl(c.realized)
      ]]).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      an.getRange(r, 1, 1, 1).setHorizontalAlignment('center');
      an.getRange(r, 2, 1, 7).setHorizontalAlignment('right');
      _anColorVal(an, r, 5, pnl);
      _anColorVal(an, r, 6, rate);
      _anColorVal(an, r, 8, c.realized);
      r++;
    });
  r++;

  // ══════════════════════════════════════════════════════
  // [5] 52주 포지션
  // ══════════════════════════════════════════════════════
  r = _anSectionTitle(an, r, '52주 포지션 (높을수록 52주 고점 근처)');
  an.getRange(r, 1, 1, 7).setValues([[
    '종목명', '현재가', '52주최저', '52주최고', '포지션 바', '위치(%)', '분류'
  ]]).setFontWeight('bold').setBackground(DB.BG_HDR).setFontColor(DB.FG_HDR)
    .setHorizontalAlignment('center');
  r++;

  [...posRows]
    .filter(row => Number(row[21]) > 0 && Number(row[22]) > 0)
    .sort((a, b) => {
      const pA = _anPos52(Number(a[9]), Number(a[22]), Number(a[21]));
      const pB = _anPos52(Number(b[9]), Number(b[22]), Number(b[21]));
      return pB - pA;
    })
    .forEach((row, i) => {
      const cur  = Number(row[9])  || 0;
      const high = Number(row[21]) || 0;
      const low  = Number(row[22]) || 0;
      const pos  = _anPos52(cur, low, high);
      const bar  = _anPos52Bar(pos);
      const bg   = i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD;

      an.getRange(r, 1, 1, 7).setValues([[
        String(row[1]),
        _dbNum(cur), _dbNum(low), _dbNum(high),
        bar,
        pos >= 0 ? pos.toFixed(1) + '%' : '-',
        String(row[2]),
      ]]).setBackground(bg);
      an.getRange(r, 1, 1, 1).setHorizontalAlignment('left');
      an.getRange(r, 2, 1, 4).setHorizontalAlignment('right');
      an.getRange(r, 5, 1, 1).setHorizontalAlignment('center').setFontFamily('Courier New').setFontSize(9);
      an.getRange(r, 6, 1, 1).setHorizontalAlignment('right');
      an.getRange(r, 7, 1, 1).setHorizontalAlignment('center');

      if (pos >= 75)      an.getRange(r, 5).setFontColor(DB.FG_POS).setFontWeight('bold');
      else if (pos <= 25) an.getRange(r, 5).setFontColor(DB.FG_NEG).setFontWeight('bold');
      r++;
    });
  r++;

  // ══════════════════════════════════════════════════════
  // [6] 확정 수익 분석
  // ══════════════════════════════════════════════════════
  if (pnlRows.length > 0) {
    r = _anSectionTitle(an, r, '확정 수익 — 연도별 합산');
    an.getRange(r, 1, 1, 7).setValues([[
      '연도', '매도건수', '수익건수', '손실건수', '실현손익', '승률', '누적손익'
    ]]).setFontWeight('bold').setBackground(DB.BG_HDR).setFontColor(DB.FG_HDR)
      .setHorizontalAlignment('center');
    r++;

    const yearMap = {};
    pnlRows.forEach(row => {
      const yr = String(row[0]).slice(0, 4);
      if (!yearMap[yr]) yearMap[yr] = { pnl: 0, cnt: 0, win: 0 };
      const p = Number(row[12]) || 0;
      yearMap[yr].pnl += p; yearMap[yr].cnt++;
      if (p > 0) yearMap[yr].win++;
    });

    let cumulative = 0;
    Object.keys(yearMap).sort().forEach((yr, i) => {
      const d  = yearMap[yr];
      const wr = d.cnt > 0 ? d.win / d.cnt * 100 : 0;
      cumulative += d.pnl;
      an.getRange(r, 1, 1, 7).setValues([[
        yr, d.cnt, d.win, d.cnt - d.win,
        _dbPnl(d.pnl), _dbRate(wr), _dbPnl(cumulative)
      ]]).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      an.getRange(r, 1, 1, 1).setHorizontalAlignment('center');
      an.getRange(r, 2, 1, 6).setHorizontalAlignment('right');
      _anColorVal(an, r, 5, d.pnl);
      _anColorVal(an, r, 7, cumulative);
      r++;
    });

    const totalReal  = pnlRows.reduce((s, row) => s + (Number(row[12]) || 0), 0);
    const totalWin   = pnlRows.filter(row => Number(row[12]) > 0).length;
    const totalWinR  = pnlRows.length > 0 ? totalWin / pnlRows.length * 100 : 0;
    an.getRange(r, 1, 1, 7).setValues([[
      '합계', pnlRows.length, totalWin, pnlRows.length - totalWin,
      _dbPnl(totalReal), _dbRate(totalWinR), _dbPnl(totalReal)
    ]]).setFontWeight('bold').setBackground(DB.BG_TOTAL);
    an.getRange(r, 1, 1, 1).setHorizontalAlignment('center');
    an.getRange(r, 2, 1, 6).setHorizontalAlignment('right');
    _anColorVal(an, r, 5, totalReal);
    _anColorVal(an, r, 7, totalReal);
    r += 2;

    // 월별 (최근 12개월)
    r = _anSectionTitle(an, r, '확정 수익 — 월별 (최근 12개월)');
    an.getRange(r, 1, 1, 5).setValues([[
      '월', '매도건수', '수익건수', '실현손익', '승률'
    ]]).setFontWeight('bold').setBackground(DB.BG_HDR).setFontColor(DB.FG_HDR)
      .setHorizontalAlignment('center');
    r++;

    const mMap = {};
    pnlRows.forEach(row => {
      const m = String(row[0]).slice(0, 7);
      if (!mMap[m]) mMap[m] = { pnl: 0, cnt: 0, win: 0 };
      const p = Number(row[12]) || 0;
      mMap[m].pnl += p; mMap[m].cnt++;
      if (p > 0) mMap[m].win++;
    });

    Object.keys(mMap).sort().slice(-12).forEach((m, i) => {
      const d  = mMap[m];
      const wr = d.cnt > 0 ? d.win / d.cnt * 100 : 0;
      an.getRange(r, 1, 1, 5).setValues([[
        m, d.cnt, d.win, _dbPnl(d.pnl), _dbRate(wr)
      ]]).setBackground(i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD);
      an.getRange(r, 1, 1, 1).setHorizontalAlignment('center');
      an.getRange(r, 2, 1, 4).setHorizontalAlignment('right');
      _anColorVal(an, r, 4, d.pnl);
      r++;
    });
    r++;
  }

  // ══════════════════════════════════════════════════════
  // [7] 집중도 분석
  // ══════════════════════════════════════════════════════
  r = _anSectionTitle(an, r, '집중도 분석 (매입금액 상위 종목 순)');
  an.getRange(r, 1, 1, 10).setValues([[
    '순위', '종목명', '분류', '계좌',
    '매입금액', '매입비중', '평가금액', '평가비중', '손익', '수익률'
  ]]).setFontWeight('bold').setBackground(DB.BG_HDR).setFontColor(DB.FG_HDR)
    .setHorizontalAlignment('center');
  r++;

  const totalBuyConc = posRows.reduce((s, row) => s + (Number(row[8])  || 0), 0);
  const totalCurConc = posRows.reduce((s, row) => s + (Number(row[10]) || 0), 0);

  const sortedByBuy = [...posRows].sort((a, b) => (Number(b[8]) || 0) - (Number(a[8]) || 0));

  sortedByBuy.forEach((row, i) => {
    const buy  = Number(row[8])  || 0;
    const cur  = Number(row[10]) || 0;
    const pnl  = Number(row[11]) || 0;
    const rate = Number(row[12]) || 0;
    const bwt  = totalBuyConc > 0 ? buy / totalBuyConc * 100 : 0;
    const cwt  = totalCurConc > 0 ? cur / totalCurConc * 100 : 0;
    const acct = _shortBroker(row[3]) + '/' + _shortAcct(row[4]);
    const bg   = i % 2 === 0 ? DB.BG_EVEN : DB.BG_ODD;

    an.getRange(r, 1, 1, 10).setValues([[
      i + 1, String(row[1]), String(row[2]), acct,
      _dbNum(buy), _dbRate(bwt),
      _dbNum(cur), _dbRate(cwt),
      _dbPnl(pnl), _dbRate(rate),
    ]]).setBackground(bg);
    an.getRange(r, 1, 1, 4).setHorizontalAlignment('center');
    an.getRange(r, 5, 1, 6).setHorizontalAlignment('right');
    _anColorVal(an, r, 9, pnl);
    _anColorVal(an, r, 10, rate);
    if (i < 3) an.getRange(r, 1, 1, 10).setFontWeight('bold');
    r++;
  });

  // 누적 비중 요약 (Top 3 / 5 / 10)
  r++;
  [3, 5, 10].filter(n => n <= sortedByBuy.length).forEach((n, i) => {
    const sumBuy = sortedByBuy.slice(0, n).reduce((s, row) => s + (Number(row[8]) || 0), 0);
    const wt     = totalBuyConc > 0 ? sumBuy / totalBuyConc * 100 : 0;
    const bgList = ['#fff3e0', '#f3e5f5', '#e8f5e9'];
    an.getRange(r, 1, 1, 5).merge()
      .setValue('Top ' + n + ' 집중도: ' + wt.toFixed(1) + '%  (₩' + _dbNum(sumBuy) + ')')
      .setFontSize(11).setFontWeight('bold')
      .setBackground(bgList[i] || DB.BG_CARD_NEU)
      .setFontColor('#333333').setHorizontalAlignment('center');
    r++;
  });

  an.setFrozenRows(1);
  // setActiveSheet 제거 — 업데이트 중 시트 자동 이동 방지
  ss.toast('분석 대시보드 갱신 완료', '🔬', 3);
  Logger.log('buildAnalysisDashboard 완료 — ' + r + '행');
}

// ── 분석 전용 헬퍼 ────────────────────────────────────

function _anSectionTitle(sheet, row, title) {
  sheet.getRange(row, 1, 1, AN.COLS).merge()
    .setValue('▌ ' + title)
    .setFontSize(11).setFontWeight('bold')
    .setBackground(DB.BG_SECTION).setFontColor(DB.FG_SECTION)
    .setVerticalAlignment('middle');
  sheet.setRowHeight(row, 28);
  return row + 1;
}

// 수치 부호에 따라 글자색 (양수=빨강, 음수=파랑, 한국 관례)
function _anColorVal(sheet, row, col, value) {
  const v = Number(value) || 0;
  if      (v > 0) sheet.getRange(row, col).setFontColor(DB.FG_POS);
  else if (v < 0) sheet.getRange(row, col).setFontColor(DB.FG_NEG);
}

// 히트맵: 수익률 크기에 따라 배경+글자색 설정 (양수=빨강, 음수=파랑)
function _anHeatCell(sheet, row, col, value) {
  const v = Number(value) || 0;
  let bg, fg;
  if      (v >= 15) { bg = '#b71c1c'; fg = '#ffffff'; }
  else if (v >=  7) { bg = '#e53935'; fg = '#ffffff'; }
  else if (v >=  3) { bg = '#ef9a9a'; fg = '#333333'; }
  else if (v >=  0) { bg = '#ffcdd2'; fg = '#333333'; }
  else if (v >= -3) { bg = '#bbdefb'; fg = '#333333'; }
  else if (v >= -7) { bg = '#42a5f5'; fg = '#ffffff'; }
  else              { bg = '#1565c0'; fg = '#ffffff'; }
  sheet.getRange(row, col).setBackground(bg).setFontColor(fg).setFontWeight('bold');
}

// '1.23%' 또는 '-0.45%' 문자열 → 숫자, 파싱 불가 시 null
function _anParseRate(val) {
  if (!val || val === '-') return null;
  const v = parseFloat(String(val).replace('%', ''));
  return isNaN(v) ? null : v;
}

// 52주 밴드 내 위치 % (low=0%, high=100%)
function _anPos52(cur, low, high) {
  if (high <= low || low <= 0 || cur <= 0) return -1;
  return Math.max(0, Math.min(100, Math.round((cur - low) / (high - low) * 100)));
}

// 10칸 텍스트 바 (▓ = 채움, ░ = 비움)
function _anPos52Bar(pos) {
  if (pos < 0) return '──────────';
  const filled = Math.round(pos / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

// 중앙값
function _anMedian(arr) {
  if (!arr || arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}
