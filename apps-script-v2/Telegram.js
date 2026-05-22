/**
 * Telegram.js — Telegram 봇 연동
 *
 * 구조: 워치 → Telegram → GAS doPost (webhook)
 *   - 시크릿(봇 토큰·webhook secret·chat_id)은 GAS PropertiesService에만 저장
 *   - 클라이언트(워치/iPhone)에 시크릿 0개
 *   - webhook URL에 secret query string + chat_id 화이트리스트 이중 검증
 *
 * 사용 절차 (1회):
 *   1. BotFather에서 봇 생성 → 토큰
 *   2. GAS 에디터에서 tgSetBotToken('1234:ABC...') 실행
 *   3. 봇과 채팅 시작, 메시지 1회 전송 (예: /start)
 *   4. tgCaptureMyChatId() 실행 — 최근 메시지에서 chat_id 자동 추출
 *   5. push_safe.py로 배포
 *   6. Web App 새 배포 (Anyone 액세스) → URL 복사
 *   7. tgRegisterWebhook('https://script.google.com/.../exec') 실행
 *   8. tgSetupPushTrigger() 실행 — 20분 자동 푸시 트리거
 */

const TG = {
  PROP_TOKEN:        'TG_BOT_TOKEN',
  PROP_CHAT_ID:      'TG_CHAT_ID',
  PROP_SECRET:       'TG_WEBHOOK_SECRET',
  PROP_WEBAPP_URL:   'TG_WEBAPP_URL',
  PROP_LAST_UPDATE:  'TG_LAST_UPDATE_ID',
  API:               'https://api.telegram.org/bot',
  PUSH_HANDLER:      'tgPushPnL',
  PUSH_MINUTES_AT:   [0, 20, 40], // 매시 :00 / :20 / :40 근처에 실행
  CMD_KEYWORDS:      ['갱신', '업데이트', 'update', 'refresh', '/update', '/start', '/pnl'],
};

function _tgProps() { return PropertiesService.getScriptProperties(); }
function _tgToken() { return _tgProps().getProperty(TG.PROP_TOKEN); }
function _tgChatId() { return _tgProps().getProperty(TG.PROP_CHAT_ID); }
function _tgSecret() { return _tgProps().getProperty(TG.PROP_SECRET); }

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
    tgSendMessage(_tgFormatPnL());
  } catch (e) {
    Logger.log('tgPushPnL 오류: ' + e.message);
    try { tgSendMessage('⚠️ 푸시 실패: ' + e.message); } catch (_) {}
  }
}

/** 수동 트리거 — 가격 + 보유현황만 빠르게 갱신 후 푸시 (대시보드 렌더·추이 기록 생략) */
function tgRefreshAndPush() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    updateNewPriceHistory(ss);
    updatePositionFromLedger();
    tgSendMessage(_tgFormatPnL());
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

/** 3단계: Web App URL을 Telegram webhook으로 등록 */
function tgRegisterWebhook(webAppUrl) {
  const token = _tgToken();
  const secret = _tgSecret();
  if (!token || !secret) {
    Logger.log('❌ 토큰 또는 secret 미설정');
    return;
  }
  if (!webAppUrl || webAppUrl.indexOf('script.google.com') === -1) {
    Logger.log('❌ Web App URL이 올바르지 않습니다 (https://script.google.com/.../exec 형태)');
    return;
  }
  const fullUrl = webAppUrl + (webAppUrl.indexOf('?') === -1 ? '?' : '&') + 'secret=' + secret;
  const res = UrlFetchApp.fetch(TG.API + token + '/setWebhook', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      url: fullUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
      max_connections: 1, // GAS 동시 처리 1개로 제한 (안정성)
    }),
    muteHttpExceptions: true,
  });
  Logger.log('✅ webhook 등록 응답: ' + res.getContentText());
}

/** 3단계: Properties의 TG_WEBAPP_URL을 읽어서 webhook 등록 (인자 없는 버전) */
function tgInstallWebhook() {
  const url = _tgProps().getProperty(TG.PROP_WEBAPP_URL);
  if (!url) {
    Logger.log('❌ TG_WEBAPP_URL 미설정 — 프로젝트 설정 > 스크립트 속성에 Web App URL 추가 후 다시 실행');
    return;
  }
  tgRegisterWebhook(url);
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

/** 즉시 테스트 발송 (현재 시트 값으로) */
function tgTestSend() {
  Logger.log(_tgFormatPnL());
  tgSendMessage(_tgFormatPnL());
}
