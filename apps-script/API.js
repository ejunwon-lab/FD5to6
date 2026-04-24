/**
 * API.gs
 * 외부 데이터 연동 (네이버 금융 등)
 */

/**
 * 네이버 ETF 전체 목록 API 호출
 * 최적화: 호출 실패 시 빈 배열 반환하고 로그 남김
 */
function getNaverEtfWholeList() {
  try {
    const url = "https://finance.naver.com/api/sise/etfItemList.nhn";
    const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error("ETF API 실패 " + r.getResponseCode());
    const j = JSON.parse(r.getContentText());
    return j.result?.etfItemList || [];
  } catch (e) {
    Logger.log("getNaverEtfWholeList 오류:" + e);
    return [];
  }
}

/**
 * 네이버 금융 ETF 상세 페이지 크롤링
 */
function getNaverEtfInfo(code) {
  try {
    const url = 'https://finance.naver.com/item/main.naver?code=' + code;
    const html = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText('euc-kr');
    let p = html.match(/<span[^>]*class="blind"[^>]*>([\d,]+)<\/span>/);
    if (p && p[1]) return { price: parseInt(p[1].replace(/,/g, '')) };
    return { price: "" };
  } catch (e) {
    return { price: "" };
  }
}

/**
 * 네이버 금융 주식 상세 페이지 크롤링
 */
function getNaverStockInfo(code) {
  try {
    const url = 'https://finance.naver.com/item/main.naver?code=' + code;
    const html = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText('euc-kr');
    const m = html.match(/<span[^>]*class="blind"[^>]*>([\d,]+)<\/span>/);
    if (m && m[1]) return { price: parseInt(m[1].replace(/,/g, '')) };
    return { price: "" };
  } catch (e) {
    return { price: "" };
  }
}

/**
 * 미래에셋 Tiger ETF 가격 크롤링 (보조)
 */
function getMiraeTigerETFPrice(code) {
  try {
    if (!(code === '0047A0' || code === 'A0047A0')) return "";
    const html = UrlFetchApp.fetch('https://www.tigeretf.com/ko/product/search/detail/index.do?ksdFund=KR70047A0007', { muteHttpExceptions: true }).getContentText('utf-8');
    const m = html.match(/<span class="price">([\d,]+)<\/span>/);
    if (m && m[1]) return parseInt(m[1].replace(/,/g, ''));
    return "";
  } catch (e) {
    return "";
  }
}