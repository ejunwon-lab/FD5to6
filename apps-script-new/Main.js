/**
 * Main.js — 새 시스템 메뉴 및 트리거 (독립 버전)
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 뉴시스템')
    .addItem('🔄 전체 업데이트 (가격 + 보유현황 + 대시보드)', 'updateAllNew')
    .addItem('💹 현재가만 업데이트', 'menuUpdatePricesOnly')
    .addItem('📋 보유현황 재계산', 'updatePositionFromLedger')
    .addItem('📊 대시보드 갱신', 'buildDashboard')
    .addToUi();
}

function onEdit(e) {
  _handleFormOnEdit(e);
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
    ss.toast('전체 업데이트 완료', '✅', 4);
  } catch (e) {
    ss.toast('오류: ' + e.message, '❌', 5);
    Logger.log('updateAllNew 오류: ' + e);
  }
}

function menuUpdatePricesOnly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('현재가 업데이트 중...', '💹', 60);
  try {
    updateNewPriceHistory(ss);
    ss.toast('현재가 업데이트 완료', '✅', 4);
  } catch (e) {
    ss.toast('오류: ' + e.message, '❌', 5);
    Logger.log('menuUpdatePricesOnly 오류: ' + e);
  }
}

// ══════════════════════════════════════════
//  트리거 관리
// ══════════════════════════════════════════

/** 매일 17:30 자동 업데이트 트리거 (장 마감 후) */
function scheduledDailyUpdate() {
  updateAllNew();
}

function setupDailyTrigger() {
  deleteDailyTrigger();
  ScriptApp.newTrigger('scheduledDailyUpdate')
    .timeBased()
    .atHour(18)
    .nearMinute(0)
    .everyDays(1)
    .create();
  Logger.log('트리거 설정 완료: 매일 17:30 scheduledDailyUpdate');
  SpreadsheetApp.getActiveSpreadsheet()
    .toast('매일 17:30 자동 업데이트 트리거 설정 완료', '⏰', 4);
}

function deleteDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'scheduledDailyUpdate')
    .forEach(t => ScriptApp.deleteTrigger(t));
}
