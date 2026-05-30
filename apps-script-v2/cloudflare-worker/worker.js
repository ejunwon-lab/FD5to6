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
    // === DIAG: incoming ===
    const cfRay = request.headers.get('cf-ray') || '';
    const cfIpCountry = request.headers.get('cf-ipcountry') || '';
    const cfConnectingIp = request.headers.get('cf-connecting-ip') || '';
    const cfColo = request.cf && request.cf.colo ? request.cf.colo : '';
    const incomingUA = request.headers.get('user-agent') || '';
    console.log('=== INCOMING ===', JSON.stringify({
      method: request.method,
      cfRay,
      cfColo,
      cfIpCountry,
      cfConnectingIp,
      ua: incomingUA,
    }));

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
      console.log('=== AUTH FAIL ===', JSON.stringify({ expected_len: (env.SECRET || '').length, got_len: (got || '').length, match: got === env.SECRET }));
      return new Response('forbidden', { status: 403 });
    }

    // 4. body 그대로 GAS로 forward (302 redirect를 spec 대로 follow)
    const body = await request.text();
    const gasUrl = env.GAS_URL + (env.GAS_URL.indexOf('?') === -1 ? '?' : '&') + 'secret=' + env.SECRET;
    const bodyPreview = body.length > 200 ? body.slice(0, 200) + '...' : body;
    console.log('=== FORWARD TO GAS ===', JSON.stringify({
      gasHost: new URL(env.GAS_URL).host,
      bodyLen: body.length,
      bodyPreview,
    }));

    try {
      // User-Agent를 일반 클라이언트처럼 명시 — Cloudflare default UA가 GAS에서 거부될 가능성 제거
      const r = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; MarketReportProxy/1.0)',
          'Accept': 'application/json, text/plain, */*',
        },
        body,
        redirect: 'follow',
      });
      const text = await r.text();
      const respPreview = text.length > 300 ? text.slice(0, 300) + '...' : text;
      console.log('=== GAS RESPONSE ===', JSON.stringify({
        status: r.status,
        finalUrl: r.url,
        bodyPreview: respPreview,
      }));
      return new Response(text, { status: r.status });
    } catch (e) {
      console.log('=== UPSTREAM ERROR ===', e.message);
      return new Response('upstream error: ' + e.message, { status: 502 });
    }
  },
};
