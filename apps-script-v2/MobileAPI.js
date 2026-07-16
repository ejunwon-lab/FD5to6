/**
 * MobileAPI.js (신시스템 v2) — iOS 뉴FD7 / 웹앱 진입점
 *
 * 모든 함수는 JSON.stringify 된 문자열 반환 (GAS scripts.run API 특성상)
 *
 * 신 *보유현황* 15컬럼 구조:
 *  [0]종목코드 [1]종목명 [2]분류 [3]증권사 [4]계좌 [5]보유기간 [6]수량
 *  [7]평균단가 [8]매입금액 [9]현재단가 [10]평가금액 [11]손익 [12]수익률
 *  [13]수동평가금액 [14]비고
 *
 * 누락 필드(change/m1/m3/m6/y1/high52/low52)는 *현재가_이력*에서 직접 계산.
 */

// ══════════════════════════════════════════════════════
//  포트폴리오 읽기 (앱 실행 시 즉시 호출)
// ══════════════════════════════════════════════════════

/**
 * 시트에 저장된 '마지막 갱신' 시각(yyyy-MM-dd HH:mm)을 반환.
 * *대시보드* 2행("🕐 마지막 갱신  2026-06-12 09:15  ·  정상")을 buildDashboard가 매 updateAllNew/
 * updatePositionFromLedger 끝에 기록 → 갱신하면 now, 갱신 안 하고 읽으면 직전 갱신시각이 됨.
 * 셀 없거나 파싱 실패 시 현재 시각 폴백.
 */
function _mLastUpdateAt(ss) {
  try {
    const dash = ss.getSheetByName(DB.SHEET);
    if (dash) {
      const cell = String(dash.getRange(2, 1).getValue() || '');
      const m = cell.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)/);
      if (m) return m[1] + ' ' + m[2];
    }
  } catch (e) { /* 폴백으로 진행 */ }
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
}

function newMobileGetPortfolio() {
  try {
    const ss       = SpreadsheetApp.getActiveSpreadsheet();
    const posSheet = ss.getSheetByName(NS.POSITION);
    const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);
    const priceHistSheet = ss.getSheetByName(NS.PRICE_HISTORY);
    const ledgerSheet    = ss.getSheetByName(NS.LEDGER);

    if (!posSheet) {
      return JSON.stringify({ success: false, error: '*보유현황* 없음. updatePositionFromLedger 먼저 실행하세요.' });
    }

    // 전체 보유 (summary 계산용 — KIS_SKIP 포함)
    const allPosRows = posSheet.getLastRow() >= 2
      ? posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 15).getValues()
          .filter(r =>
            String(r[1]) !== '합계' &&
            String(r[0]) !== '합계' &&
            Number(r[6]) > 0)
      : [];
    // KIS 종목만 (holdings/byCategory/byAccount용 — 펀드·예금·보험·기타 제외)
    const posRows = allPosRows.filter(r => !NS.KIS_SKIP.includes(String(r[2]).trim()));

    const pnlRows = (pnlSheet && pnlSheet.getLastRow() >= 2)
      ? pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
          .filter(r => r[0] && String(r[0]) !== '합계')
      : [];

    const buyDateMap = _mGetBuyDates(ss);
    const fx         = _mGetFxRates(ss);
    const metrics    = _readStockMetrics(ss);

    const holdings = posRows.map(r => _mMapHolding(r, buyDateMap, metrics));

    // ── 요약 계산 (전체 보유 기준 — KIS_SKIP 포함, *추이 기록* 운용중과 동일 정의) ──
    const totalBuy = allPosRows.reduce((s, r) => s + (Number(r[8])  || 0), 0);
    const totalCur = allPosRows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
    const opProfit = totalCur - totalBuy;
    const opRate   = totalBuy > 0 ? opProfit / totalBuy * 100 : 0;

    const cfProfit = pnlRows.reduce((s, r) => s + (Number(r[12]) || 0), 0);
    const cfBuy    = pnlRows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
    const cfRate   = cfBuy > 0 ? cfProfit / cfBuy * 100 : 0;

    // trendTotalProfit은 *추이 기록*의 최신값(AD2)을 우선 사용
    // prevDayChang* 은 *추이 기록* U열에서 "어제 거래일" 행을 직접 찾아 AE/AF 사용
    //   → AJ2/AK2 백업 의존 제거 (백업 갱신 시점 한계로 잘못된 값 표시되던 버그 수정)
    let totProfit = opProfit + cfProfit;
    let prevDayChangAmount = null;
    let prevDayChangePct   = null;
    const trendSht = ss.getSheetByName(NS.TREND);
    if (trendSht && trendSht.getLastRow() >= 2) {
      const ad2 = trendSht.getRange(2, 30).getValue();  // AD2 = 합계 수익 최신
      const adN = Number(String(ad2 || '').replace(/,/g, ''));
      if (!isNaN(adN) && adN !== 0) totProfit = adN;

      const prev = _mFindPrevDayProfitChange(trendSht);
      prevDayChangAmount = prev.amount;
      prevDayChangePct   = prev.pct;
    }
    const totRate   = totalBuy > 0 ? totProfit / totalBuy * 100 : 0;

    // ── 오늘 수익 (*종목지표*의 행별 당일손익 합산) ──
    let dayChange = 0;
    posRows.forEach(r => {
      const key = _normCode(String(r[0])) + '||' + String(r[3] || '') + '||' + String(r[4] || '');
      const ex = metrics.get(key);
      if (ex && ex.todayPnl != null) dayChange += ex.todayPnl;
    });
    const prevCur = totalCur - dayChange;
    const dayPct  = prevCur > 0 ? dayChange / prevCur * 100 : 0;

    const isMarketDay  = _mIsMarketDay();
    const isTradingDay = _mIsTradingDay();

    // priceAsOfDate = *현재가_이력*의 마지막 '거래일' 행 날짜 (클라이언트 라벨 결정용).
    // 비거래일 행이 잘못 누적돼 있어도 건너뛰고 마지막 거래일 날짜를 찾음.
    let priceAsOfDate = null;
    if (priceHistSheet && priceHistSheet.getLastRow() >= 2) {
      const lastRow = priceHistSheet.getLastRow();
      const scanN   = Math.min(lastRow - 1, 15);
      const dcol    = priceHistSheet.getRange(lastRow - scanN + 1, 1, scanN, 1).getValues();
      for (let i = dcol.length - 1; i >= 0; i--) {
        const raw = dcol[i][0];
        const d = raw instanceof Date
          ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
          : String(raw).slice(0, 10);
        if (_isTradingDateStr(d)) { priceAsOfDate = d; break; }
      }
    }

    const summary = {
      totalBuy,
      totalCurrent:          totalCur,
      totalProfit:           opProfit,
      profitRate:            opRate,
      trendTotalProfit:      totProfit,
      totalProfitRate:       totRate,
      confirmedProfit:       cfProfit,
      confirmedProfitRate:   cfRate,
      trendOperatingProfit:  opProfit,
      operatingProfitRate:   opRate,
      dayChangAmount:        Math.round(dayChange),
      dayChangePct:          (dayPct >= 0 ? '+' : '') + dayPct.toFixed(2) + '%',
      prevDayChangAmount,
      prevDayChangePct,
      isMarketDay,
      isTradingDay,
      priceAsOfDate,
    };

    const byCategory = _mGroupBy(posRows, 2, totalCur);
    const byAccount  = _mGroupBy(posRows, 4, totalCur);
    const cashReserve = _mGetCashReserve(ss);
    const nonStockAssets = _mGetNonStockAssets(allPosRows);

    return JSON.stringify({
      success: true,
      updatedAt: _mLastUpdateAt(ss),   // 시트 저장 '마지막 갱신' 시각 (갱신=now 재기록, 단순읽기=직전 갱신시각)
      usdRate: fx.usd,
      gbpRate: fx.gbp,
      summary,
      byCategory,
      byAccount,
      holdings,
      cashReserve,
      nonStockAssets,
    });
  } catch (e) {
    Logger.log('newMobileGetPortfolio 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  현재가 갱신 (빠른 갱신)
// ══════════════════════════════════════════════════════
function newMobileUpdateCurrentPrice() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    return JSON.stringify({ success: false, error: '이미 업데이트 진행 중입니다. 잠시 후 다시 시도해주세요.' });
  }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateFxRates(ss);
    updateNewPriceHistory(ss);
    updatePositionFromLedger();
    return newMobileGetPortfolio();
  } catch (e) {
    Logger.log('newMobileUpdateCurrentPrice 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════
//  히스토리 갱신 (신시스템은 *현재가_이력* 누적이므로 가격 갱신과 동일)
// ══════════════════════════════════════════════════════
function newMobileUpdateHistory() {
  return newMobileUpdateCurrentPrice();
}

// ══════════════════════════════════════════════════════
//  전체 갱신 (환율 + 가격 + 보유현황 + 대시보드)
// ══════════════════════════════════════════════════════
function newMobileUpdateAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    return JSON.stringify({ success: false, error: '이미 업데이트 진행 중입니다. 잠시 후 다시 시도해주세요.' });
  }
  try {
    updateAllNew();
    return newMobileGetPortfolio();
  } catch (e) {
    Logger.log('newMobileUpdateAll 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════
//  포트폴리오 상대 지표 (KR 리포트 public용 — 원화 절대액 미포함)
// ══════════════════════════════════════════════════════
/**
 * 비중%(자산군별·종목별) + MDD%만 반환. 원화 금액은 절대 미포함(public 리포트 노출 방지).
 * MDD = *추이 기록* 일별 총자산(Q열, row5↓ sumTotal)의 peak-to-trough.
 */
function getPortfolioMetrics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = { success: true, assetClassWeights: {}, holdings: [], mdd: null };

  // ── 비중 (보유현황 평가금액 by 분류 + 대기자금) ──
  // 분모 = 보유 평가금액 합 + *설정* 대기자금 — MDD의 sumTotal(보유+대기)과 분모 일치 (2026-06-10).
  // 현금성 비중은 리스크 레이더의 "수비 여력" 표시용. 원화 절대액은 여전히 미포함.
  const pos = ss.getSheetByName(NS.POSITION);
  if (pos && pos.getLastRow() >= 2) {
    const rows = pos.getRange(2, 1, pos.getLastRow() - 1, 15).getValues()
      .filter(r => String(r[0]) !== '합계' && String(r[1]) !== '합계' && Number(r[6]) > 0);
    const posTotal = rows.reduce((s, r) => s + (Number(r[10]) || 0), 0);   // 평가금액(idx10)
    const pending = Number(_trGetPendingTotal(ss)) || 0;                   // 대기자금 (Trend.js)
    const total = posTotal + pending;
    if (total > 0) {
      const byClass = {};
      rows.forEach(r => {
        const cat = String(r[2] || '기타');                              // 분류(idx2)
        const w = (Number(r[10]) || 0) / total * 100;
        byClass[cat] = (byClass[cat] || 0) + w;
        result.holdings.push({ name: String(r[1]), category: cat, weight: Math.round(w * 10) / 10 });
      });
      if (pending > 0) byClass['현금성'] = pending / total * 100;
      Object.keys(byClass).forEach(k => { result.assetClassWeights[k] = Math.round(byClass[k] * 10) / 10; });
      result.holdings.sort((a, b) => b.weight - a.weight);
    }
  }

  // ── MDD (추이기록 일별 총자산 Q열=col17, row5↓; 포맷문자열 → 콤마 제거 파싱) ──
  const trend = ss.getSheetByName(NS.TREND);
  if (trend && trend.getLastRow() >= 5) {
    const n = trend.getLastRow() - 5 + 1;
    const vals = trend.getRange(5, 17, n, 1).getValues()
      .map(r => Number(String(r[0]).replace(/[^0-9.]/g, '')))
      .filter(v => v > 0);
    if (vals.length >= 2) {
      let peak = vals[0], mdd = 0;
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] > peak) peak = vals[i];
        const dd = (vals[i] - peak) / peak * 100;
        if (dd < mdd) mdd = dd;
      }
      result.mdd = Math.round(mdd * 10) / 10;   // 음수%, 예: -25.0
    }
  }

  // ── % 셀 파서: _trFmtPct가 쓰는 '+X.XX%'는 텍스트로 남지만 '-X.XX%'는 Sheets가 분수(numeric)로
  //    자동 파싱함 (예: '-7.08%' → -0.0708). 숫자면 ×100, 텍스트면 % 숫자 그대로.
  //    (2026-05-17 이후 현세대 행 기준 — d5/d20/dailyReturns/recentReturns 소비 창은 전부 현세대.
  //     이 비대칭 탓에 음수 날이 100배 축소돼 d5가 상방 왜곡되던 버그 수정, errors.md 2026-07-16)
  const _mPctVal = v => {
    if (typeof v === 'number') return v * 100;
    const r = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(r) ? NaN : r;
  };

  // ── 최근 운용수익률% 추세 (추이기록 수익추이 U=col21 날짜·AC=col29 운용수익률%; 원화 절대액 0) ──
  // PB 리포트 "최근 현황"용 — 오늘 한 점이 아닌 며칠 흐름. 벤치(KOSPI/S&P) 비교는 에이전트가 Yahoo로.
  if (trend && trend.getLastRow() >= 5) {
    const pn = trend.getLastRow() - 5 + 1;
    const dts = trend.getRange(5, 21, pn, 1).getValues().flat();   // U 날짜
    const rts = trend.getRange(5, 29, pn, 1).getValues().flat();   // AC 운용수익률%
    const recent = [];
    for (let i = 0; i < dts.length; i++) {
      const raw = dts[i];
      const d = raw instanceof Date
        ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
        : String(raw || '').slice(0, 10);
      if (!_isTradingDateStr(d)) continue;   // 주말·공휴일 행 제외 — '최근 N거래일' 보장 (errors.md:317 비거래일 행 누적)
      const r = _mPctVal(rts[i]);
      if (!isNaN(r)) recent.push({ date: d, opRatePct: Math.round(r * 100) / 100 });
    }
    result.recentReturns = recent.slice(-10);   // 최근 10거래일 운용수익률%(누적 수준) — 원화 미포함
  }

  // ── 최근 포트 수익률 (일별 총자산 변화율 dRate 복리누적; 매매엔 강건) ──
  // 추이기록 일별추이 N(col14)=날짜·Q(col17)=총자산·S(col19)=일별 총자산 변화율%. KOSPI/KOSDAQ N일 변화율과 단위 일치.
  // dRate는 현금↔주식(매수/매도)엔 총자산 불변이라 0 → 시장 변동만 반영.
  // 입출금 왜곡은 *거래_원장* 구분=입금/출금 행으로 read-time 보정 (TWR, docs/plans/2026-07-16-TWR-입금왜곡보정.md).
  if (trend && trend.getLastRow() >= 5) {
    // 원장 현금흐름 맵: 날짜 → 순입금(입금 +, 출금 −). 비거래일 입금은 다음 거래일 행 diff에 들어가므로 롤포워드.
    const flows = {};
    const ledgerFl = ss.getSheetByName(NS.LEDGER);
    if (ledgerFl && ledgerFl.getLastRow() >= 2) {
      ledgerFl.getRange(2, 1, ledgerFl.getLastRow() - 1, 10).getValues().forEach(fr => {
        const ft = String(fr[1] || '').trim();
        if (ft !== '입금' && ft !== '출금') return;
        let fd = fr[0] instanceof Date
          ? Utilities.formatDate(fr[0], 'Asia/Seoul', 'yyyy-MM-dd')
          : String(fr[0]).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fd)) return;
        for (let g = 0; g < 14 && !_isTradingDateStr(fd); g++) {   // 주말·연휴 롤포워드 (상한 14일)
          const nx = new Date(fd + 'T12:00:00+09:00');
          nx.setDate(nx.getDate() + 1);
          fd = Utilities.formatDate(nx, 'Asia/Seoul', 'yyyy-MM-dd');
        }
        const fAmt = Number(fr[9]) || 0;
        if (fAmt > 0) flows[fd] = (flows[fd] || 0) + (ft === '입금' ? fAmt : -fAmt);
      });
    }
    const FLOW_SUSPECT_PCT = 3.0;   // |dRate| ≥ 이 값인데 입출금 기록 없으면 미기록 왜곡 의심
    const dn2 = trend.getLastRow() - 5 + 1;
    const dd = trend.getRange(5, 14, dn2, 1).getValues().flat();   // N 날짜
    const dq = trend.getRange(5, 17, dn2, 1).getValues().flat();   // Q 총자산
    const dr = trend.getRange(5, 19, dn2, 1).getValues().flat();   // S 일별 총자산 변화율%
    const series = [];
    const dated = [];   // 날짜 동반 일별 변화율 — 주간 리포트 일자별 표용 (마지막5 복리 = d5, 구조적 정합)
    for (let i = 0; i < dd.length; i++) {
      const raw = dd[i];
      const d = raw instanceof Date
        ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
        : String(raw || '').slice(0, 10);
      if (!_isTradingDateStr(d)) continue;   // 주말·공휴일 행 제외 — d5/d20/dailyReturns 창을 '거래일' 기준으로 (errors.md:317)
      const r = _mPctVal(dr[i]);
      if (isNaN(r)) continue;
      const entry = { date: d, dRatePct: Math.round(r * 100) / 100 };
      let rEff = r;
      const f = flows[d] || 0;
      if (f !== 0 && r > -100) {
        // TWR(end-of-day flow): V_prev = Q/(1+S), r_adj = (Q − F − V_prev)/V_prev. F=0이면 r_adj ≡ S.
        const q = Number(String(dq[i]).replace(/[^0-9.\-]/g, '')) || 0;
        const vPrev = q > 0 ? q / (1 + r / 100) : 0;
        if (vPrev > 0) {
          rEff = (q - f - vPrev) / vPrev * 100;
          entry.rawPct = entry.dRatePct;
          entry.dRatePct = Math.round(rEff * 100) / 100;
          entry.flowAdj = true;   // 입출금 반영 표시 (₩ 금액은 비노출 — public 리포트 정책)
        }
      } else if (Math.abs(r) >= FLOW_SUSPECT_PCT) {
        entry.suspect = true;   // 큰 총자산 변동인데 원장에 입출금 기록 없음 — 입금 왜곡 의심 단서
      }
      series.push(rEff);
      dated.push(entry);
    }
    const cum = arr => (arr.reduce((a, r) => a * (1 + r / 100), 1) - 1) * 100;   // 복리 누적%
    const l5 = series.slice(-5), l20 = series.slice(-20);
    result.portfolioReturn = {
      d5: l5.length ? Math.round(cum(l5) * 100) / 100 : null,
      d20: l20.length ? Math.round(cum(l20) * 100) / 100 : null,
    };
    // 일자별 총자산 변화율% (최근 7거래일) — 주간 리포트가 일자별 수익 표에 사용.
    // recentReturns(AC=운용수익률%, 원가기준 누적)와 달리 d5와 같은 소스라 합이 d5에 수렴.
    result.dailyReturns = dated.slice(-7);
  }
  return result;
}

/** doPost action=portfolioMetrics 핸들러 — 시크릿(TG_WEBHOOK_SECRET) 검증 후 상대 지표 JSON. */
function _handlePortfolioMetricsPost(e) {
  try {
    const expected = _tgSecret();
    let secret = e && e.parameter && e.parameter.secret;
    if (!secret && e && e.postData && e.postData.contents) {
      try { secret = JSON.parse(e.postData.contents).secret; } catch (_) { /* form-encoded */ }
    }
    if (!expected || secret !== expected) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'forbidden' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify(getPortfolioMetrics()))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('_handlePortfolioMetricsPost 오류: ' + err.message);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * doPost action=backupData 핸들러 — 시크릿 검증 후 전 시트 dump JSON.
 * 로컬 백업 스크립트(scripts/backup_sheets.py) 전용. 원화 절대액 포함 —
 * 시크릿 게이트 + 로컬 저장(backups/ gitignore) 전제. 설계: docs/plans/2026-07-04-시트백업-로컬.md
 */
function _handleBackupPost(e) {
  try {
    const expected = _tgSecret();
    let secret = e && e.parameter && e.parameter.secret;
    if (!secret && e && e.postData && e.postData.contents) {
      try { secret = JSON.parse(e.postData.contents).secret; } catch (_) { /* form-encoded */ }
    }
    if (!expected || secret !== expected) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'forbidden' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = {};
    ss.getSheets().forEach(sh => {
      const n = sh.getLastRow(), c = sh.getLastColumn();
      sheets[sh.getName()] = (n > 0 && c > 0) ? sh.getRange(1, 1, n, c).getValues() : [];
    });
    const out = {
      success: true,
      exportedAt: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
      spreadsheet: ss.getName(),
      sheets: sheets,
    };
    return ContentService.createTextOutput(JSON.stringify(out))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('_handleBackupPost 오류: ' + err.message);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════
//  이메일 셀프발송 (PB 리포트 채널 — 시트 소유계정 Gmail)
// ══════════════════════════════════════════════════════
/** JSON 응답 헬퍼 */
function _emailJsonOut(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** HTML 이스케이프 (이메일 변환 시 주입 방지) */
function _htmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 텔레그램 MarkdownV1 → 이메일 HTML (가독성 강화, 2026-06-20).
 * `*굵게*`→<b>, `_이탤릭_`→<i>, ```코드블록```→<pre>(monospace 표 정렬 보존), 줄바꿈→<br>.
 * 코드블록 안은 마크다운 변환 안 함(표가 깨지지 않게). 모든 텍스트 esc 후 태그 삽입.
 */
function _mdToHtml(md) {
  var lines = String(md).split('\n');
  var out = [], inCode = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.trim() === '```') {
      if (!inCode) { out.push('<pre style="background:#f5f5f5;padding:10px;border-radius:5px;font-family:Menlo,monospace;font-size:13px;overflow-x:auto;margin:6px 0">'); inCode = true; }
      else { out.push('</pre>'); inCode = false; }
      continue;
    }
    if (inCode) { out.push(_htmlEsc(line)); continue; }
    var h = _htmlEsc(line)
      .replace(/\*([^*]+)\*/g, '<b>$1</b>')
      .replace(/_([^_]+)_/g, '<i>$1</i>');
    out.push(h + '<br>');
  }
  if (inCode) out.push('</pre>');
  return '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a;max-width:680px;margin:0 auto">'
    + out.join('\n') + '</div>';
}

/** 허용 제목 패턴 — 리포트만 발송(임의 내용 차단). 워크플로 SUBJECT와 일치해야 함. */
var _EMAIL_SUBJECT_OK = /Market (Close|Wrap)|KR 마감|US 마감/;
var _EMAIL_DAILY_MAX = 6;   // 정상 US+KR 2~4통 + 재시도 여유. 초과 = 폭주로 간주·차단.

/**
 * doPost action=emailReport — 리포트 본문을 시트 소유계정 Gmail로 셀프발송.
 *
 * 안전장치 (해킹·오발송 방어, 2026-06-20):
 *  1. 수신자 = getEffectiveUser() 소유자 본인 고정 — 요청으로 제3자 지정 불가(구조적 차단).
 *  2. Kill switch — Properties 'email_disabled'='1'이면 전면 차단(사고 시 즉시 정지).
 *  3. 제목 화이트리스트 — 리포트 패턴(_EMAIL_SUBJECT_OK)만. 임의 내용 발송 차단.
 *  4. 일일 상한 — subject 무관 카운터(_EMAIL_DAILY_MAX). dedup 우회 폭주·쿼터 소진 차단.
 *  5. dedup — 타입별 12h 1회(정상 중복). 응답에 수신주소 미노출(public 로그 보호).
 */
function _handleEmailReportPost(e) {
  try {
    const expected = _tgSecret();
    let p = (e && e.parameter) || {};
    let secret = p.secret, subject = p.subject, text = p.text;
    if ((!secret || !text) && e && e.postData && e.postData.contents) {
      try { const j = JSON.parse(e.postData.contents); secret = secret || j.secret; subject = subject || j.subject; text = text || j.text; }
      catch (_) { /* form-encoded */ }
    }
    if (!expected || secret !== expected) return _emailJsonOut({ success: false, error: 'forbidden' });

    const props = _tgProps();
    // [2] Kill switch — 해킹 의심 시 Properties에 email_disabled=1 (즉시 전면 정지)
    if (props.getProperty('email_disabled') === '1') {
      Logger.log('emailReport: kill switch ON — 차단');
      return _emailJsonOut({ success: false, error: 'email_disabled' });
    }
    if (!text) return _emailJsonOut({ success: false, error: 'text required' });
    // [3] 제목 화이트리스트 — 리포트 외 발송 차단
    if (!_EMAIL_SUBJECT_OK.test(subject || '')) {
      Logger.log('emailReport: 제목 패턴 불일치 — 차단');
      return _emailJsonOut({ success: false, error: 'subject_not_allowed' });
    }
    // [4] 일일 상한 — subject 무관 (dedup 우회 폭주·쿼터 소진 차단)
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    const cntKey = 'email_count_' + today;
    const cnt = Number(props.getProperty(cntKey) || 0);
    if (cnt >= _EMAIL_DAILY_MAX) {
      Logger.log('emailReport: 일일 상한(' + _EMAIL_DAILY_MAX + ') 초과 — 차단');
      return _emailJsonOut({ success: false, error: 'daily_limit' });
    }
    // [5] dedup — 타입별 12h 1회
    const isKr = /KR|🌆/.test(subject || '');
    const key = 'email_last_' + (isKr ? 'kr' : 'us');
    const lastSubj = props.getProperty(key + '_subj') || '';
    const lastMs = Number(props.getProperty(key + '_ms') || 0);
    if (subject === lastSubj && (Date.now() - lastMs) < 12 * 3600 * 1000) {
      return _emailJsonOut({ success: true, result: 'skip-dedup' });
    }
    // 발송 — [1] 수신자는 항상 소유자 본인 (요청으로 변조 불가). HTML 서식 + plain fallback.
    const to = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({ to: to, subject: subject, body: text, htmlBody: _mdToHtml(text) });
    props.setProperty(key + '_subj', String(subject));
    props.setProperty(key + '_ms', String(Date.now()));
    props.setProperty(cntKey, String(cnt + 1));
    return _emailJsonOut({ success: true, result: 'sent' });   // 수신주소 미노출
  } catch (err) {
    Logger.log('_handleEmailReportPost 오류: ' + err.message);
    return _emailJsonOut({ success: false, error: String(err) });
  }
}

/** 🛑 이메일 발송 즉시 전면 차단 (해킹·오발송 의심 시 에디터에서 이 함수 ▶ 실행). */
function emailKillSwitch_ON() {
  _tgProps().setProperty('email_disabled', '1');
  Logger.log('🛑 이메일 발송 차단됨 (email_disabled=1). 재개는 emailKillSwitch_OFF.');
}

/** ✅ 이메일 발송 재개 (차단 해제). */
function emailKillSwitch_OFF() {
  _tgProps().deleteProperty('email_disabled');
  Logger.log('✅ 이메일 발송 재개됨 (email_disabled 제거).');
}

/**
 * 🔴 사용자 1회 실행 — MailApp 권한 승인 트리거 + 발송 계정/쿼터 확인.
 * Apps Script 에디터에서 이 함수 ▶ Run → 권한 모달 "고급→이동→허용" → 셀프 메일 도착.
 * (errors.md:142 UrlFetchApp 재승인 부류 — 신규 script.send_mail 스코프 동의)
 */
function _emailReportSelfTest() {
  const to = Session.getEffectiveUser().getEmail();
  const quota = MailApp.getRemainingDailyQuota();
  MailApp.sendEmail({
    to: to,
    subject: '[테스트] PB 리포트 이메일 채널 — 권한 승인 확인',
    body: '이 메일이 도착하면 셀프발송 동작 정상.\n발송/수신 계정: ' + to + '\n남은 일일 발송 쿼터: ' + quota,
  });
  Logger.log('이메일 셀프발송 시도 → ' + to + ' (남은 쿼터 ' + quota + ')');
}

// ══════════════════════════════════════════════════════
//  종목 상세
// ══════════════════════════════════════════════════════
function newMobileGetStockDetail(code) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const normCode = _normCode(code);

    const posSheet = ss.getSheetByName(NS.POSITION);
    const priceHistSheet = ss.getSheetByName(NS.PRICE_HISTORY);
    const ledgerSheet    = ss.getSheetByName(NS.LEDGER);

    // 1) 보유 정보 (브로커·계좌별 합산) + 52주 (전체 가격 시계열에서 계산)
    let stockName = '', stockCategory = '';
    const positions = [];

    const priceColInfo = priceHistSheet ? _mFindPriceColumn(priceHistSheet, normCode) : null;
    let high52 = 0, low52 = 0;
    if (priceColInfo) {
      const { prices } = priceColInfo;
      const valid = prices.filter(p => p > 0);
      if (valid.length > 0) {
        high52 = Math.max(...valid);
        low52  = Math.min(...valid);
      }
    }

    if (posSheet && posSheet.getLastRow() >= 2) {
      const rows = posSheet.getRange(2, 1, posSheet.getLastRow() - 1, 15).getValues();
      rows.forEach(r => {
        if (_normCode(String(r[0])) !== normCode) return;
        if (Number(r[6]) <= 0) return;
        stockName     = String(r[1]);
        stockCategory = String(r[2]);
        positions.push({
          broker:       String(r[3]),
          accountType:  String(r[4]),
          quantity:     Number(r[6])  || 0,
          avgPrice:     Number(r[7])  || 0,
          buyAmount:    Number(r[8])  || 0,
          currentPrice: Number(r[9])  || 0,
          opCurrent:    Number(r[10]) || 0,
          opProfit:     Number(r[11]) || 0,
          profitRate:   Number(r[12]) || 0,
          high52, low52,
        });
      });
    }

    // 2) 거래 이력
    const transactions = [];
    if (ledgerSheet && ledgerSheet.getLastRow() >= 2) {
      const rows = ledgerSheet.getRange(2, 1, ledgerSheet.getLastRow() - 1, 12).getValues();
      rows.forEach(r => {
        if (_normCode(String(r[2])) !== normCode) return;
        const date = r[0] instanceof Date
          ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd')
          : String(r[0]).slice(0, 10);
        if (!stockName)     stockName     = String(r[3] || '');
        if (!stockCategory) stockCategory = String(r[4] || '');
        transactions.push({
          date,
          type:        String(r[1]),
          broker:      String(r[5]),
          accountType: String(r[6]),
          quantity:    Number(r[7])  || 0,
          price:       Number(r[8])  || 0,
          amount:      Number(r[9])  || 0,
          fee:         Number(r[10]) || 0,
        });
      });
      transactions.sort((a, b) => a.date.localeCompare(b.date));
    }

    // 3) 가격 시계열 — 주말·공휴일 drop (시트는 이미 정리됐어도 안전망)
    const priceHistory = [];
    if (priceColInfo) {
      const { dates, prices } = priceColInfo;
      for (let i = 0; i < dates.length; i++) {
        if (dates[i].length === 10 && prices[i] > 0 && _isTradingDateStr(dates[i])) {
          priceHistory.push({ date: dates[i], price: prices[i] });
        }
      }
    }

    // 4) 통계
    const buyTx  = transactions.filter(t => t.type === '매수');
    const sellTx = transactions.filter(t => t.type === '매도');
    const totalQty   = positions.reduce((s, p) => s + p.quantity, 0);
    const totalBuy   = positions.reduce((s, p) => s + p.buyAmount, 0);
    const totalCur   = positions.reduce((s, p) => s + p.opCurrent, 0);
    const totalProfit= positions.reduce((s, p) => s + p.opProfit, 0);
    const overallRate = totalBuy > 0 ? totalProfit / totalBuy * 100 : 0;

    return JSON.stringify({
      success: true,
      code: String(code),
      name: stockName,
      category: stockCategory,
      positions,
      summary: {
        totalQuantity:     totalQty,
        totalBuyAmount:    totalBuy,
        totalCurrentValue: totalCur,
        totalProfit,
        profitRate:        overallRate,
      },
      transactions,
      priceHistory,
      stats: {
        transactionCount:    transactions.length,
        buyCount:            buyTx.length,
        sellCount:           sellTx.length,
        firstBuyDate:        buyTx[0] ? buyTx[0].date : null,
        lastTransactionDate: transactions.length > 0 ? transactions[transactions.length - 1].date : null,
      },
    });
  } catch (e) {
    Logger.log('newMobileGetStockDetail 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  실현손익 (*실현손익* 시트 14컬럼 풀 노출)
//  - 응답:
//    · entries[]: 행 단위 14필드 (데스크 ActivityPage용 — 매도일 desc)
//    · monthly[]: 월별 집계 (web·iOS Analysis용 — 후방 호환)
//  - 두 형태 모두 같이 보내 모든 클라이언트가 자기에게 맞는 키 선택
// ══════════════════════════════════════════════════════
function newMobileGetMonthlyRealized() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pnlSheet = ss.getSheetByName(NS.REALIZED_PNL);
    if (!pnlSheet || pnlSheet.getLastRow() < 2) {
      return JSON.stringify({ success: true, entries: [], monthly: [] });
    }
    const tz = ss.getSpreadsheetTimeZone();
    const rows = pnlSheet.getRange(2, 1, pnlSheet.getLastRow() - 1, 14).getValues()
      .filter(r => r[0] && String(r[0]) !== '합계');

    // ── 행 단위 entries (데스크 ActivityPage) ──
    const entries = rows.map(r => {
      const dateStr = r[0] instanceof Date
        ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd')
        : String(r[0]).slice(0, 10);
      return {
        date:        dateStr,
        month:       dateStr.slice(0, 7),
        code:        String(r[1] || ''),
        name:        String(r[2] || ''),
        category:    String(r[3] || ''),
        broker:      String(r[4] || ''),
        account:     String(r[5] || ''),
        quantity:    Number(r[6])  || 0,
        sellPrice:   Number(r[7])  || 0,
        sellAmount:  Number(r[8])  || 0,
        avgBuyPrice: Number(r[9])  || 0,
        buyCost:     Number(r[10]) || 0,
        fee:         Number(r[11]) || 0,
        profit:      Number(r[12]) || 0,
        returnPct:   Number(r[13]) || 0,
      };
    });
    entries.sort((a, b) => b.date.localeCompare(a.date));

    // ── 월별 집계 monthly (web·iOS — 기존 호환) ──
    const map = {};
    rows.forEach(r => {
      const dateStr = r[0] instanceof Date
        ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd')
        : String(r[0]).slice(0, 10);
      const m = dateStr.slice(0, 7);
      if (!map[m]) map[m] = { month: m, count: 0, winCount: 0, profit: 0, buyAmount: 0 };
      const p   = Number(r[12]) || 0;
      const buy = Number(r[10]) || 0;
      map[m].count++;
      map[m].profit    += p;
      map[m].buyAmount += buy;
      if (p > 0) map[m].winCount++;
    });
    const monthly = Object.keys(map).sort().map(m => ({
      month:      m,
      count:      map[m].count,
      winCount:   map[m].winCount,
      profit:     map[m].profit,
      profitRate: map[m].buyAmount > 0 ? map[m].profit / map[m].buyAmount * 100 : 0,
      winRate:    map[m].count > 0 ? map[m].winCount / map[m].count * 100 : 0,
    }));

    return JSON.stringify({ success: true, entries, monthly });
  } catch (e) {
    Logger.log('newMobileGetMonthlyRealized 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  수익 히스토리 (*추이 기록* 시트 U열(날짜) + AD열(합계 수익))
//  - 구시스템 동일 컬럼 매핑
//  - 행 5부터 데이터 (행 2는 최신 스냅샷)
// ══════════════════════════════════════════════════════
function newMobileGetProfitHistory() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const trend = ss.getSheetByName(NS.TREND);
    if (!trend || trend.getLastRow() < 5) return JSON.stringify({ success: true, entries: [] });

    const pFirstRow = 5, pStartCol = 21;  // U
    const lastRow   = trend.getLastRow();
    const height    = lastRow - pFirstRow + 1;
    if (height <= 0) return JSON.stringify({ success: true, entries: [] });

    const data = trend.getRange(pFirstRow, pStartCol, height, 10).getValues();  // U~AD (10컬럼)
    const toN = v => {
      if (v === null || v === undefined || v === '') return 0;
      const n = Number(String(v).replace(/,/g, '').replace('%', ''));
      return isNaN(n) ? 0 : n;
    };
    const toDateStr = v => {
      if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
      const s = String(v || '');
      const m = s.match(/^\d{4}-\d{2}-\d{2}/);
      return m ? m[0] : '';
    };

    const entries = [];
    for (const row of data) {
      const d = toDateStr(row[0]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      if (!_isTradingDateStr(d)) continue;   // 주말·공휴일 drop (errors.md 2026-05-17 패턴)
      entries.push({ date: d, totalProfit: toN(row[9]) });   // AD = idx 9
    }
    return JSON.stringify({ success: true, entries: entries.slice(-180) });
  } catch (e) {
    Logger.log('newMobileGetProfitHistory 오류: ' + e);
    return JSON.stringify({ success: true, entries: [] });
  }
}

// ══════════════════════════════════════════════════════
//  참고지표 히스토리 시계열 (벤치마크 차트용)
//  - *참고지표_히스토리* 시트 (날짜 + 시간 + 지표명 컬럼들) → wide JSON
//  - 응답: { keys: ['KOSPI','SPX',...], entries: [{date, KOSPI:2700, SPX:5200, ...}] }
//  - 헤더는 NEW_REFERENCE_INDICATORS의 .name. name→key 매핑하여 클라이언트가 다루기 쉬운 key로 변환
//  - 날짜 오름차순 정렬
// ══════════════════════════════════════════════════════
function newMobileGetIndicatorHistory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('참고지표_히스토리');
    if (!sheet || sheet.getLastRow() < 2) {
      return JSON.stringify({ success: true, keys: [], entries: [] });
    }
    const tz      = ss.getSpreadsheetTimeZone();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const names  = header.slice(2);  // [날짜, 시간] 다음부터 지표명

    const nameToKey = {};
    for (const d of NEW_REFERENCE_INDICATORS) nameToKey[d.name] = d.key;

    const keys = [];
    const colIdxByKey = [];
    names.forEach((n, i) => {
      const k = nameToKey[n];
      if (k) { keys.push(k); colIdxByKey.push(2 + i); }
    });

    const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const entries = rows.map(r => {
      const dateStr = r[0] instanceof Date
        ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd')
        : String(r[0]).slice(0, 10);
      const entry = { date: dateStr };
      for (let i = 0; i < keys.length; i++) {
        entry[keys[i]] = Number(r[colIdxByKey[i]]) || 0;
      }
      return entry;
    }).filter(e => e.date && _isTradingDateStr(e.date));  // 주말·공휴일 drop

    entries.sort((a, b) => a.date.localeCompare(b.date));

    return JSON.stringify({ success: true, keys, entries });
  } catch (e) {
    Logger.log('newMobileGetIndicatorHistory 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  참고지표 정의 (구시스템 동일)
// ══════════════════════════════════════════════════════
const NEW_REFERENCE_INDICATORS = [
  { key: 'KOSPI',  name: 'KOSPI',  category: '한국시장', source: 'kis_domestic_index', code: '0001' },
  { key: 'KOSDAQ', name: 'KOSDAQ', category: '한국시장', source: 'kis_domestic_index', code: '1001' },
  { key: 'K200F',  name: 'KOSPI200', category: '한국선물', source: 'kis_domestic_index', code: '2001' },
  { key: 'SPX', name: 'S&P500',        category: '미국시장', source: 'kis_overseas_index', code: 'SPX', excd: 'NYS', gfSymbol: 'INDEXSP:.INX' },
  { key: 'NDX', name: 'NASDAQ100',     category: '미국시장', source: 'kis_overseas_index', code: 'NDX', excd: 'NAS', gfSymbol: 'INDEXNASDAQ:NDX' },
  { key: 'DJI', name: '다우존스',       category: '미국시장', source: 'kis_overseas_index', code: 'DJI', excd: 'NYS', gfSymbol: 'INDEXDJX:.DJI' },
  { key: 'SOX', name: '필라델피아반도체', category: 'AI/반도체', source: 'kis_overseas_index', code: 'SOX', excd: 'NAS', gfSymbol: 'NASDAQ:SOXX', ySymbol: '^SOX' },
  { key: 'ES', name: 'S&P500선물',  category: '미국선물', source: 'yahoo_finance', ySymbol: 'ES=F',  gfSymbol: 'INDEXSP:.INX' },
  { key: 'NQ', name: 'NASDAQ선물',  category: '미국선물', source: 'yahoo_finance', ySymbol: 'NQ=F',  gfSymbol: 'INDEXNASDAQ:NDX' },
  { key: 'GC', name: '금',      category: '상품', source: 'yahoo_finance', ySymbol: 'GC=F',  gfSymbol: 'COMEX:GC1!' },
  { key: 'CL', name: 'WTI원유', category: '상품', source: 'yahoo_finance', ySymbol: 'CL=F',  gfSymbol: 'NYMEX:CL1!' },
  { key: 'VIX', name: 'VIX',       category: '매크로', source: 'googlefinance', gfSymbol: 'INDEXCBOE:VIX' },
  { key: 'TNX', name: '미국10년물', category: '매크로', source: 'googlefinance', gfSymbol: 'TNX' },
  { key: 'DXY', name: '달러인덱스', category: '매크로', source: 'yahoo_finance', ySymbol: 'DX-Y.NYB', gfSymbol: 'CURRENCYCOM:DXY' },
  { key: 'NVDA', name: 'NVIDIA',     category: 'AI/반도체', source: 'yahoo_finance', ySymbol: 'NVDA',  gfSymbol: 'NASDAQ:NVDA' },
  { key: 'AAPL', name: 'Apple',     category: '빅테크', source: 'yahoo_finance', ySymbol: 'AAPL',  gfSymbol: 'NASDAQ:AAPL' },
  { key: 'MSFT', name: 'Microsoft', category: '빅테크', source: 'yahoo_finance', ySymbol: 'MSFT',  gfSymbol: 'NASDAQ:MSFT' },
  { key: 'GOOGL', name: 'Google',   category: '빅테크', source: 'yahoo_finance', ySymbol: 'GOOGL', gfSymbol: 'NASDAQ:GOOGL' },
  { key: 'META', name: 'Meta',      category: '빅테크', source: 'yahoo_finance', ySymbol: 'META',  gfSymbol: 'NASDAQ:META' },
  { key: 'AMZN', name: 'Amazon',    category: '빅테크', source: 'yahoo_finance', ySymbol: 'AMZN',  gfSymbol: 'NASDAQ:AMZN' },
  { key: 'TSLA', name: 'Tesla',     category: '빅테크', source: 'yahoo_finance', ySymbol: 'TSLA',  gfSymbol: 'NASDAQ:TSLA' },
  { key: 'HSI', name: '항셍지수', category: '중국시장', source: 'yahoo_finance', ySymbol: '^HSI', gfSymbol: 'INDEXHANGSENG:HSI' },
];

function newMobileGetIndicators() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    KIS_API.ensureToken();

    const summarySheet = _newEnsureIndicatorsSheet(ss);
    const historySheet = _newEnsureIndicatorsHistorySheet(ss);

    const tz        = 'Asia/Seoul';
    const now       = new Date();
    const updatedAt = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
    const today     = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    const hhmmss    = Utilities.formatDate(now, tz, 'HH:mm:ss');

    const results = [];
    for (const def of NEW_REFERENCE_INDICATORS) {
      let info = null;
      try {
        if (def.source === 'kis_domestic_index') {
          info = KIS_API.getDomesticIndex(def.code);
        } else if (def.source === 'kis_overseas_index') {
          info = KIS_API.getOverseasIndex(def.code, def.excd || 'NAS');
        } else if (def.source === 'kis_domestic_futures') {
          info = KIS_API.getDomesticFutures(def.code);
        } else if (def.source === 'yahoo_finance') {
          info = _newGetYahooFinanceQuote(def.ySymbol);
        }
      } catch (e) {
        Logger.log(`지표 ${def.key} 조회 오류: ${e}`);
      }
      results.push({
        key: def.key, name: def.name, category: def.category,
        value:     info ? info.value     : 0,
        change:    info ? info.change    : 0,
        changePct: info ? info.changePct : 0,
        source:    def.source,
        gfSymbol:  def.gfSymbol || '',
        ySymbol:   def.ySymbol  || '',
      });
    }

    _newFillGoogleFinanceIndicators(ss, results);
    _newFillMissingWithYahooFinance(results);
    _newFillMissingWithGoogleFinance(ss, results);

    summarySheet.getRange(1, 1, 1, 7).setValues([['키','지표명','카테고리','현재값','등락','등락률(%)','갱신시간']]);
    if (results.length > 0) {
      summarySheet.getRange(2, 1, results.length, 7).setValues(
        results.map(r => [r.key, r.name, r.category, r.value, r.change, r.changePct, updatedAt])
      );
    }
    _newUpsertIndicatorsHistory(historySheet, today, hhmmss, results);
    SpreadsheetApp.flush();

    return JSON.stringify({
      success: true,
      updatedAt,
      indicators: results.map(r => ({
        key: r.key, name: r.name, category: r.category,
        value: r.value, change: r.change, changePct: r.changePct,
      })),
    });
  } catch (e) {
    Logger.log('newMobileGetIndicators 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ══════════════════════════════════════════════════════
//  내부 헬퍼
// ══════════════════════════════════════════════════════

// *현재가_이력*에서 종목별 확장 지표 계산
// 반환: Map<normCode, { change, changePct, m1, m3, m6, y1, high52, low52 }>
// _mCalcExtras 는 StockMetrics.js 의 computeStockMetrics 로 통합 (*종목지표* 시트).
// newMobileGetPortfolio 는 _readStockMetrics() 로 읽는다.

// *현재가_이력*에서 특정 종목의 가격 시계열 추출 → { dates, prices }
function _mFindPriceColumn(priceHistSheet, normCode) {
  if (!priceHistSheet || priceHistSheet.getLastRow() < 2 || priceHistSheet.getLastColumn() < 2) return null;
  const lastRow = priceHistSheet.getLastRow();
  const lastCol = priceHistSheet.getLastColumn();
  const headers = priceHistSheet.getRange(1, 2, 1, lastCol - 1).getValues()[0]
    .map(c => _normCode(String(c)));
  const colIdx = headers.indexOf(normCode);
  if (colIdx < 0) return null;
  const dataCol = colIdx + 2;
  const datesRaw = priceHistSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const dates = datesRaw.map(r => {
    const raw = r[0];
    return raw instanceof Date
      ? Utilities.formatDate(raw, 'Asia/Seoul', 'yyyy-MM-dd')
      : String(raw).slice(0, 10);
  });
  const prices = priceHistSheet.getRange(2, dataCol, lastRow - 1, 1).getValues()
    .map(r => Number(r[0]) || 0);
  return { dates, prices };
}

function _mMapHolding(r, buyDateMap, metrics) {
  const code   = String(r[0] || '');
  const name   = String(r[1] || '');
  const broker = String(r[3] || '');
  const acct   = String(r[4] || '');
  const key    = code + '||' + name + '||' + broker + '||' + acct;
  const metricKey = _normCode(code) + '||' + broker + '||' + acct;
  const ex     = metrics.get(metricKey) || {};
  const change    = ex.change    != null ? ex.change    : 0;
  const changePct = ex.changePct != null ? ex.changePct : 0;

  return {
    code,
    name,
    category:     String(r[2] || ''),
    broker,
    accountType:  acct,
    quantity:     Number(r[6])  || 0,
    buyPrice:     Number(r[7])  || 0,
    currentPrice: Number(r[9])  || 0,
    opBuy:        Number(r[8])  || 0,
    opCurrent:    Number(r[10]) || 0,
    opProfit:     Number(r[11]) || 0,
    profitRate:   Number(r[12]) || 0,
    change,
    changePct:    (changePct >= 0 ? '+' : '') + Number(changePct).toFixed(2) + '%',
    m1:           ex.m1Pct != null ? Number(ex.m1Pct) : 0,
    m3:           ex.m3Pct != null ? Number(ex.m3Pct) : 0,
    m6:           ex.m6Pct != null ? Number(ex.m6Pct) : 0,
    y1:           ex.y1Pct != null ? Number(ex.y1Pct) : 0,
    high52:       Number(ex.high52) || 0,
    low52:        Number(ex.low52)  || 0,
    buyDate:      buyDateMap[key] || null,
  };
}

function _mGetBuyDates(ss) {
  const result = {};
  const ledger = ss.getSheetByName(NS.LEDGER);
  if (!ledger || ledger.getLastRow() < 2) return result;

  const rows = ledger.getRange(2, 1, ledger.getLastRow() - 1, 12).getValues();
  const posMap = {};
  for (const row of rows) {
    const type = String(row[1]);
    if (type !== '매수' && type !== '매도') continue;
    const date = row[0] instanceof Date
      ? Utilities.formatDate(row[0], 'Asia/Seoul', 'yyyy-MM-dd')
      : String(row[0]).slice(0, 10);
    const code   = String(row[2] || '');
    const name   = String(row[3] || '');
    const broker = String(row[5] || '');
    const acct   = String(row[6] || '');
    const qty    = Number(row[7]) || 0;
    const key    = code + '||' + name + '||' + broker + '||' + acct;
    if (!posMap[key]) posMap[key] = { qty: 0, firstDate: '' };
    const p = posMap[key];
    if (type === '매수') {
      if (p.qty <= 0) p.firstDate = date;
      p.qty += qty;
    } else {
      p.qty -= qty;
    }
  }
  Object.entries(posMap).forEach(([k, v]) => {
    if (v.qty > 0.0001) result[k] = v.firstDate;
  });
  return result;
}

function _mGetFxRates(ss) {
  try {
    const sheet = ss.getSheetByName(NS.SETTINGS);
    if (!sheet) return { usd: 1400, gbp: 1700 };
    return {
      usd: Number(sheet.getRange(2, 2).getValue()) || 1400,
      gbp: Number(sheet.getRange(3, 2).getValue()) || 1700,
    };
  } catch (e) { return { usd: 1400, gbp: 1700 }; }
}

/**
 * 비주식 자산 — *보유현황*의 KIS_SKIP 카테고리(펀드·예금·보험·기타)
 * holdings 응답에서는 빠져있어서 별도 노출. 카테고리·계좌·금액 보존.
 * allPosRows는 newMobileGetPortfolio가 이미 ['합계' 제외 + quantity>0] 필터한 전체.
 */
function _mGetNonStockAssets(allPosRows) {
  try {
    const items = [];
    let total = 0;
    for (const r of allPosRows) {
      const category = String(r[2] || '').trim();
      if (!NS.KIS_SKIP.includes(category)) continue;
      const item = {
        category,
        name:     String(r[1] || ''),
        broker:   String(r[3] || ''),
        account:  String(r[4] || ''),
        quantity: Number(r[6]) || 0,
        opBuy:    Number(r[8]) || 0,
        value:    Number(r[10]) || 0,
        opProfit: Number(r[11]) || 0,
        profitRate: Number(r[12]) || 0,
      };
      items.push(item);
      total += item.value;
    }
    return { items, total };
  } catch (e) {
    Logger.log('_mGetNonStockAssets 오류: ' + e);
    return { items: [], total: 0 };
  }
}

/**
 * *설정* 시트 A7:E12 — 사용자 수동 입력 대기자금
 *   A:증권사  B:구분  C:대기자금  D:비고  E:업데이트 날짜(자동 스탬프)
 * 합계는 코드에서 자체 계산 (시트 C13 SUM 수식과 일치해야 함).
 */
function _mGetCashReserve(ss) {
  try {
    const sheet = ss.getSheetByName(NS.SETTINGS);
    if (!sheet) return { items: [], total: 0 };
    const range = sheet.getRange(7, 1, 6, 5).getValues();
    const items = [];
    let total = 0;
    for (const row of range) {
      const broker  = String(row[0] || '').trim();
      const account = String(row[1] || '').trim();
      const amount  = Number(row[2]) || 0;
      const note    = String(row[3] || '').trim();
      const stamp   = row[4];
      if (!broker && !account && amount === 0) continue;
      items.push({
        broker, account, amount, note,
        updatedAt: stamp instanceof Date
          ? Utilities.formatDate(stamp, 'Asia/Seoul', 'yyyy-MM-dd HH:mm')
          : String(stamp || ''),
      });
      total += amount;
    }
    return { items, total };
  } catch (e) {
    Logger.log('_mGetCashReserve 오류: ' + e);
    return { items: [], total: 0 };
  }
}

// *추이 기록* U열에서 "어제 거래일" 행을 찾아 AE(합계 변동)/AF(합계 변동률) 반환
// 어제 거래일 = (오늘 - 1일)에서 주말/공휴일을 건너뛴 가장 가까운 평일
// 매칭 행 없으면 null (클라이언트는 0원으로 fallback)
function _mFindPrevDayProfitChange(trendSht) {
  if (!trendSht || trendSht.getLastRow() < 5) return { amount: null, pct: null };

  const pFirstRow = 5, pStartCol = 21;  // U
  const lastRow = trendSht.getLastRow();
  const height = lastRow - pFirstRow + 1;
  if (height <= 0) return { amount: null, pct: null };

  const today = new Date();
  let target = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  for (let safety = 0; safety < 14; safety++) {
    if (target.getDay() !== 0 && target.getDay() !== 6 && !_isKoreanHoliday(target)) break;
    target.setDate(target.getDate() - 1);
  }
  const targetStr = Utilities.formatDate(target, 'Asia/Seoul', 'yyyy-MM-dd');

  const data = trendSht.getRange(pFirstRow, pStartCol, height, 12).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    const dStr = String(data[i][0] || '').slice(0, 10);
    if (dStr === targetStr) {
      const ae = data[i][10];  // AE = idx 10 (합계 변동)
      const af = data[i][11];  // AF = idx 11 (합계 변동률)
      const aeN = Number(String(ae || '').replace(/,/g, ''));
      // AF도 '+X.XX%'(텍스트)/음수 분수(numeric) 혼합 — 숫자면 ×100 후 재포맷 (errors.md 2026-07-16 % 셀 비대칭)
      let pct = null;
      if (typeof af === 'number') {
        const p = af * 100;
        pct = (p >= 0 ? '+' : '') + p.toFixed(2) + '%';
      } else {
        const afS = String(af || '').trim();
        pct = afS ? ((afS.startsWith('+') || afS.startsWith('-')) ? afS : '+' + afS) : null;
      }
      return { amount: isNaN(aeN) ? null : aeN, pct: pct };
    }
  }
  return { amount: null, pct: null };
}

// _isKoreanHoliday(date) 는 Holidays.js 로 이동 (*휴장일* 시트 단일 소스)

// 'yyyy-MM-dd' 문자열이 거래일(주말·공휴일 아님)인지 판정
function _isTradingDateStr(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split('-');
  // 정오로 생성 → 스크립트 TZ가 Asia/Seoul이 아니어도 날짜가 밀리지 않음
  const d  = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
  const wd = d.getDay();           // 0=일, 6=토
  if (wd === 0 || wd === 6) return false;
  return !_isKoreanHoliday(d);
}

function _mIsMarketDay() {
  const now     = new Date();
  const tz      = 'Asia/Seoul';
  const weekday = parseInt(Utilities.formatDate(now, tz, 'u'));
  if (weekday >= 6) return false;
  if (_isKoreanHoliday(now)) return false;
  const hhmm = parseInt(Utilities.formatDate(now, tz, 'HHmm'), 10);
  return hhmm >= 900 && hhmm <= 1530;
}

function _mIsTradingDay() {
  const now     = new Date();
  const tz      = 'Asia/Seoul';
  const weekday = parseInt(Utilities.formatDate(now, tz, 'u'));
  if (weekday >= 6) return false;
  if (_isKoreanHoliday(now)) return false;
  return true;
}

function _mGroupBy(posRows, colIdx, totalCur) {
  const map = {};
  posRows.forEach(r => {
    const key = String(r[colIdx] || '기타');
    if (!map[key]) map[key] = { buy: 0, current: 0, profit: 0, count: 0 };
    map[key].buy     += Number(r[8])  || 0;
    map[key].current += Number(r[10]) || 0;
    map[key].profit  += Number(r[11]) || 0;
    map[key].count++;
  });
  const result = {};
  Object.entries(map).forEach(([k, v]) => {
    result[k] = {
      buy:        v.buy,
      current:    v.current,
      profit:     v.profit,
      count:      v.count,
      profitRate: v.buy > 0 ? v.profit / v.buy * 100 : 0,
      pct:        totalCur > 0 ? v.current / totalCur * 100 : 0,
    };
  });
  return result;
}

// ── 참고지표 헬퍼 ────────────────────────────────────────

function _newGetYahooFinanceQuote(symbol) {
  if (!symbol) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;
    const res = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoogleAppsScript)' },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return null;
    const meta = JSON.parse(res.getContentText())?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || meta.previousClose || price;
    const change    = price - prev;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;
    return { value: price, change, changePct };
  } catch (e) {
    Logger.log(`Yahoo Finance 오류(${symbol}): ${e}`);
    return null;
  }
}

function _newFillGoogleFinanceIndicators(ss, results) {
  const gfItems = results.filter(r => r.source === 'googlefinance');
  if (gfItems.length === 0) return;
  let tempSheet = ss.getSheetByName('Temp');
  if (!tempSheet) { tempSheet = ss.insertSheet('Temp'); tempSheet.hideSheet(); }
  const START_COL = 27, START_ROW = 1;
  const formulas = gfItems.map(item => [
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","price"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","change"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","changepct"),"")`,
  ]);
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).setFormulas(formulas);
  SpreadsheetApp.flush();
  Utilities.sleep(1500);
  const values = tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).getValues();
  gfItems.forEach((item, idx) => {
    const v = values[idx];
    const price = Number(v[0]) || 0;
    if (price > 0) {
      const divisor = item.key === 'TNX' ? 10 : 1;
      item.value     = price / divisor;
      item.change    = (Number(v[1]) || 0) / divisor;
      item.changePct = Number(v[2]) || 0;
    }
  });
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).clearContent();
}

function _newFillMissingWithYahooFinance(results) {
  results.filter(r => (!r.value || r.value <= 0) && r.ySymbol).forEach(item => {
    const q = _newGetYahooFinanceQuote(item.ySymbol);
    if (q && q.value > 0) { item.value = q.value; item.change = q.change; item.changePct = q.changePct; }
  });
}

function _newFillMissingWithGoogleFinance(ss, results) {
  const missing = results.filter(r => r.source !== 'googlefinance' && (!r.value || r.value <= 0) && r.gfSymbol);
  if (missing.length === 0) return;
  let tempSheet = ss.getSheetByName('Temp');
  if (!tempSheet) { tempSheet = ss.insertSheet('Temp'); tempSheet.hideSheet(); }
  const START_COL = 31, START_ROW = 1;
  const formulas = missing.map(item => [
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","price"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","change"),"")`,
    `=IFERROR(GOOGLEFINANCE("${item.gfSymbol}","changepct"),"")`,
  ]);
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).setFormulas(formulas);
  SpreadsheetApp.flush();
  Utilities.sleep(1500);
  const values = tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).getValues();
  missing.forEach((item, idx) => {
    const price = Number(values[idx][0]) || 0;
    if (price > 0) { item.value = price; item.change = Number(values[idx][1]) || 0; item.changePct = Number(values[idx][2]) || 0; }
  });
  tempSheet.getRange(START_ROW, START_COL, formulas.length, 3).clearContent();
}

function _newEnsureIndicatorsSheet(ss) {
  let sheet = ss.getSheetByName('참고지표');
  if (!sheet) {
    sheet = ss.insertSheet('참고지표');
    sheet.getRange(1, 1, 1, 7).setValues([['키','지표명','카테고리','현재값','등락','등락률(%)','갱신시간']])
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _newEnsureIndicatorsHistorySheet(ss) {
  let sheet = ss.getSheetByName('참고지표_히스토리');
  if (!sheet) {
    sheet = ss.insertSheet('참고지표_히스토리');
    const header = ['날짜', '시간', ...NEW_REFERENCE_INDICATORS.map(d => d.name)];
    sheet.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _newUpsertIndicatorsHistory(sheet, today, hhmmss, results) {
  const lastRow = sheet.getLastRow();
  let existingRow = 0;
  if (lastRow >= 2) {
    const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      if (String(dates[i][0]) === today) { existingRow = i + 2; break; }
    }
  }
  const row = [today, hhmmss, ...results.map(r => r.value)];
  sheet.getRange(existingRow || (lastRow + 1), 1, 1, row.length).setValues([row]);
}
