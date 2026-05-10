/**
 * KIS_StockStatus.gs
 * KIS API 전용 종목 현황 업데이트 (완전히 새로운 버전)
 */

/**
 * 빠른 업데이트 (수동 실행용)
 * 현재가, 당일 등락, 52주 최고/최저만 업데이트
 */
function updateStockStatusQuick() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast("주요 정보를 빠르게 갱신합니다...", "🔵 종목현황 업데이트(빠른)");
  const sheet = ss.getSheetByName('투자수익 트래커');
  
  if (!sheet) {
    if (!_IS_MOBILE_CALL) SpreadsheetApp.getUi().alert('투자수익 트래커 시트를 찾을 수 없습니다.');
    return;
  }

  // 0. 토큰 사전 준비
  KIS_API.ensureToken();

  const { values, idx, range } = getTrackerActiveData(ss);

  if (values.length === 0) {
    ss.toast("업데이트할 종목이 없습니다.", "완료");
    return;
  }

  const START_ROW = range.getRow();

  // 결과 저장용 배열
  const prices = [];
  const changes = [];
  const pcts = [];
  const highs = [];
  const lows = [];

  const EXCLUDE_KEYWORDS = CONFIG.CODES.EXCLUDE_KEYWORDS;
  const FX_RATE = getNamedRange(ss, CONFIG.NAMED_RANGES.FX_USD).getValue() || 1400;

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const code = row[idx.CODE];
    const name = row[idx.STATUS_NAME];

    // 기본값 (기존 값 유지 또는 빈 값)
    let vPrice = row[idx.CURRENT_PRICE];
    let vChange = row[idx.STATUS_CHANGE];
    let vPct    = row[idx.STATUS_PCT];
    let vHigh   = row[idx.STATUS_HIGH52];
    let vLow    = row[idx.STATUS_LOW52];

    // S열이 'FIN'이면 더 이상 업데이트하지 않고 종료
    const sValue = row[idx.STATUS_CHANGE];
    if (sValue && String(sValue).trim().toUpperCase() === 'FIN') {
      break;
    }

    let hasCode = (code && String(code).trim());
    let isExcluded = (name && EXCLUDE_KEYWORDS.some(k => String(name).includes(k)));
    
    if (!hasCode) {
       skipCount++;
    } else {
      try {
        const rawCode = String(code).trim().toUpperCase();
        const codeStr = /^A\d{6}$/.test(rawCode) ? rawCode.slice(1) : rawCode;
        const isOverseas = /^[A-Z]{1,5}$/.test(codeStr);
        
        let info = isOverseas 
          ? KIS_API.getOverseasStockInfoAuto(codeStr)
          : KIS_API.getKisStockInfo(codeStr);
        
        // [Fallback] KIS 실패 또는 가격 0인 경우 네이버 금융
        if ((!info || !info.price) && !isOverseas) {
          const naverInfo = getNaverStockInfo(codeStr);
            if (naverInfo && naverInfo.price) {
            info = {
              price: naverInfo.price,
              change: 0, 
              changeRate: 0,
              high52: 0,
              low52: 0
            };
          }
        }
        
        if (info && info.price) {
          const fx = isOverseas ? FX_RATE : 1;
          vPrice = Math.round(info.price * fx);

          // 키워드 제외 대상만 아니면 상세 정보도 업데이트
          if (!isExcluded) {
            vChange = Math.round((info.change || 0) * fx);
            const _pct = info.changeRate || 0;
            vPct = (_pct >= 0 ? '+' : '') + _pct.toFixed(2) + '%';
            vHigh = Math.round((info.high52 || 0) * fx);
            vLow = Math.round((info.low52 || 0) * fx);
          }
          successCount++;
        } else {
          // 조회 실패 시 기존 값 유지 (문자열로 덮어쓰지 않음)
          errorCount++;
        }
      } catch (e) {
        // 예외 발생 시 기존 값 유지
        Logger.log(`조회 오류(${code}): ${e.message}`);
        errorCount++;
      }
      
      // API 과부하 방지 딜레이 (필수)
      Utilities.sleep(50);
    }
    
    // 배열에 저장
    prices.push([vPrice]);
    changes.push([vChange]);
    pcts.push([vPct]);
    highs.push([vHigh]);
    lows.push([vLow]);
  }

  // 일괄 쓰기 (속도 개선: 셀 단위 쓰기 -> 통으로 쓰기)
  const cols = getTrackerColumns(ss);
  if (prices.length > 0) {
    sheet.getRange(START_ROW, cols.CURRENT_PRICE, prices.length,  1).setValues(prices);
    sheet.getRange(START_ROW, cols.STATUS_CHANGE,  changes.length, 1).setValues(changes);
    sheet.getRange(START_ROW, cols.STATUS_PCT,     pcts.length,    1).setValues(pcts);
    sheet.getRange(START_ROW, cols.STATUS_HIGH52,  highs.length,   1).setValues(highs);
    sheet.getRange(START_ROW, cols.STATUS_LOW52,   lows.length,    1).setValues(lows);
  }

  SpreadsheetApp.flush();

  if (!_IS_MOBILE_CALL) {
    SpreadsheetApp.getUi().alert(
      `✅ 빠른 업데이트 완료\n\n` +
      `성공: ${successCount}개\n` +
      `건너뜀: ${skipCount}개\n` +
      `실패: ${errorCount}개`
    );
  }
}

/**
 * 자동 전체 업데이트 (매일 오전 7시 30분)
 * [최적화] 병렬 처리(Batch) 적용으로 속도 극대화
 * [UX 개선] Blocking Alert 제거, Toast 알림 사용
 */
function updateStockStatusAuto() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast("전체 종목의 상세 분석을 진행합니다... (시간 소요)", "✅ 종목현황 업데이트(전체)");
  const sheet = ss.getSheetByName('투자수익 트래커');
  
  if (!sheet) return;
  
  // 0. 토큰 사전 준비
  KIS_API.ensureToken();

  // 시작 알림 (Toast)
  ss.toast('종목 현황 업데이트를 시작합니다... (1/3)', '업데이트 시작', 3);

  const cols = getTrackerColumns(ss);
  const COL_PRICE      = cols.CURRENT_PRICE;
  const COL_CHANGE     = cols.STATUS_CHANGE;
  const COL_CHANGE_PCT = cols.STATUS_PCT;
  const COL_1M         = cols.STATUS_M1;
  const COL_3M         = cols.STATUS_M3;
  const COL_6M         = cols.STATUS_M6;
  const COL_1Y         = cols.STATUS_Y1;
  const COL_HIGH52     = cols.STATUS_HIGH52;
  const COL_LOW52      = cols.STATUS_LOW52;

  const EXCLUDE_KEYWORDS = CONFIG.CODES.EXCLUDE_KEYWORDS;

  // 1. 업데이트 대상 종목 수집
  const targets = [];
  const { values, idx, range: activeRange } = getTrackerActiveData(ss);
  const START_ROW = activeRange.getRow();

  for (let i = 0; i < values.length; i++) {
    const code = values[i][idx.CODE];
    const name = values[i][idx.STATUS_NAME];
    const sCol = values[i][idx.STATUS_CHANGE];
    
    // S열이 'FIN'이면 수집 중단
    if (sCol && String(sCol).trim().toUpperCase() === 'FIN') {
      break;
    }
    
    // A열에 값이 있으면 무조건 수집
    if (!code || !String(code).trim()) continue;

    const rawCode = String(code).trim().toUpperCase();
    const codeStr = /^A\d{6}$/.test(rawCode) ? rawCode.slice(1) : rawCode;
    const isOverseas = /^[A-Z]{1,5}$/.test(codeStr);

    targets.push({
      row: START_ROW + i,
      code: codeStr,
      name: name,
      isOverseas: isOverseas,
      exchange: 'NAS' // 기본값
    });
  }
  
  if (targets.length === 0) {
    ss.toast('업데이트할 종목이 없습니다.', '완료', 3);
    return;
  }

  // 2. 가격 일괄 조회 (병렬 배치)
  ss.toast(`가격 일괄 조회 중... (대상: ${targets.length}개)`, '진행 중 (2/3)', -1);

  const domesticTargets = targets.filter(t => !t.isOverseas);
  const overseasTargets  = targets.filter(t => t.isOverseas);

  const domesticInfoMap = KIS_API.getKisStockInfoBatch(domesticTargets.map(t => t.code));
  const overseasInfoMap  = KIS_API.getOverseasStockInfoBatch(overseasTargets.map(t => t.code));

  const historyRequests = [];
  const priceInfos = {};

  for (const target of targets) {
    let info = target.isOverseas ? overseasInfoMap[target.code] : domesticInfoMap[target.code];

    // 국내 KIS 실패 시 Naver fallback
    if (!info && !target.isOverseas) {
      try {
        const nInfo = getNaverStockInfo(target.code);
        if (nInfo && nInfo.price) {
          info = { price: nInfo.price, change: 0, changeRate: 0, high52: 0, low52: 0, exchange: 'KRX' };
          Logger.log(`[Backup] 네이버 금융 사용: ${target.code} -> ${info.price}`);
        }
      } catch (e) {}
    }

    if (info) {
      priceInfos[target.row] = info;
      historyRequests.push({ code: target.code, isOverseas: target.isOverseas, exchange: info.exchange || 'NAS' });
    }
  }

  // 3. 히스토리 병렬 실행
  ss.toast(`과거 데이터 일괄 조회 중...`, '진행 중 (3/3)', -1);
  const historyMap = KIS_API.fetchAllStockHistory(historyRequests);
  
  // 4. 시트 배치 업데이트
  const usdFxRate = getNamedRange(ss, CONFIG.NAMED_RANGES.FX_USD).getValue() || 1400;

  // 열별 버퍼: colNum → { rowOffset: value }
  const colBuf = {};
  function bufSet(col, rowOffset, val) {
    if (!colBuf[col]) colBuf[col] = {};
    colBuf[col][rowOffset] = val;
  }

  for (const target of targets) {
    const i = target.row;
    const rowOffset = i - START_ROW;
    const info = priceInfos[i];
    if (!info || !info.price) continue;

    try {
      const fx = target.isOverseas ? usdFxRate : 1;
      const isExcluded = (target.name && EXCLUDE_KEYWORDS.some(k => String(target.name).includes(k)));

      bufSet(COL_PRICE, rowOffset, Math.round(info.price * fx));
      if (isExcluded) continue;

      let weeklyH = (historyMap.weekly || historyMap)[target.code] || [];
      let dailyH  = (historyMap.daily  || {})[target.code] || [];
      if (weeklyH.length === 0 && target.isOverseas) {
        try {
          weeklyH = KIS_API.getOverseasDailyPriceFallback(target.code, info.exchange || 'NAS');
        } catch (e) { Logger.log(`[Fallback] 실패(${target.code}): ${e}`); }
      }

      const stats = KIS_API.calculateStats(weeklyH, info.price, dailyH);

      bufSet(COL_CHANGE,     rowOffset, Math.round((info.change || 0) * fx));
      const _pct2 = info.changeRate || 0;
      bufSet(COL_CHANGE_PCT, rowOffset, (_pct2 >= 0 ? '+' : '') + _pct2.toFixed(2) + '%');

      if (stats) {
        bufSet(COL_HIGH52, rowOffset, Math.round((info.high52 || stats.high52) * fx));
        bufSet(COL_LOW52,  rowOffset, Math.round((info.low52  || stats.low52)  * fx));
        bufSet(COL_1M, rowOffset, stats.return1M);
        bufSet(COL_3M, rowOffset, stats.return3M);
        bufSet(COL_6M, rowOffset, stats.return6M);
        bufSet(COL_1Y, rowOffset, stats.return1Y);
      } else {
        if (!target.isOverseas) {
          bufSet(COL_HIGH52, rowOffset, Math.round((info.high52 || 0) * fx));
          bufSet(COL_LOW52,  rowOffset, Math.round((info.low52  || 0) * fx));
        }
        bufSet(COL_1M, rowOffset, '-');
        bufSet(COL_3M, rowOffset, '-');
        bufSet(COL_6M, rowOffset, '-');
        bufSet(COL_1Y, rowOffset, '-');
      }
    } catch (e) { Logger.log(`값 계산 실패(${target.code}): ${e}`); }
  }

  // 열별 연속 구간 묶어서 일괄 쓰기
  Object.entries(colBuf).forEach(([col, offsetMap]) => {
    const offsets = Object.keys(offsetMap).map(Number).sort((a, b) => a - b);
    if (offsets.length === 0) return;
    let runStart = offsets[0], run = [[offsetMap[offsets[0]]]];
    for (let k = 1; k <= offsets.length; k++) {
      if (k < offsets.length && offsets[k] === offsets[k - 1] + 1) {
        run.push([offsetMap[offsets[k]]]);
      } else {
        sheet.getRange(START_ROW + runStart, Number(col), run.length, 1).setValues(run);
        if (k < offsets.length) { runStart = offsets[k]; run = [[offsetMap[offsets[k]]]]; }
      }
    }
  });

  SpreadsheetApp.flush();
  
  Logger.log('전체 자동 업데이트 완료: ' + new Date());
  ss.toast(`총 ${targets.length}개 종목 업데이트 완료!`, '성공', 5);
}

/**
 * 자동 실행 트리거 삭제
 * 이 함수를 실행하면 매일 오전 7시 30분 자동 실행이 해제됨
 */
function deleteAutoTrigger() {
  // 기존 트리거 삭제
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;
  
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'updateStockStatusAuto') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  
  if (deletedCount > 0) {
    SpreadsheetApp.getUi().alert(
      '✅ 자동 실행 트리거 삭제 완료!\n\n' +
      `${deletedCount}개의 트리거가 삭제되었습니다.\n` +
      '이제 매일 오전 7시 30분 자동 업데이트가 실행되지 않습니다.'
    );
  } else {
    SpreadsheetApp.getUi().alert(
      'ℹ️ 삭제할 트리거가 없습니다.\n\n' +
      '현재 설정된 자동 업데이트 트리거가 없습니다.'
    );
  }
}

