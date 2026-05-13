/**
 * Main.js — 새 시스템 메뉴 및 트리거 (독립 버전)
 */

function onOpen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 메뉴 생성 (모든 업데이트 항목은 menuXxx wrapper 로 — Lock 통과)
  SpreadsheetApp.getUi()
    .createMenu('📊 뉴시스템')
    .addItem('🔄 전체 업데이트 (가격 + 보유현황 + 대시보드)', 'menuUpdateAll')
    .addItem('💹 현재가만 업데이트', 'menuUpdatePricesOnly')
    .addItem('📈 1M~1Y 히스토리 갱신 (수동)', 'menuUpdateHistory')
    .addItem('📋 보유현황 재계산', 'updatePositionFromLedger')
    .addItem('📊 대시보드 갱신', 'buildDashboard')
    .addItem('🔬 분석 대시보드 갱신', 'buildAnalysisDashboard')
    .addSeparator()
    .addItem('⚙️ 대기자금 입력란 생성 (1회)', 'setupPendingCashSection')
    .addToUi();

  // 시트 열 때 대시보드 자동 활성화
  const dash = ss.getSheetByName(DB.SHEET);
  if (dash) ss.setActiveSheet(dash);
}

// ══════════════════════════════════════════
//  Lock helper (진입점에서만 사용 — 내부 함수에는 lock 두지 않음)
// ══════════════════════════════════════════

/**
 * 모든 업데이트 진입점에서 동시 실행 차단.
 * 이미 lock 잡힌 상태면 toast/log 후 즉시 종료.
 */
function _withUpdateLock(label, fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    const msg = '이미 업데이트가 진행 중입니다. 잠시 후 다시 시도해주세요.';
    Logger.log(`${label}: ${msg}`);
    try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, '⚠️', 5); } catch (_) {}
    return;
  }
  try {
    fn();
  } finally {
    lock.releaseLock();
  }
}

function onEdit(e) {
  _handleFormOnEdit(e);
  _handleDashSortChange(e);
}

// ══════════════════════════════════════════
//  메인 업데이트 함수
// ══════════════════════════════════════════

/**
 * 전체 업데이트: KIS 가격 → *현재가_이력* → *보유현황* → *대시보드*
 */
function updateAllNew() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('환율 + 현재가 업데이트 중...', '🔄 전체 업데이트', 60);
  try {
    updateFxRates(ss);
    updateNewPriceHistory(ss);
    updatePositionFromLedger();
    buildAnalysisDashboard();
    ss.toast('전체 업데이트 완료', '✅', 4);
  } catch (e) {
    ss.toast('오류: ' + e.message, '❌', 5);
    Logger.log('updateAllNew 오류: ' + e);
  }
}

function menuUpdateAll() {
  _withUpdateLock('menuUpdateAll', updateAllNew);
}

function menuUpdatePricesOnly() {
  _withUpdateLock('menuUpdatePricesOnly', () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.toast('현재가 업데이트 중...', '💹', 60);
    try {
      updateNewPriceHistory(ss);
      ss.toast('현재가 업데이트 완료', '✅', 4);
    } catch (e) {
      ss.toast('오류: ' + e.message, '❌', 5);
      Logger.log('menuUpdatePricesOnly 오류: ' + e);
    }
  });
}

// ══════════════════════════════════════════
//  트리거 관리
// ══════════════════════════════════════════

function menuUpdateHistory() {
  _withUpdateLock('menuUpdateHistory', () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.toast('1M~1Y 히스토리 갱신 중 (1~2분 소요)...', '📈', 120);
    try {
      updateNewStockHistory(ss);
      updatePositionFromLedger();
      buildDashboard();
      buildAnalysisDashboard();
      ss.toast('히스토리 갱신 완료', '✅', 4);
    } catch (e) {
      ss.toast('오류: ' + e.message, '❌', 5);
      Logger.log('menuUpdateHistory 오류: ' + e);
    }
  });
}

/** 매일 7:55 히스토리 갱신 트리거 (장 전) */
function scheduledHistoryUpdate() {
  _withUpdateLock('scheduledHistoryUpdate',
    () => updateNewStockHistory(SpreadsheetApp.getActiveSpreadsheet()));
}

/** 매일 17:30 현재가 + 보유현황 + 대시보드 트리거 (장 마감 후) */
function scheduledDailyUpdate() {
  _withUpdateLock('scheduledDailyUpdate', updateAllNew);
}

function setupTriggers() {
  // 기존 트리거 전부 삭제
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // 7:55 히스토리
  ScriptApp.newTrigger('scheduledHistoryUpdate')
    .timeBased().atHour(7).nearMinute(55).everyDays(1).create();

  // 17:30 현재가·보유현황·대시보드
  ScriptApp.newTrigger('scheduledDailyUpdate')
    .timeBased().atHour(17).nearMinute(30).everyDays(1).create();

  Logger.log('트리거 설정 완료: 7:55 히스토리 + 17:30 전체');
}

function deleteTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('모든 트리거 삭제 완료');
}
