/**
 * Cloudflare Worker — Telegram webhook → GAS /exec proxy
 *
 * 목적: Telegram이 GAS의 302 redirect를 못 따라가는 문제를 우회.
 *       Worker가 spec 준수 fetch로 redirect를 정상 처리하여 200을 Telegram에 직결.
 *
 * 인증: Telegram → Worker는 X-Telegram-Bot-Api-Secret-Token 헤더 (URL이 아닌 헤더)
 *       Worker → GAS는 ?secret=XXX URL query (GAS doPost가 e.parameter.secret로 읽음)
 *       둘 다 같은 비밀값 (env.SECRET) 사용
 *
 * 환경 변수 (Cloudflare 대시보드 Variables and Secrets에 Encrypted 로 추가):
 *   SECRET    — GAS Properties의 TG_WEBHOOK_SECRET 과 동일 값 (GAS에서 tgShowSecret() 실행해 확인)
 *   GAS_URL   — GAS /exec URL (예: https://script.google.com/macros/s/.../exec)
 *               query string 없이 끝이 /exec
 */

export default {
  async fetch(request, env) {
    // 1. POST만 허용
    if (request.method !== 'POST') {
      return new Response('only POST', { status: 405 });
    }

    // 2. env 검증
    if (!env.SECRET || !env.GAS_URL) {
      return new Response('worker misconfigured', { status: 500 });
    }

    // 3. Telegram의 secret_token 헤더 검증
    const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (got !== env.SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    // 4. body 그대로 GAS로 forward (302 redirect를 spec 대로 follow)
    const body = await request.text();
    const gasUrl = env.GAS_URL + (env.GAS_URL.indexOf('?') === -1 ? '?' : '&') + 'secret=' + env.SECRET;

    try {
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        redirect: 'follow',
      });
      // GAS의 응답을 Telegram에 그대로 반환
      const text = await r.text();
      return new Response(text, { status: r.status });
    } catch (e) {
      return new Response('upstream error: ' + e.message, { status: 502 });
    }
  },
};
