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
    .addItem('🗑️ 17:30 자동 트리거 해제', 'deleteDailyTrigger')
    .addItem('🕐 매시 :30 장중 자동 트리거 등록 (09:30~16:30)', 'setupHourlyTrigger')
    .addItem('🗑️ 장중 자동 트리거 해제', 'deleteHourlyTrigger')
    .addSeparator()
    .addItem('📱 Telegram — 20분 푸시 ON', 'tgSetupPushTrigger')
    .addItem('🔕 Telegram — 푸시 OFF', 'tgDeletePushTrigger')
    .addSeparator()
    .addItem('📊 시장 리포트 — 08:05·17:05 트리거 ON', 'tgSetupReportQueueTrigger')
    .addItem('🗑️ 시장 리포트 트리거 OFF', 'tgDeleteReportQueueTrigger')
    .addItem('📤 시장 리포트 — 큐 즉시 발송', 'tgFlushReportQueueNow')
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
  _handleCashReserveTimestamp(e);
}

/**
 * *설정* 시트 C7:C12(대기자금) 편집 시, 같은 행 E열에 yyyy-MM-dd HH:mm 자동 스탬프.
 * 값을 비우면 스탬프도 비움. 영역 밖 편집은 무시.
 */
function _handleCashReserveTimestamp(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() !== NS.SETTINGS) return;
    const col = e.range.getColumn();
    const row = e.range.getRow();
    if (col !== 3) return;                  // C열만
    if (row < 7 || row > 12) return;        // C7~C12만
    const newVal = e.range.getValue();
    const stampCell = sheet.getRange(row, 5);  // E열
    if (newVal === '' || newVal === null) {
      stampCell.clearContent();
    } else {
      stampCell.setValue(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'));
    }
  } catch (err) {
    Logger.log('_handleCashReserveTimestamp 오류: ' + err);
  }
}

// Web App POST endpoint — Telegram webhook + Claude Routine 시장 리포트 큐
function doPost(e) {
  try {
    // action 우선 분기 (Routine → 시장 리포트 큐)
    let action = e && e.parameter && e.parameter.action;
    if (!action && e && e.postData && e.postData.contents) {
      try {
        const j = JSON.parse(e.postData.contents);
        action = j.action;
      } catch (_) { /* form-encoded이면 무시 */ }
    }
    if (action === 'addMarketReport') {
      return _tgHandleMarketReportPost(e);
    }
    if (action === 'pushPnL') {
      return _tgHandlePushPost(e);   // GitHub Actions cron → 장중 텔레그램 푸시 (GAS 트리거 대체)
    }
    if (action === 'portfolioMetrics') {
      return _handlePortfolioMetricsPost(e);   // KR 리포트 → 익스포저%·MDD (상대 지표만)
    }
  } catch (err) {
    Logger.log('doPost action 분기 오류: ' + err.message);
  }
  // action 없으면 기존 Telegram webhook으로 처리
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

/**
 * 장중 매시 :30 자동 업데이트 (거래일 09:30~16:30, 8회/일).
 * everyMinutes(30)으로 슬랙 ±2분 확보 → 핸들러에서 30분 단위 + 시각·거래일 체크.
 * LockService로 tgPushPnL·사용자 갱신과 충돌 시 skip (다음 슬롯에서 복구).
 */
function scheduledHourlyUpdate() {
  // 1. 거래일이 아니면 skip
  if (!_mIsTradingDay()) {
    Logger.log('scheduledHourlyUpdate: 비거래일 — skip');
    return;
  }
  // 2. 시각 범위 09:30~16:30 + 30분 단위(:00 or :30)만 실행
  const tz = 'Asia/Seoul';
  const now = new Date();
  const hour = Number(Utilities.formatDate(now, tz, 'H'));
  const minute = Number(Utilities.formatDate(now, tz, 'm'));
  const mins = hour * 60 + minute;
  if (mins < 9 * 60 + 28 || mins > 16 * 60 + 32) {
    Logger.log('scheduledHourlyUpdate: 시각 범위 밖 (' + hour + ':' + minute + ') — skip');
    return;
  }
  // 매시 :30 근처만 실행 (slack ±5분: :25~:35만 통과)
  if (minute < 25 || minute > 35) {
    Logger.log('scheduledHourlyUpdate: 30분 단위 슬롯 아님 (' + minute + 'm) — skip');
    return;
  }
  // 3. 락 — tgPushPnL·사용자 갱신과 겹치면 skip
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) {
    Logger.log('scheduledHourlyUpdate: 다른 갱신 처리 중 — skip');
    return;
  }
  try {
    Logger.log('scheduledHourlyUpdate 시작 (' + hour + ':' + minute + ')');
    updateAllNew();
    Logger.log('scheduledHourlyUpdate 완료');
  } finally {
    lock.releaseLock();
  }
}

function setupHourlyTrigger() {
  deleteHourlyTrigger();
  ScriptApp.newTrigger('scheduledHourlyUpdate')
    .timeBased()
    .everyMinutes(30)
    .create();
  Logger.log('트리거 설정 완료: scheduledHourlyUpdate (매 30분, 거래일 09:30~16:30만 실제 실행)');
  SpreadsheetApp.getActiveSpreadsheet()
    .toast('장중 자동 트리거 설정 완료 (매시 :30, 거래일만)', '🕐', 4);
}

function deleteHourlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'scheduledHourlyUpdate')
    .forEach(t => ScriptApp.deleteTrigger(t));
}
