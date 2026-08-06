/**
 * News.js — 보유 종목 뉴스 수집 (데스크 Today "오늘의 뉴스" 패널용)
 *
 * 소스 (전부 네이버, 무키 — 설계: docs/plans/2026-08-06-Today-뉴스-이벤트캘린더.md):
 *  - KR: m.stock.naver.com/api/news/stock/{6자리코드}  → 기사 직링크(mobileNewsUrl) 포함
 *  - US: api.stock.naver.com/news/worldStock/{SYM}.O(→.N 폴백) → 한국어 번역 뉴스,
 *        기사 직링크 없음 → 종목 뉴스탭 링크로 폴백
 *
 * CacheService 30분 공유 캐시. scripts.run(소유자 OAuth) 전용 — doGet 공개 엔드포인트 아님.
 * 실패는 종목 단위로 무해 degrade (해당 종목만 누락).
 */

var NEWS_CACHE_KEY = 'news_v1';
var NEWS_CACHE_SEC = 1800;        // 30분
var NEWS_PER_STOCK = 3;
var NEWS_MAX_ITEMS = 40;
var NEWS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

function newMobileGetNews() {
  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get(NEWS_CACHE_KEY);
    if (hit) return hit;

    const stocks = _newsTargetStocks_();
    const items = _newsFetchAll_(stocks);
    items.sort(function (a, b) { return b.dt < a.dt ? -1 : b.dt > a.dt ? 1 : 0; });

    const out = JSON.stringify({
      success: true,
      fetchedAt: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
      stockCount: stocks.length,
      items: items.slice(0, NEWS_MAX_ITEMS),
      earnings: _newsUsEarnings_(stocks.filter(function (s) { return !s.isKR; })),
    });
    if (out.length < 95 * 1024) cache.put(NEWS_CACHE_KEY, out, NEWS_CACHE_SEC);  // 캐시 100KB 한도
    return out;
  } catch (e) {
    Logger.log('newMobileGetNews 오류: ' + e);
    return JSON.stringify({ success: false, error: String(e) });
  }
}

/** *보유현황*에서 뉴스 대상 종목 추출 — KIS_SKIP 제외, 수량>0, 코드 중복 제거 */
function _newsTargetStocks_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(NS.POSITION);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
  const seen = {};
  const out = [];
  rows.forEach(function (r) {
    const code = String(r[0]).trim();
    const name = String(r[1]).trim();
    if (!code || code === '합계' || name === '합계') return;
    if (Number(r[6]) <= 0) return;
    if (NS.KIS_SKIP.includes(String(r[2]).trim())) return;
    if (seen[code]) return;
    seen[code] = true;
    out.push({ code: code, name: name, isKR: /^\d{6}$/.test(code) });
  });
  return out;
}

/** fetchAll 1차(KR + US .O) → US 빈 응답만 .N으로 2차 */
function _newsFetchAll_(stocks) {
  const reqOf = function (url) {
    return { url: url, muteHttpExceptions: true, headers: { 'User-Agent': NEWS_UA } };
  };
  const krUrl = function (s) {
    return 'https://m.stock.naver.com/api/news/stock/' + s.code + '?pageSize=' + NEWS_PER_STOCK + '&page=1';
  };
  const usUrl = function (s, suffix) {
    return 'https://api.stock.naver.com/news/worldStock/' + encodeURIComponent(s.code + suffix) +
      '?pageSize=' + NEWS_PER_STOCK + '&page=1';
  };

  const reqs = stocks.map(function (s) { return reqOf(s.isKR ? krUrl(s) : usUrl(s, '.O')); });
  let responses = [];
  try {
    responses = UrlFetchApp.fetchAll(reqs);
  } catch (e) {
    Logger.log('news fetchAll 실패: ' + e);
    return [];
  }

  const items = [];
  const usRetry = [];
  stocks.forEach(function (s, i) {
    const parsed = _newsParse_(s, responses[i]);
    if (parsed === null && !s.isKR) { usRetry.push(s); return; }
    if (parsed) items.push.apply(items, parsed);
  });

  if (usRetry.length) {
    try {
      const retryRes = UrlFetchApp.fetchAll(usRetry.map(function (s) { return reqOf(usUrl(s, '.N')); }));
      usRetry.forEach(function (s, i) {
        const parsed = _newsParse_(s, retryRes[i]);
        if (parsed) items.push.apply(items, parsed);
      });
    } catch (e) { Logger.log('news US .N 재시도 실패: ' + e); }
  }
  return items;
}

/** 응답 1건 → 표준 아이템 배열. 실패/빈 응답이면 null (US는 null이면 .N 재시도 대상) */
function _newsParse_(s, res) {
  try {
    if (!res || res.getResponseCode() !== 200) return null;
    const body = JSON.parse(res.getContentText());
    if (s.isKR) {
      // [{total, items:[{titleFull|title, officeName, datetime(YYYYMMDDHHmm), mobileNewsUrl}]}, ...]
      const flat = [];
      (Array.isArray(body) ? body : []).forEach(function (g) {
        (g.items || []).forEach(function (it) {
          flat.push({
            code: s.code, name: s.name,
            title: _newsCleanTitle_(it.titleFull || it.title || ''),
            source: String(it.officeName || ''),
            dt: String(it.datetime || '').slice(0, 12),
            url: String(it.mobileNewsUrl || ''),
          });
        });
      });
      return flat.slice(0, NEWS_PER_STOCK);
    }
    // US: [{tit, ohnm, dt(YYYYMMDDHHMMSS)}, ...] — 기사 직링크 없음 → 종목 뉴스탭
    if (!Array.isArray(body) || body.length === 0) return null;
    return body.slice(0, NEWS_PER_STOCK).map(function (it) {
      return {
        code: s.code, name: s.name,
        title: _newsCleanTitle_(it.tit || ''),
        source: String(it.ohnm || ''),
        dt: String(it.dt || '').slice(0, 12),
        url: 'https://m.stock.naver.com/worldstock/stock/' + encodeURIComponent(s.code + '.O') + '/news',
      };
    });
  } catch (e) {
    return null;
  }
}

/**
 * US 보유 종목 다음 실적 발표일 — Yahoo quoteSummary (쿠키→crumb 2단 인증, 2026-08-06 로컬 실측).
 * 실패 시 빈 배열 (이벤트 패널에 실적 행만 빠짐 — 무해 degrade).
 */
function _newsUsEarnings_(usStocks) {
  if (!usStocks.length) return [];
  try {
    // 1. 세션 쿠키 (fc.yahoo.com은 404를 주지만 Set-Cookie는 내려줌)
    const r1 = UrlFetchApp.fetch('https://fc.yahoo.com', {
      muteHttpExceptions: true, followRedirects: false, headers: { 'User-Agent': NEWS_UA },
    });
    const setCookie = r1.getAllHeaders()['Set-Cookie'];
    const arr = setCookie ? (Array.isArray(setCookie) ? setCookie : [setCookie]) : [];
    const cookie = arr.map(function (c) { return String(c).split(';')[0]; }).join('; ');
    if (!cookie) return [];
    const opts = { muteHttpExceptions: true, headers: { 'User-Agent': NEWS_UA, 'Cookie': cookie } };

    // 2. crumb
    const crumb = UrlFetchApp.fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', opts)
      .getContentText().trim();
    if (!crumb || crumb.length > 30 || crumb.indexOf('<') !== -1) return [];

    // 3. 종목별 calendarEvents
    const out = [];
    usStocks.forEach(function (s) {
      try {
        const res = UrlFetchApp.fetch(
          'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(s.code) +
          '?modules=calendarEvents&crumb=' + encodeURIComponent(crumb), opts);
        if (res.getResponseCode() !== 200) return;
        const j = JSON.parse(res.getContentText());
        const r = j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
        const earn = r && r.calendarEvents && r.calendarEvents.earnings;
        const dates = earn && earn.earningsDate;
        if (dates && dates.length && dates[0].fmt) {
          out.push({
            code: s.code, name: s.name,
            date: String(dates[0].fmt),                       // YYYY-MM-DD (현지)
            estimate: earn.isEarningsDateEstimate === true,   // true면 추정일
          });
        }
      } catch (e) { /* 종목 단위 skip */ }
    });
    return out;
  } catch (e) {
    Logger.log('_newsUsEarnings_ 실패: ' + e);
    return [];
  }
}

/** 제목의 HTML 태그·엔티티 제거 */
function _newsCleanTitle_(t) {
  return String(t)
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}
