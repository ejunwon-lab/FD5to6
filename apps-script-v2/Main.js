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
    .addItem('🔑 KIS 키 교체', 'kisRotateKey')
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
    if (action === 'pushPnL') {
      return _tgHandlePushPost(e);   // GitHub Actions cron → 장중 텔레그램 푸시 (GAS 트리거 대체)
    }
    if (action === 'portfolioMetrics') {
      return _handlePortfolioMetricsPost(e);   // KR 리포트 → 익스포저%·MDD·최근추세 (상대 지표만)
    }
    if (action === 'addTrade') {
      return _handleAddTradePost(e);   // 카톡 매매 알림 → *거래_원장* 1행 기록
    }
    if (action === 'backupData') {
      return _handleBackupPost(e);   // 로컬 백업 스크립트 → 전 시트 dump (docs/plans/2026-07-04-시트백업-로컬.md)
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
/** 직전 updateAllNew 의 실패 사유(성공이면 '') — 같은 실행 안에서 푸시가 읽어 경고 줄을 붙인다 */
let _lastUpdateError = '';

/**
 * @return {boolean} 성공 여부. 실패해도 예외를 던지지 않는다(대시보드 2행·로그에 기록) — 부르는 쪽이 반환값을 본다.
 */
function updateAllNew() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('환율 + 현재가 업데이트 중...', '🔄 전체 업데이트', 60);
  const t0 = Date.now(), took = [];
  let step = '';
  const run = (name, fn) => {
    step = name;
    const st = Date.now();
    fn();
    took.push(name + ' ' + ((Date.now() - st) / 1000).toFixed(1) + 's');
  };
  try {
    run('환율', () => updateFxRates(ss));
    run('가격', () => updateNewPriceHistory(ss));
    run('보유현황', () => updatePositionFromLedger({ skipDashboard: true }));   // 대시보드는 아래에서 한 번만 그린다
    run('추이', () => logToTrendSheet(ss));
    run('대시보드', () => buildDashboard());
    _lastUpdateError = '';
    // 단계별 소요 시간 — 6분 한도에 가까운 실행이 어디서 시간을 쓰는지 로그로 본다
    Logger.log('updateAllNew 소요: ' + took.join(' · ') + ' · 합계 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    ss.toast('전체 업데이트 완료', '✅', 4);
    return true;
  } catch (e) {
    _lastUpdateError = String((e && e.message) || e);
    ss.toast('오류: ' + e.message, '❌', 5);
    Logger.log('updateAllNew 오류: ' + e + ' [' + step + ' 단계 · 그 전까지 ' + (took.join(' · ') || '없음') + ']');
    _writeDashboardStatus(ss, false, e.message);   // 대시보드 2행에 실패 기록 (트리거 실행 시 가시성)
    return false;
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
  // 다른 갱신(푸시·수동 갱신)과 겹쳐 시트를 번갈아 쓰지 않게 같은 락을 잡는다. 30초 안에 못 잡으면 그 갱신이 같은 일을 하고 있으므로 넘어간다.
  const lock = LockService.getScriptLock();
  if (lock.tryLock(30000)) {
    try { updateAllNew(); } finally { lock.releaseLock(); }
  } else {
    Logger.log('scheduledDailyUpdate: 다른 갱신 처리 중 — 건너뜀');
  }
  // 리포트 이메일 채널 제거(2026-11-15)로 남은 속성 정리 — 실패해도 갱신 결과와 무관
  try { _cleanupLegacyEmailProps(); } catch (e) { Logger.log('이메일 잔여 속성 정리 오류: ' + e.message); }
}

/**
 * 제거된 리포트 이메일 채널이 남긴 스크립트 속성을 지운다 — 발송 횟수(날짜별로 쌓인 것 포함)·중복 방지 기록·킬스위치.
 * 다 지우고 나면 대상이 없어 아무 일도 하지 않는다. 그 밖의 속성은 건드리지 않는다. (docs/plans/2026-11-15-이메일채널-전체제거.md)
 * @return {number} 지운 개수
 */
function _cleanupLegacyEmailProps() {
  const props = PropertiesService.getScriptProperties();
  const old = props.getKeys()
    .filter(k => /^email_(count(_\d{4}-\d{2}-\d{2})?|disabled|last_(us|kr)_(subj|ms))$/.test(k))
    .slice(0, 300);
  old.forEach(k => props.deleteProperty(k));
  if (old.length) Logger.log('이메일 잔여 속성 정리: ' + old.length + '개 삭제');
  return old.length;
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
 * 매 틱(30분) 앞머리에서 tgChainFallback — 푸시 체인 끊김 시 GAS 백업 발송 (2026-11-12).
 * 이어서 mcTick — 마감 기록 잠금(15:56 틱)·시장 숫자·애프터마켓 알림(20:26 틱)의 GAS 쪽 시계 (2026-11-14).
 */
function scheduledHourlyUpdate() {
  // 0. 푸시 체인 백업 — GitHub 신호가 끊겨 장중 발송이 27분 넘게 없으면 여기서 직접 발송 (Telegram.js tgChainFallback, 자체 try/catch)
  const fb = tgChainFallback();
  // 0-1. 마감 기록 잠금·마감 시장 숫자·애프터마켓 알림 — GitHub 5분 신호가 끊겨도 이 30분 시계가 받친다 (MarketClose.js, 단계별 자체 격리)
  try { mcTick(); } catch (e) { Logger.log('mcTick 오류: ' + e.message); }
  // 0-2. 과거 마감 기록 소급 보정 — 일회성(상태 속성이 생기면 바로 돌아 나온다). CloseBackfill.js
  try { cbfTick(); } catch (e) { Logger.log('cbfTick 오류: ' + e.message); }
  if (fb === 'fallback:sent') return;   // 방금 전체 갱신+발송 완료 — 아래 갱신 중복 불필요
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
