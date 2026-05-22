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
    .addSeparator()
    .addItem('🗓️ 휴장일 동기화', 'syncHolidays')
    .addToUi();

  // 유지보수 메뉴 — 진단·자동 트리거 등 운영 관리
  SpreadsheetApp.getUi()
    .createMenu('🛠️ 유지보수')
    .addItem('🔍 진단', 'runDiag')
    .addSeparator()
    .addItem('⏰ 매일 17:30 자동 트리거 등록', 'setupDailyTrigger')
    .addItem('🗑️ 자동 트리거 해제', 'deleteDailyTrigger')
    .addSeparator()
    .addItem('📱 Telegram — 20분 푸시 ON', 'tgSetupPushTrigger')
    .addItem('🔕 Telegram — 푸시 OFF', 'tgDeletePushTrigger')
    .addItem('📤 Telegram — 즉시 발송 (테스트)', 'tgTestSend')
    .addToUi();

  // 시트 열 때 *대시보드* 자동 활성화
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dash = ss.getSheetByName(DB.SHEET);
    if (dash) ss.setActiveSheet(dash);
  } catch (e) {
    Logger.log('대시보드 활성화 실패: ' + e);
  }
}

function onEdit(e) {
  _handleFormOnEdit(e);
  _handleDashSortChange(e);
}

// Web App POST endpoint — 현재는 Telegram webhook 전용
function doPost(e) {
  return handleTelegramWebhook(e);
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
    logToTrendSheet(ss);
    buildDashboard();
    ss.toast('전체 업데이트 완료', '✅', 4);
  } catch (e) {
    ss.toast('오류: ' + e.message, '❌', 5);
    Logger.log('updateAllNew 오류: ' + e);
    _writeDashboardStatus(ss, false, e.message);   // 대시보드 2행에 실패 기록 (트리거 실행 시 가시성)
  }
}

// 시트 버튼/메뉴에 옛 함수명이 할당돼 있을 수 있어 alias 유지
function menuUpdateAll() { updateAllNew(); }

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
    .atHour(17)
    .nearMinute(30)
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
