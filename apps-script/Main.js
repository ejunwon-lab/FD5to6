/**
 * Main.gs
 * 핵심 실행 로직 및 메뉴 구성
 */
let IS_FULL_UPDATE_RUNNING = false;
let _IS_MOBILE_CALL = false;

/**
 * Named Range 일괄 설정 함수 (최초 1회만 실행)
 * 메뉴: 🛠️ 시스템 관리 → Named Range 초기 설정
 */
function setupNamedRanges() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = CONFIG.SHEET_NAMES.TRACKER;

  const definitions = [
    { name: CONFIG.NAMED_RANGES.ACTIVE_HEADER,    a1: `${sheetName}!A5:Z5`   },
    { name: CONFIG.NAMED_RANGES.ACTIVE_TOTAL,     a1: `${sheetName}!A40:Z40` },
    { name: CONFIG.NAMED_RANGES.SOLD_HEADER,      a1: `${sheetName}!A42:Z43` },
    { name: CONFIG.NAMED_RANGES.FX_USD,           a1: `${sheetName}!Q2`      },
    { name: CONFIG.NAMED_RANGES.FX_GBP,           a1: `${sheetName}!Q1`      },
    { name: CONFIG.NAMED_RANGES.TREND_OP_TOTAL,   a1: `${sheetName}!AL11`    },
    { name: CONFIG.NAMED_RANGES.TREND_PEND_TOTAL, a1: `${sheetName}!AK21`    },
  ];

  // 기존 Named Range 목록 (이름 기준 맵)
  const existing = {};
  ss.getNamedRanges().forEach(nr => { existing[nr.getName()] = nr; });

  const results = definitions.map(({ name, a1 }) => {
    try {
      const range = ss.getRange(a1);
      if (existing[name]) {
        existing[name].setRange(range);
        return `✏️ 수정: ${name}`;
      } else {
        ss.setNamedRange(name, range);
        return `✅ 생성: ${name}`;
      }
    } catch (e) {
      return `❌ 실패: ${name} — ${e.message}`;
    }
  });

  clearTrackerColumnCache();
  SpreadsheetApp.getUi().alert('Named Range 설정 완료\n\n' + results.join('\n'));
}
function updateAllFinanceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_IS_MOBILE_CALL) ss.toast("현재가 및 환율 정보를 갱신 중입니다...", "🔄 가격 갱신");
  const mainSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRACKER);
  const chartSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CHART);
  
  if (!mainSheet) return;
  // 0. 토큰 사전 준비
  KIS_API.ensureToken();
  // 1. 환율 업데이트
  const usdCell = getNamedRange(ss, CONFIG.NAMED_RANGES.FX_USD);
  const gbpCell = getNamedRange(ss, CONFIG.NAMED_RANGES.FX_GBP);
  
  usdCell.setFormula('=GOOGLEFINANCE("CURRENCY:USDKRW")');
  gbpCell.setFormula('=GOOGLEFINANCE("CURRENCY:GBPKRW")');
  SpreadsheetApp.flush();
  Utilities.sleep(300);
  let usdRate = usdCell.getValue();
  if (typeof usdRate !== "number" || isNaN(usdRate)) usdRate = 1400;
  
  let gbpRate = gbpCell.getValue();
  if (typeof gbpRate !== "number" || isNaN(gbpRate)) gbpRate = 1800;
  
  usdCell.setValue(usdRate);
  gbpCell.setValue(gbpRate);
  // 2. 환율 차트 기록
  if (chartSheet) {
    const nowStr = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    chartSheet.getRange("A999").setValue(`USD/KRW (${nowStr})`);
    chartSheet.getRange("B999").setValue(usdRate);
    chartSheet.getRange("A998").setValue(`GBP/KRW (${nowStr})`);
    chartSheet.getRange("B998").setValue(gbpRate);
  }
  // 3. ETF/주식 가격 업데이트
  const lastRow = mainSheet.getLastRow();
  if (lastRow < 6) return;
  const fallbackList = [];
  
  // [1단계] 업데이트 대상 및 현재 가격 데이터 수집
  const cols     = getTrackerColumns(ss);
  const { startRow: START_ROW, endRow: DATA_END } = getTrackerActiveData(ss);
  const numRows  = DATA_END - START_ROW + 1;

  // 전체 가격 데이터(현재단가 열) 미리 읽기 (덮어쓰기 방지 위해 원본 보존)
  const priceRange = mainSheet.getRange(START_ROW, cols.CURRENT_PRICE, numRows, 1);
  const priceValues = priceRange.getValues();

  // 코드와 이름 읽기
  const codes = mainSheet.getRange(START_ROW, cols.CODE,        numRows, 1).getValues();
  const names = mainSheet.getRange(START_ROW, cols.STATUS_NAME, numRows, 1).getValues();
  
  const koreanCodes = [];
  const updateTargets = [];
  for (let i = 0; i < numRows; i++) {
    let code = codes[i][0];
    const name = names[i][0];
    
    code = code ? code.toString().trim().toUpperCase() : '';
    
    // A열에 코드가 없으면 업데이트 대상에서 완전 제외
    if (!code) continue;
    const isUS = /^[A-Z]{1,5}$/.test(code);
    const isKorean = !isUS; 
    
    if (isKorean) {
      koreanCodes.push(code);
    }
    
    updateTargets.push({
      idx: i, // priceValues 배열 내 인덱스
      code: code,
      name: name || code,
      isKorean: isKorean,
      isUS: isUS
    });
  }
  
  // 병렬 API 호출 (한국 주식)
  let kisPriceMap = {};
  if (koreanCodes.length > 0) {
    try {
      kisPriceMap = KIS_API.getKisPricesBatch(koreanCodes);
    } catch (e) {
      Logger.log("KIS Batch Error: " + e);
    }
  }
  // [2단계] 수집된 대상만 가격 정보 결정
  for (const target of updateTargets) {
    try {
      let price = null;
      
      // 1. 한국 주식
      if (target.isKorean) {
        if (kisPriceMap.hasOwnProperty(target.code) && kisPriceMap[target.code] !== null && kisPriceMap[target.code] > 0) {
          price = kisPriceMap[target.code];
        } else {
          // KIS 실패 시 Naver 시도
          const nInfo = getNaverStockInfo(target.code);
          if (nInfo && nInfo.price) {
            price = nInfo.price;
            fallbackList.push(`${target.name}(Naver)`);
          }
        }
      } 
      // 2. 미국 주식 (KIS 개별 조회)
      else if (target.isUS) {
        const info = KIS_API.getOverseasStockInfoAuto(target.code);
        if (info && info.price) {
          price = Math.round(info.price * usdRate);
        }
      }
      // 3. 값 할당 (가져온 가격이 있으면 쓰고, 없으면 기존 수식/값 유지 시도)
      if (price) {
        priceValues[target.idx][0] = price;
      } else {
        // 새로 값이 없는데 기존에 수식이 없거나 오류 상황이면 구글 파이낸스 수식이라도 사용
        const currentVal = String(priceValues[target.idx][0]);
        if (!currentVal || currentVal.includes('오류') || currentVal === '0') {
          const formula = target.isUS 
            ? `=IFERROR(GOOGLEFINANCE("NASDAQ:${target.code}","price")*${usdRate}, IFERROR(GOOGLEFINANCE("NYSE:${target.code}","price")*${usdRate},""))`
            : `=IFERROR(GOOGLEFINANCE("KRX:${target.code}","price"), IFERROR(GOOGLEFINANCE("KOSDAQ:${target.code}","price"),""))`;
          priceValues[target.idx][0] = formula;
          if (!target.isUS) fallbackList.push(`${target.name}(Google)`);
        }
      }
    } catch (e) {
      Logger.log(`Target ${target.code} update error: ${e.message}`);
    }
  }
  // [3단계] M열 전체 일괄 업데이트 (대상인 행만 수정된 배열을 다시 씀)
  priceRange.setValues(priceValues);
  
  SpreadsheetApp.flush();
  
  // 4. 후속 기록 (통합 실행 중이 아닐 때만)
  if (!IS_FULL_UPDATE_RUNNING) {
    logToTrendSheet(ss);
    updatePerformanceAnalysis(ss);
  }
  // 5. 알림창 띄우기 (통합 실행 중이 아닐 때만)
  if (fallbackList.length > 0 && !IS_FULL_UPDATE_RUNNING && !_IS_MOBILE_CALL) {
    SpreadsheetApp.getUi().alert(`⚠️ KIS 조회 실패로 아래 종목은 백업 데이터를 사용했습니다.\n\n${fallbackList.join(', ')}`);
  }
  return fallbackList;
}
function runFullUpdate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = _IS_MOBILE_CALL ? null : SpreadsheetApp.getUi();
  let fallbackList = [];
  try {
    IS_FULL_UPDATE_RUNNING = true;
    
    fallbackList = updateAllFinanceData();
    SpreadsheetApp.flush();

    // [추가] 종목 현황 전체 업데이트
    updateStockStatusAuto();
    SpreadsheetApp.flush();

    if (!_IS_MOBILE_CALL) ss.toast("오늘의 자산을 기록 중입니다...", "📜 추이 기록");
    logToTrendSheet(ss);
    SpreadsheetApp.flush();

    if (!_IS_MOBILE_CALL) ss.toast("투자 성과를 분석 중입니다...", "📊 성과 분석");
    updatePerformanceAnalysis(ss);
    SpreadsheetApp.flush();

    if (!_IS_MOBILE_CALL) ss.toast("추이 그래프를 생성 중입니다...", "📈 그래프 생성");
    drawTrendChart();
    SpreadsheetApp.flush();

    // [추가] 참고지표 갱신
    if (!_IS_MOBILE_CALL) ss.toast("참고지표를 갱신 중입니다...", "📊 참고지표");
    try {
      updateReferenceIndicators();
      SpreadsheetApp.flush();
    } catch (e) {
      Logger.log("참고지표 갱신 실패: " + e);
    }

    if (!_IS_MOBILE_CALL) {
      let msg = "✅ 통합 업데이트 완료!\n(가격·종목현황·추이·성과·그래프 모두 최신화되었습니다.)";
      if (fallbackList && fallbackList.length > 0) {
        msg += `\n\n⚠️ KIS 조회 실패로 백업 데이터 사용:\n${fallbackList.join(', ')}`;
      }
      ui.alert(msg);
    }
  } catch (err) {
    if (!_IS_MOBILE_CALL) ui.alert("❌ 통합 업데이트 중 오류 발생: " + err.message);
  } finally {
    IS_FULL_UPDATE_RUNNING = false;
  }
}
/**
 * 통합된 onOpen 함수
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // 메인 메뉴
  ui.createMenu('📈 업데이트 고고')
    .addItem('🚀 통합 업데이트 고고', 'runFullUpdate')
    .addSeparator()
    .addItem('🔄 가격 갱신', 'updateAllFinanceData')
    .addItem('✅ 종목 현황 업데이트 (전체)', 'updateStockStatusAuto')
    .addItem('🔵 종목현황 업데이트 (빠른)', 'updateStockStatusQuick')
    .addItem('📊 추이 그래프 그리기', 'drawTrendChart')
    .addSeparator()
    .addItem('🌐 참고지표 갱신', 'updateReferenceIndicators')
    .addToUi();
  // 투자 분석 메뉴
  ui.createMenu("💹 투자 분석 도구")
    .addItem("🧩 데이터 새로고침", "refreshInvestmentAnalysis")
    .addSeparator()
    .addItem("📈 수익률(높은순)", "menuSortRate")
    .addItem("💰 운용수익(높은순)", "menuSortProfit")
    .addItem("💳 운용매입(높은순)", "menuSortBuy")
    .addItem("📊 운용현재가(높은순)", "menuSortNow")
    .addToUi();
  
  // 거래 입력 메뉴
  ui.createMenu("💳 거래 관리")
    .addItem("📝 거래 입력 시트 열기", "openTransactionSheet")
    .addItem("🔧 거래 입력 시트 생성", "createTransactionSheet")
    .addToUi();
  // 시스템 관리 메뉴
  ui.createMenu("🛠️ 시스템 관리")
    .addItem("⚙️ 설정 시트 열기", "openSettingsSheet")
    .addItem("🗂️ Named Range 초기 설정", "setupNamedRanges")
    .addSeparator()
    .addItem("🔍 KIS 시스템 진단", "debugKISAPI")
    .addItem("⚡ KIS 포트 자동 수정", "quickFixKIS")
    .addItem("🔑 토큰 강제 갱신", "forceRefreshToken")
    .addItem("📡 API 연결 테스트", "testApiConnection")
    .addItem("📋 토큰 상태 확인", "checkCurrentToken")
    .addSeparator()
    .addItem("⏰ 매일 8:30 자동실행 등록", "setupDailyTrigger")
    .addItem("🗑️ 자동실행 트리거 삭제", "deleteDailyTrigger")
    .addSeparator()
    .addItem("📅 종목현황 8:30/17:30 자동실행 등록", "setupHoldingsTriggers")
    .addItem("🗑️ 종목현황 자동실행 트리거 삭제", "deleteHoldingsTriggers")
    .addToUi();
  // 1. 매번 새로 시작할 때, 투자수익 트래커 시트에서 시작
  const trackerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('투자수익 트래커');
  if (trackerSheet) {
    trackerSheet.activate();
  }
}
/**
 * 매일 오전 8:30 통합 업데이트 트리거 등록
 * 시스템 관리 메뉴에서 1회 실행 (이후 자동 반복)
 */
function setupDailyTrigger() {
  // 기존 runFullUpdate 트리거 삭제 (중복 방지)
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runFullUpdate')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('runFullUpdate')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(30)
    .inTimezone('Asia/Seoul')
    .create();

  SpreadsheetApp.getUi().alert('✅ 매일 오전 8:30 통합 업데이트 트리거가 등록되었습니다.');
}

/**
 * 매일 자동 통합 업데이트 트리거 삭제
 */
function deleteDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runFullUpdate');
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getUi().alert(`🗑️ runFullUpdate 트리거 ${triggers.length}개 삭제 완료`);
}

/**
 * 종목현황 자동 업데이트 트리거 등록 (8:30 + 17:30 KST)
 * 1M/3M/1Y 수익률은 하루 2회로 충분하므로 updateStockStatusAuto만 실행
 */
function setupHoldingsTriggers() {
  // 기존 scheduledHoldingsUpdate 트리거 삭제 (중복 방지)
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'scheduledHoldingsUpdate')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('scheduledHoldingsUpdate')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(30)
    .inTimezone('Asia/Seoul')
    .create();

  ScriptApp.newTrigger('scheduledHoldingsUpdate')
    .timeBased()
    .everyDays(1)
    .atHour(17)
    .nearMinute(30)
    .inTimezone('Asia/Seoul')
    .create();

  SpreadsheetApp.getUi().alert('✅ 종목현황 자동 업데이트 트리거 등록 완료\n- 매일 오전 8:30 (KST)\n- 매일 오후 5:30 (KST)');
}

/**
 * 종목현황 자동 업데이트 트리거 삭제
 */
function deleteHoldingsTriggers() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'scheduledHoldingsUpdate');
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getUi().alert(`🗑️ 종목현황 트리거 ${triggers.length}개 삭제 완료`);
}

/**
 * 스케줄 실행용 종목현황 업데이트 (1M/3M/1Y 포함 전체)
 * 트리거에서 직접 호출 — UI 없음
 */
function scheduledHoldingsUpdate() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateStockStatusAuto();
    SpreadsheetApp.flush();
    logToTrendSheet(ss);
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log('scheduledHoldingsUpdate 오류: ' + e);
  }
}

function onEdit(e) {
  _handleFormOnEdit(e); // *거래_입력폼* 체크박스 처리

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  // ⚙️ 설정 시트 체크박스 감지 → 설정 적용
  if (sheetName === SETUP_SHEET_NAME &&
      e.range.getRow() === 1 && e.range.getColumn() === 1 &&
      e.range.getValue() === true) {
    applySettings();
    return;
  }

  if (sheetName !== CONFIG.SHEET_NAMES.TRACKER) return;
  if (e.range.getColumn() !== CONFIG.EXTRA_COLS.TARGET) return;

  const row = e.range.getRow();
  const value = e.range.getValue();
  const timeZone = Session.getScriptTimeZone() || 'Asia/Seoul';

  if (typeof value === 'number' && !isNaN(value)) {
    setValue(sheet, row, CONFIG.EXTRA_COLS.DATE, Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd'));
  } else if (value === '' || value === null) {
    setValue(sheet, row, CONFIG.EXTRA_COLS.DATE, '');
  }
}