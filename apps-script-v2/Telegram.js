/**
 * Telegram.js — Telegram 봇 연동
 *
 * 구조 (권장 — Worker mode):
 *   워치 → Telegram → Cloudflare Worker → GAS doPost
 *   - Worker가 GAS의 302 redirect를 spec 준수 fetch로 정상 처리 → Telegram 200 직결
 *   - secret은 X-Telegram-Bot-Api-Secret-Token 헤더 (URL 아닌 header)
 *   - 셋업: apps-script-v2/cloudflare-worker/README.md 참조
 *
 * 구조 (fallback — 직접 GAS):
 *   워치 → Telegram → GAS doPost (webhook) [302 redirect 간헐 실패 가능성]
 *   - secret은 URL query (?secret=XXX)
 *
 * 시크릿(봇 토큰·webhook secret·chat_id)은 GAS PropertiesService에만 저장. 클라이언트에 0.
 * 이중 검증: secret (Worker header or URL query) + chat_id 화이트리스트
 *
 * 사용 절차 (1회):
 *   1. BotFather에서 봇 생성 → 토큰
 *   2. tgSetBotToken('1234:ABC...') 실행
 *   3. 봇과 채팅 시작, 메시지 1회 전송 (예: /start)
 *   4. tgCaptureMyChatId() 실행 — 최근 메시지에서 chat_id 자동 추출
 *   5. push_safe.py로 배포 + Web App 배포(Anyone) → URL을 TG_WEBAPP_URL Property에 저장
 *   6. (권장) Cloudflare Worker 셋업 → tgSetWorkerUrl('https://*.workers.dev') 실행
 *   7. tgInstallWebhook 실행 — Worker URL 있으면 Worker mode로 자동 등록
 *   8. tgSetupPushTrigger() 실행 — 자동 푸시 트리거 (매시 :00/:20/:40 근처)
 */

const TG = {
  PROP_TOKEN:        'TG_BOT_TOKEN',
  PROP_CHAT_ID:      'TG_CHAT_ID',
  PROP_SECRET:       'TG_WEBHOOK_SECRET',
  PROP_WEBAPP_URL:   'TG_WEBAPP_URL',     // GAS /exec URL (fallback)
  PROP_WORKER_URL:   'TG_WORKER_URL',     // Cloudflare Worker URL (있으면 우선)
  PROP_LAST_UPDATE:  'TG_LAST_UPDATE_ID',
  PROP_LAST_RECOVER: 'TG_LAST_RECOVER_TS',
  HEAL_HANDLER:      'tgEnsureWebhookHealthy',
  HEAL_MINUTES:      30,
  API:               'https://api.telegram.org/bot',
  PUSH_HANDLER:      'tgPushPnL',
  PUSH_MINUTES_AT:   [0, 20, 40], // 매시 :00 / :20 / :40 근처에 실행
  CMD_KEYWORDS:      ['갱신', '업데이트', 'ㄱㄱ', 'update', 'refresh', '/update', '/start', '/pnl'],
  RECOVER_THROTTLE_S: 300, // 5분 안에 두 번 재등록 안 함
};

function _tgProps() { return PropertiesService.getScriptProperties(); }
function _tgToken() { return _tgProps().getProperty(TG.PROP_TOKEN); }
function _tgChatId() { return _tgProps().getProperty(TG.PROP_CHAT_ID); }
function _tgSecret() { return _tgProps().getProperty(TG.PROP_SECRET); }
function _tgWorkerUrl() { return _tgProps().getProperty(TG.PROP_WORKER_URL); }

/** Telegram sendMessage 호출 (텍스트만) */
function tgSendMessage(text) {
  const token = _tgToken();
  const chatId = _tgChatId();
  if (!token || !chatId) {
    Logger.log('Telegram: 토큰 또는 chat_id 미설정 — tgSetBotToken/tgCaptureMyChatId 먼저 실행');
    return null;
  }
  const res = UrlFetchApp.fetch(TG.API + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      disable_notification: false,
    }),
    muteHttpExceptions: true,
  });
  return res.getContentText();
}

/** 손익 메시지 포맷 (대시보드 동일 수치) */
function _tgFormatPnL() {
  const json = newMobileGetPortfolio();
  const data = JSON.parse(json);
  if (!data || !data.success) {
    return '⚠️ 포트폴리오 조회 실패';
  }
  const s = data.summary || {};
  const total = Number(s.trendTotalProfit) || 0;
  const totalRate = Number(s.totalProfitRate) || 0;
  const today = Number(s.dayChangAmount) || 0;
  const todayPctStr = s.dayChangePct || '0.00%';
  const asOf = s.priceAsOfDate || '';

  const fmtAmt = (n) => {
    const sign = n >= 0 ? '+' : '−';
    return sign + Math.abs(Math.round(n)).toLocaleString('en-US') + '원';
  };
  const fmtPct = (n) => {
    const sign = n >= 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  };

  return [
    '💼 *포트폴리오 손익*',
    '',
    '*합계*: ' + fmtAmt(total) + '  (' + fmtPct(totalRate) + ')',
    '*오늘*: ' + fmtAmt(today)  + '  (' + todayPctStr + ')',
    '',
    '_기준일: ' + asOf + '_',
  ].join('\n');
}

/** 자동 푸시 (20분 트리거에서 호출) — 거래일 09:00~16:00만, 갱신 없이 현재 시트 값으로 푸시 */
function tgPushPnL() {
  try {
    // 1. 거래일이 아니면 푸시 생략 (주말·공휴일 = *휴장일* 시트 기준)
    if (!_mIsTradingDay()) {
      Logger.log('tgPushPnL: 비거래일 — 푸시 생략');
      return;
    }
    // 2. 09:00 ~ 16:00 시간대만 푸시 (그 외 트리거는 생략)
    const tz = 'Asia/Seoul';
    const now = new Date();
    const hour = Number(Utilities.formatDate(now, tz, 'H'));
    const minute = Number(Utilities.formatDate(now, tz, 'm'));
    const mins = hour * 60 + minute;
    if (mins < 9 * 60 || mins > 16 * 60) {
      Logger.log('tgPushPnL: 장외 시간 (' + hour + ':' + minute + ') — 푸시 생략');
      return;
    }
    // 3. webhook 자가 복구 (장중에는 매번 점검 — 깨졌으면 자동 재등록)
    tgEnsureWebhookHealthy();
    tgSendMessage(_tgFormatPnL());
  } catch (e) {
    Logger.log('tgPushPnL 오류: ' + e.message);
    try { tgSendMessage('⚠️ 푸시 실패: ' + e.message); } catch (_) {}
  }
}

/**
 * webhook 자가 복구 — getWebhookInfo로 상태 점검, 비정상이면 자동 재등록.
 * 별도 시간 트리거(30분마다) + 모든 진입점(tgPushPnL·tgRefreshAndPush·tgTestSend)에서 호출.
 * 5분 throttle로 과호출 방지.
 */
function tgEnsureWebhookHealthy() {
  const token = _tgToken();
  if (!token) return;
  try {
    const res = UrlFetchApp.fetch(TG.API + token + '/getWebhookInfo', { muteHttpExceptions: true });
    const info = JSON.parse(res.getContentText());
    if (!info.ok) return;
    const r = info.result || {};
    const nowSec = Math.floor(Date.now() / 1000);
    const hasRecentError = r.last_error_date && (nowSec - r.last_error_date) < 3600;
    const hasPending = (r.pending_update_count || 0) > 0;
    const noUrl = !r.url;
    if (!hasRecentError && !hasPending && !noUrl) {
      return; // 정상
    }
    // throttle — 5분 안에 두 번 재등록 안 함
    const props = _tgProps();
    const lastRecover = Number(props.getProperty(TG.PROP_LAST_RECOVER) || 0);
    if (nowSec - lastRecover < TG.RECOVER_THROTTLE_S) {
      Logger.log('tgEnsureWebhookHealthy: throttle 중 (5분 내 이미 복구 시도)');
      return;
    }
    props.setProperty(TG.PROP_LAST_RECOVER, String(nowSec));
    Logger.log('tgEnsureWebhookHealthy: 비정상 감지 → 자동 재등록');
    Logger.log('  url: ' + (r.url || '(없음)'));
    Logger.log('  pending: ' + (r.pending_update_count || 0));
    Logger.log('  last_error: ' + (r.last_error_message || '(없음)'));
    // mode 자동 선택 — Worker 설정돼 있으면 Worker URL, 없으면 /exec 직접 모드
    if (_tgWorkerUrl()) {
      tgRegisterWebhook(/*webAppUrl*/ null, /*dropPending=*/ false);
    } else {
      const url = props.getProperty(TG.PROP_WEBAPP_URL);
      if (!url || url.indexOf('/exec') !== url.length - 5) {
        Logger.log('  ❌ Properties의 TG_WEBAPP_URL이 /exec 아님 — 수동 등록 필요');
        return;
      }
      tgRegisterWebhook(url, /*dropPending=*/ false);
    }
  } catch (e) {
    Logger.log('tgEnsureWebhookHealthy 오류: ' + e.message);
  }
}

/** 수동 트리거 — 가격 + 보유현황만 빠르게 갱신 후 푸시 (대시보드 렌더·추이 기록 생략) */
function tgRefreshAndPush() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateNewPriceHistory(ss);
    updatePositionFromLedger();
    tgSendMessage(_tgFormatPnL());
    // 응답 후 안전망 — webhook 상태 점검 (throttle 내장)
    try { tgEnsureWebhookHealthy(); } catch (_) {}
  } catch (e) {
    Logger.log('tgRefreshAndPush 오류: ' + e.message);
    try { tgSendMessage('⚠️ 갱신 실패: ' + e.message); } catch (_) {}
  }
}

/** Telegram webhook 핸들러 (doPost에서 호출) */
function handleTelegramWebhook(e) {
  try {
    // 1. secret 검증
    const expectedSecret = _tgSecret();
    const gotSecret = e && e.parameter && e.parameter.secret;
    if (!expectedSecret || gotSecret !== expectedSecret) {
      return ContentService.createTextOutput('forbidden');
    }
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('ok');
    }
    const body = JSON.parse(e.postData.contents);

    // 2. update_id 중복 제거 — Telegram이 응답 못 받으면 같은 update_id로 retry
    //    PropertiesService에 마지막 처리한 update_id 저장. 같으면 무시
    const updateId = body.update_id != null ? String(body.update_id) : null;
    if (updateId) {
      const props = _tgProps();
      const lastId = props.getProperty(TG.PROP_LAST_UPDATE);
      if (lastId === updateId) {
        Logger.log('중복 update_id 무시: ' + updateId);
        return ContentService.createTextOutput('ok');
      }
      props.setProperty(TG.PROP_LAST_UPDATE, updateId);
    }

    const message = body.message || body.edited_message;
    if (!message) return ContentService.createTextOutput('ok');

    // 3. chat_id 화이트리스트
    const expectedChatId = _tgChatId();
    const gotChatId = String(message.chat && message.chat.id);
    if (gotChatId !== expectedChatId) {
      Logger.log('알 수 없는 chat_id: ' + gotChatId);
      return ContentService.createTextOutput('ok');
    }

    const text = String(message.text || '').trim().toLowerCase();
    const matched = TG.CMD_KEYWORDS.some(k => text.indexOf(k.toLowerCase()) !== -1);

    if (matched) {
      // 4. 락 — 동시 처리 방지 (이미 처리 중이면 새 요청 무시)
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(1000)) {
        tgSendMessage('⏳ 이전 갱신 처리 중 — 잠시 후 다시 시도');
        return ContentService.createTextOutput('ok');
      }
      try {
        tgRefreshAndPush();
      } finally {
        lock.releaseLock();
      }
    } else {
      tgSendMessage('명령어: "갱신" 또는 "/update"');
    }
    return ContentService.createTextOutput('ok');
  } catch (err) {
    Logger.log('handleTelegramWebhook 오류: ' + err.message);
    return ContentService.createTextOutput('error');
  }
}

// ─────────────────────────────────────────────
// Setup 함수들 (에디터에서 직접 실행)
// ─────────────────────────────────────────────

/** 1단계: 봇 토큰 저장 + webhook secret 자동 생성 */
function tgSetBotToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf(':') === -1) {
    Logger.log('❌ 토큰이 올바르지 않습니다. BotFather에서 받은 형식: 1234567890:ABCdef...');
    return;
  }
  const props = _tgProps();
  props.setProperty(TG.PROP_TOKEN, token.trim());
  if (!props.getProperty(TG.PROP_SECRET)) {
    const secret = Utilities.getUuid().replace(/-/g, '');
    props.setProperty(TG.PROP_SECRET, secret);
  }
  Logger.log('✅ 봇 토큰 저장 완료');
  Logger.log('  다음 단계: 봇에 메시지 1회 전송 후 tgCaptureMyChatId() 실행');
}

/** 2단계: 최근 메시지에서 chat_id 자동 추출 (webhook 등록 전에만 작동) + webhook secret 자동 생성 */
function tgCaptureMyChatId() {
  const token = _tgToken();
  if (!token) {
    Logger.log('❌ 토큰 미설정 — 프로젝트 설정 > 스크립트 속성에 TG_BOT_TOKEN 추가 후 다시 실행');
    return;
  }
  // webhook secret 자동 생성 (없으면)
  if (!_tgSecret()) {
    const secret = Utilities.getUuid().replace(/-/g, '');
    _tgProps().setProperty(TG.PROP_SECRET, secret);
    Logger.log('  webhook secret 자동 생성 완료');
  }
  const res = UrlFetchApp.fetch(TG.API + token + '/getUpdates', { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());
  if (!data.ok || !data.result || data.result.length === 0) {
    Logger.log('❌ 최근 메시지 없음 — 봇 채팅방에서 메시지 1회 전송 후 다시 시도');
    Logger.log('  응답: ' + res.getContentText().slice(0, 300));
    return;
  }
  const last = data.result[data.result.length - 1];
  const msg = last.message || last.edited_message || last.channel_post;
  if (!msg || !msg.chat) {
    Logger.log('❌ chat 정보 없음');
    return;
  }
  const chatId = String(msg.chat.id);
  _tgProps().setProperty(TG.PROP_CHAT_ID, chatId);
  Logger.log('✅ chat_id 저장 완료: ' + chatId);
  Logger.log('  다음 단계: Web App 배포 후 tgRegisterWebhook(url) 실행');
  // 테스트 메시지
  tgSendMessage('✅ Telegram 봇 연동 완료. 이제 "갱신" 메시지로 손익 조회 가능합니다.');
}

/**
 * webhook 등록 — Worker mode(권장) 우선, fallback으로 직접 GAS 모드.
 * - Worker mode: TG_WORKER_URL 설정돼 있으면 Worker URL을 Telegram에 등록 + secret은 secret_token 헤더로
 * - 직접 모드: GAS /exec URL을 등록 + secret은 URL query로 (302 redirect 간헐 실패 위험)
 */
function tgRegisterWebhook(webAppUrl, dropPending) {
  const token = _tgToken();
  const secret = _tgSecret();
  if (!token || !secret) {
    Logger.log('❌ 토큰 또는 secret 미설정');
    return;
  }

  const workerUrl = _tgWorkerUrl();
  let payload;
  if (workerUrl) {
    // Worker 모드 — secret은 secret_token 헤더로 (Telegram이 X-Telegram-Bot-Api-Secret-Token 헤더 전송)
    payload = {
      url: workerUrl,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: dropPending !== false,
    };
    Logger.log('  mode: Worker (Cloudflare) — secret은 header');
    Logger.log('  URL: ' + workerUrl);
  } else {
    // 직접 GAS 모드 (fallback) — secret을 URL query로
    if (!webAppUrl || webAppUrl.indexOf('script.google.com') === -1) {
      Logger.log('❌ Web App URL이 올바르지 않습니다 (https://script.google.com/.../exec 형태)');
      return;
    }
    const fullUrl = webAppUrl + (webAppUrl.indexOf('?') === -1 ? '?' : '&') + 'secret=' + secret;
    payload = {
      url: fullUrl,
      allowed_updates: ['message'],
      drop_pending_updates: dropPending !== false,
    };
    Logger.log('  mode: 직접 GAS (Worker 미설정) — secret은 URL query');
    Logger.log('  URL: ' + webAppUrl);
  }

  const res = UrlFetchApp.fetch(TG.API + token + '/setWebhook', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  Logger.log('✅ webhook 등록 응답: ' + res.getContentText());
}

/** Worker URL 등록 helper — TG_WORKER_URL 저장 (다음 tgInstallWebhook 시 Worker 모드 활성화) */
function tgSetWorkerUrl(workerUrl) {
  if (!workerUrl || !/^https:\/\/[^\/]+\.workers\.dev(\/.*)?$/i.test(workerUrl)) {
    Logger.log('❌ Worker URL은 https://*.workers.dev/* 형태여야 합니다');
    Logger.log('  입력값: ' + workerUrl);
    return;
  }
  _tgProps().setProperty(TG.PROP_WORKER_URL, workerUrl.trim());
  Logger.log('✅ TG_WORKER_URL 저장: ' + workerUrl.trim());
  Logger.log('  다음 단계: tgInstallWebhook 실행 → Worker 모드로 등록');
}

/** Worker URL 해제 — 직접 GAS 모드로 복귀 (트러블슈팅용) */
function tgClearWorkerUrl() {
  _tgProps().deleteProperty(TG.PROP_WORKER_URL);
  Logger.log('✅ Worker URL 해제 — 다음 tgInstallWebhook는 직접 GAS 모드');
}

/** TG_WEBHOOK_SECRET 값 확인 (Cloudflare Worker env에 같은 값 입력 시 사용) */
function tgShowSecret() {
  const s = _tgSecret();
  if (!s) {
    Logger.log('❌ TG_WEBHOOK_SECRET 미설정 — tgSetBotToken 또는 tgCaptureMyChatId 먼저 실행');
    return;
  }
  Logger.log('TG_WEBHOOK_SECRET: ' + s);
  Logger.log('  → Cloudflare Worker의 SECRET env 변수에 위 값 그대로 입력');
}

/**
 * webhook 등록 — Worker URL이 있으면 Worker 모드, 없으면 /exec 직접 모드.
 * tgRegisterWebhook 내부에서 mode 자동 선택, 이 함수는 fallback용 /exec URL 확보만 담당.
 */
function tgInstallWebhook() {
  const workerUrl = _tgWorkerUrl();
  if (workerUrl) {
    Logger.log('Worker 모드로 등록 시도');
    tgRegisterWebhook(/*webAppUrl*/ null);
    tgSetupHealTrigger();
    return;
  }

  // Worker 미설정 — 직접 GAS 모드. /exec URL 확보
  const propUrl = _tgProps().getProperty(TG.PROP_WEBAPP_URL);
  const autoUrl = ScriptApp.getService().getUrl();
  // 자동 감지된 URL이 /exec로 끝나는 경우만 사용 가능 (대부분 /dev라 무시)
  const autoIsExec = autoUrl && autoUrl.indexOf('/exec') === autoUrl.length - 5;
  const propIsExec = propUrl && propUrl.indexOf('/exec') === propUrl.length - 5;

  let url = null;
  if (propIsExec) {
    url = propUrl;
  } else if (autoIsExec) {
    url = autoUrl;
    _tgProps().setProperty(TG.PROP_WEBAPP_URL, url);
  }

  if (!url) {
    Logger.log('❌ /exec URL 없음 — 배포 후 URL을 Properties의 TG_WEBAPP_URL에 직접 입력하세요');
    Logger.log('  현재 Properties URL: ' + (propUrl || '(없음)'));
    Logger.log('  자동 감지 URL: ' + (autoUrl || '(없음)') + ' ← /dev는 사용 불가');
    return;
  }
  if (autoUrl && !autoIsExec) {
    Logger.log('  (자동 감지 URL은 /dev — 무시, Properties의 /exec 사용)');
  }
  Logger.log('  직접 GAS 모드로 등록 시도 (Worker 권장 — 02-cloudflare-worker/README.md 참조)');
  tgRegisterWebhook(url);
  tgSetupHealTrigger();
}

/** 자가 복구 트리거 등록 (30분마다 tgEnsureWebhookHealthy 실행) — 이미 있으면 skip */
function tgSetupHealTrigger() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === TG.HEAL_HANDLER);
  if (existing.length > 0) {
    Logger.log('  자가 복구 트리거 이미 존재 (개수: ' + existing.length + ')');
    return;
  }
  ScriptApp.newTrigger(TG.HEAL_HANDLER)
    .timeBased()
    .everyMinutes(TG.HEAL_MINUTES)
    .create();
  Logger.log('  ✅ 자가 복구 트리거 등록 (' + TG.HEAL_MINUTES + '분마다)');
}

/** 자가 복구 트리거 해제 */
function tgDeleteHealTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === TG.HEAL_HANDLER)
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('✅ 자가 복구 트리거 해제 완료');
}

/** webhook 해제 (디버깅용) */
function tgDeleteWebhook() {
  const token = _tgToken();
  if (!token) { Logger.log('❌ 토큰 미설정'); return; }
  const res = UrlFetchApp.fetch(TG.API + token + '/deleteWebhook', {
    method: 'post', muteHttpExceptions: true,
  });
  Logger.log(res.getContentText());
}

/** webhook 상태 확인 */
function tgWebhookInfo() {
  const token = _tgToken();
  if (!token) { Logger.log('❌ 토큰 미설정'); return; }
  const res = UrlFetchApp.fetch(TG.API + token + '/getWebhookInfo', { muteHttpExceptions: true });
  Logger.log(res.getContentText());
}

/** 4단계: 매시 :00 / :20 / :40 근처 트리거 3개 등록 (GAS는 everyMinutes(20) 미지원) */
function tgSetupPushTrigger() {
  tgDeletePushTrigger();
  TG.PUSH_MINUTES_AT.forEach(min => {
    ScriptApp.newTrigger(TG.PUSH_HANDLER)
      .timeBased()
      .everyHours(1)
      .nearMinute(min)
      .create();
  });
  Logger.log('✅ 자동 푸시 트리거 등록 완료 (매시 :' +
    TG.PUSH_MINUTES_AT.map(m => String(m).padStart(2, '0')).join(', :') +
    ' 근처, 거래일 09:00~16:00만 실제 발송)');
}

/** 자동 푸시 트리거 해제 */
function tgDeletePushTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === TG.PUSH_HANDLER) {
      ScriptApp.deleteTrigger(t);
    }
  });
  Logger.log('✅ 자동 푸시 트리거 해제 완료');
}

/** 즉시 테스트 발송 (현재 시트 값으로) — 끝에 webhook 자가 점검 (안전망) */
function tgTestSend() {
  const text = _tgFormatPnL();
  Logger.log(text);
  tgSendMessage(text);
  try { tgEnsureWebhookHealthy(); } catch (_) {}
}
