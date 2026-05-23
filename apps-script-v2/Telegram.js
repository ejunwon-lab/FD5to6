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
  API:               'https://api.telegram.org/bot',
  PUSH_HANDLER:      'tgPushPnL',
  PUSH_MINUTES_AT:   [0, 20, 40], // 매시 :00 / :20 / :40 근처에 실행
  CMD_KEYWORDS:      ['갱신', '업데이트', 'ㄱㄱ', 'update', 'refresh', '/update', '/start', '/pnl'],
};

function _tgProps() { return PropertiesService.getScriptProperties(); }
function _tgToken() { return _tgProps().getProperty(TG.PROP_TOKEN); }
function _tgSecret() { return _tgProps().getProperty(TG.PROP_SECRET); }
function _tgWorkerUrl() { return _tgProps().getProperty(TG.PROP_WORKER_URL); }

/** 등록된 chat_id 배열 — TG_CHAT_ID는 콤마 구분 리스트 (단일 값도 호환) */
function _tgChatIds() {
  const v = _tgProps().getProperty(TG.PROP_CHAT_ID) || '';
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

/** 등록된 첫 번째 chat_id (backward compat) */
function _tgChatId() {
  const ids = _tgChatIds();
  return ids[0] || '';
}

/**
 * Telegram sendMessage 호출.
 * - 인자 없으면 등록된 모든 chat에 브로드캐스트
 * - opts.chatId 주면 그 chat에만 (whitelist 무시 — /whoami 응답에 사용)
 */
function tgSendMessage(text, opts) {
  const token = _tgToken();
  if (!token) {
    Logger.log('Telegram: 토큰 미설정 — tgSetBotToken 먼저 실행');
    return null;
  }
  const ids = (opts && opts.chatId) ? [String(opts.chatId)] : _tgChatIds();
  if (ids.length === 0) {
    Logger.log('Telegram: chat_id 미설정 — tgAddChatId 또는 tgCaptureMyChatId 먼저 실행');
    return null;
  }
  const results = [];
  for (const chatId of ids) {
    try {
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
      const code = res.getResponseCode();
      if (code !== 200) {
        Logger.log('sendMessage to ' + chatId + ' HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
      }
      results.push({ chatId, status: code });
    } catch (e) {
      Logger.log('sendMessage to ' + chatId + ' 예외: ' + e.message);
      results.push({ chatId, error: e.message });
    }
  }
  return JSON.stringify(results);
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

/**
 * 자동 푸시 (트리거에서 호출) — 거래일 09:00~16:00만.
 * 항상 KIS 가격 갱신 + 보유현황 재계산 후 발송 (최신 손익 보장).
 * 사용자 ㄱㄱ 처리 중이면 lock 못 잡고 skip — 사용자 갱신이 곧 알림 발송하므로 중복 안 옴.
 */
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
    // 3. 락 — 사용자 갱신과 겹치면 skip (사용자 갱신이 곧 알림 발송함)
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) {
      Logger.log('tgPushPnL: 다른 갱신 처리 중 — skip');
      return;
    }
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      updateNewPriceHistory(ss);
      updatePositionFromLedger();
      tgSendMessage(_tgFormatPnL());
    } finally {
      lock.releaseLock();
    }
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

    const gotChatId = String(message.chat && message.chat.id);
    const text = String(message.text || '').trim().toLowerCase();

    // 3a. /whoami — 누구나 사용 가능 (whitelist 무시). 신규 사용자가 자기 chat ID 알아내는 경로
    // Markdown 호환 위해 underscore 포함 표기 회피 (chat_id → chat ID)
    if (text.indexOf('/whoami') === 0) {
      tgSendMessage(
        '귀하의 chat ID:\n`' + gotChatId + '`\n\n관리자에게 위 숫자를 전달해 등록 요청하세요.',
        { chatId: gotChatId }
      );
      return ContentService.createTextOutput('ok');
    }

    // 3b. chat_id 화이트리스트 (배열 — 브로드캐스트 지원)
    const allowedIds = _tgChatIds();
    if (allowedIds.indexOf(gotChatId) === -1) {
      Logger.log('알 수 없는 chat_id: ' + gotChatId + ' (메시지: ' + text + ')');
      return ContentService.createTextOutput('ok');
    }

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

/** 브로드캐스트 — 새 chat_id 추가 (가족·파트너 등) */
function tgAddChatId(chatId) {
  const id = String(chatId || '').trim();
  if (!/^-?\d+$/.test(id)) {
    Logger.log('❌ chat_id는 숫자여야 합니다 (음수 가능). 받은 값: ' + chatId);
    return;
  }
  const cur = _tgChatIds();
  if (cur.indexOf(id) !== -1) {
    Logger.log('이미 등록된 chat_id: ' + id);
    Logger.log('  현재 등록: ' + cur.join(', '));
    return;
  }
  cur.push(id);
  _tgProps().setProperty(TG.PROP_CHAT_ID, cur.join(','));
  Logger.log('✅ chat_id 추가: ' + id + ' (총 ' + cur.length + '명)');
  Logger.log('  현재 등록: ' + cur.join(', '));
  // 새로 추가된 사람에게 환영 메시지
  try {
    tgSendMessage('✅ 등록 완료. 이제 "갱신" 또는 "ㄱㄱ" 명령으로 손익 조회 가능합니다.', { chatId: id });
  } catch (e) {
    Logger.log('환영 메시지 전송 실패: ' + e.message);
  }
}

/** 브로드캐스트 — chat_id 제거 */
function tgRemoveChatId(chatId) {
  const id = String(chatId || '').trim();
  const cur = _tgChatIds();
  const next = cur.filter(x => x !== id);
  if (cur.length === next.length) {
    Logger.log('등록되지 않은 chat_id: ' + id);
    Logger.log('  현재 등록: ' + cur.join(', '));
    return;
  }
  _tgProps().setProperty(TG.PROP_CHAT_ID, next.join(','));
  Logger.log('✅ chat_id 제거: ' + id + ' (남은 ' + next.length + '명)');
  Logger.log('  현재 등록: ' + (next.join(', ') || '(없음)'));
}

/** 등록된 chat_id 전체 목록 출력 */
function tgListChatIds() {
  const ids = _tgChatIds();
  Logger.log('등록된 chat_ids (' + ids.length + '명): ' + (ids.join(', ') || '(없음)'));
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
  const text = _tgFormatPnL();
  Logger.log(text);
  tgSendMessage(text);
}
