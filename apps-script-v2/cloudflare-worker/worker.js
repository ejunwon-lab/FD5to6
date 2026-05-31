/**
 * Cloudflare Worker — 두 가지 endpoint를 한 곳에서 처리
 *
 * (A) Telegram webhook → GAS doPost proxy (기존 — 워치 손익 알림용)
 *     워치/사용자 → Telegram bot → 이 Worker → GAS doPost
 *     인증: X-Telegram-Bot-Api-Secret-Token 헤더 (env.SECRET)
 *
 * (B) routine 시장 리포트 → Telegram bot API 직접 발송 (신규 2026-05-31)
 *     이유: claude.ai routine 환경 IP가 GAS에서 403 차단됨 (Google anti-abuse).
 *          Cloudflare PoP의 미국 outbound IP 또한 차단되어 Worker → GAS forward 불가.
 *          Telegram Bot API는 모든 IP 허용 → Worker가 직접 발송이 유일한 해결.
 *     흐름: routine → 이 Worker → Telegram Bot API → 사용자 Telegram
 *     인증: 동일 SECRET 헤더 (env.SECRET)
 *     판별: POST body가 JSON + action=='addMarketReport'면 (B) 처리
 *
 * 환경 변수 (Cloudflare 대시보드 Settings → Variables and Secrets):
 *   SECRET        — GAS Properties의 TG_WEBHOOK_SECRET와 동일 (Telegram webhook + 리포트 인증 공통)
 *   GAS_URL       — GAS /exec URL (예: https://script.google.com/macros/s/.../exec) — (A)용
 *   TG_BOT_TOKEN  — Telegram 봇 토큰 (GAS Properties의 TG_BOT_TOKEN과 동일) — (B)용
 *   TG_CHAT_ID    — 콤마 구분 chat_id 리스트 (GAS Properties의 TG_CHAT_ID와 동일) — (B)용
 */

export default {
  async fetch(request, env) {
    // 0. POST만 허용
    if (request.method !== 'POST') {
      return new Response('only POST', { status: 405 });
    }

    // 1. SECRET 검증 (A와 B 공통)
    if (!env.SECRET) {
      return jsonResponse({ success: false, error: 'worker misconfigured: SECRET missing' }, 500);
    }
    const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (got !== env.SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    // 2. body 읽기 + action 판별
    const rawBody = await request.text();
    let action = null;
    try {
      const j = JSON.parse(rawBody);
      action = j && j.action;
    } catch (_) { /* not JSON — fall through to (A) GAS forward */ }

    // 3. 분기
    if (action === 'addMarketReport') {
      return await handleMarketReport(rawBody, env);
    }
    return await forwardToGAS(rawBody, env);
  },
};

// ─────────────────────────────────────────────
// (A) Telegram webhook → GAS doPost forward
// ─────────────────────────────────────────────
async function forwardToGAS(rawBody, env) {
  if (!env.GAS_URL) {
    return new Response('worker misconfigured: GAS_URL missing', { status: 500 });
  }
  const gasUrl = env.GAS_URL + (env.GAS_URL.indexOf('?') === -1 ? '?' : '&') + 'secret=' + env.SECRET;
  try {
    const r = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MarketReportProxy/1.0)',
        'Accept': 'application/json, text/plain, */*',
      },
      body: rawBody,
      redirect: 'follow',
    });
    const text = await r.text();
    return new Response(text, { status: r.status });
  } catch (e) {
    return new Response('upstream error: ' + e.message, { status: 502 });
  }
}

// ─────────────────────────────────────────────
// (B) routine 시장 리포트 → Telegram Bot API 직접 발송
// ─────────────────────────────────────────────
async function handleMarketReport(rawBody, env) {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) {
    return jsonResponse({
      success: false,
      error: 'TG_BOT_TOKEN or TG_CHAT_ID missing in Worker env',
    }, 500);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return jsonResponse({ success: false, error: 'invalid JSON body' }, 400);
  }

  const text = payload.body || '';
  if (!text) {
    return jsonResponse({ success: false, error: 'body required' }, 400);
  }

  const chatIds = String(env.TG_CHAT_ID).split(',').map(s => s.trim()).filter(Boolean);
  if (chatIds.length === 0) {
    return jsonResponse({ success: false, error: 'TG_CHAT_ID has no valid id' }, 500);
  }

  const apiBase = 'https://api.telegram.org/bot' + env.TG_BOT_TOKEN + '/sendMessage';
  const results = [];

  for (const chatId of chatIds) {
    // 1차 시도 — MarkdownV1 parse
    let r = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_notification: false,
      }),
    });
    let respText = await r.text();
    let parsedOk = r.ok;

    // Markdown parse 실패(400) 시 plain text fallback
    if (!r.ok && r.status === 400) {
      r = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_notification: false,
        }),
      });
      respText = await r.text();
    }

    results.push({
      chatId,
      status: r.status,
      ok: r.ok,
      markdownOk: parsedOk,
      bodyPreview: respText.slice(0, 200),
    });
  }

  const allOk = results.every(x => x.ok);
  return jsonResponse({
    success: allOk,
    type: payload.type || 'unknown',
    asOfDate: payload.asOfDate || '',
    title: payload.title || '',
    sent: results,
  }, allOk ? 200 : 502);
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
