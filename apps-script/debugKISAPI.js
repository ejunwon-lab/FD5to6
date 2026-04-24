/**
 * Debug_KIS.gs
 * KIS API 문제 진단용 디버깅 스크립트
 * 
 * 사용법: Google Apps Script 편집기에서 debugKISAPI 함수를 실행하세요.
 */

function debugKISAPI() {
  const ui = SpreadsheetApp.getUi();
  let report = '🔍 KIS API 진단 결과\n';
  report += '='.repeat(50) + '\n\n';
  
  // 1. SECRET 확인
  report += '📌 1단계: SECRET 설정 확인\n';
  try {
    if (typeof SECRET === 'undefined') {
      report += '❌ CRITICAL: SECRET 객체가 정의되지 않았습니다!\n';
      report += '→ Secret.gs 파일이 있는지 확인하세요.\n\n';
      Logger.log(report);
      ui.alert('진단 결과', report, ui.ButtonSet.OK);
      return;
    }
    
    if (!SECRET.KIS_APP_KEY || SECRET.KIS_APP_KEY === '여기에_APP_KEY_입력') {
      report += '❌ CRITICAL: KIS_APP_KEY가 설정되지 않았습니다!\n';
      report += '→ 로컬 파일만 확인하신 것 같습니다.\n';
      report += '→ Google Apps Script 편집기에서 Secret.gs를 직접 확인하세요.\n\n';
    } else {
      report += '✅ KIS_APP_KEY 설정됨: ' + SECRET.KIS_APP_KEY.substring(0, 10) + '...\n';
    }
    
    if (!SECRET.KIS_APP_SECRET || SECRET.KIS_APP_SECRET === '여기에_APP_SECRET_입력') {
      report += '❌ CRITICAL: KIS_APP_SECRET이 설정되지 않았습니다!\n\n';
    } else {
      report += '✅ KIS_APP_SECRET 설정됨: ' + SECRET.KIS_APP_SECRET.substring(0, 10) + '...\n';
    }
    
    report += '✅ KIS_BASE_URL: ' + SECRET.KIS_BASE_URL + '\n\n';
  } catch (e) {
    report += '❌ ERROR: ' + e.toString() + '\n\n';
  }
  
  // 2. 토큰 발급 테스트
  report += '📌 2단계: 토큰 발급 테스트\n';
  try {
    const url = `${SECRET.KIS_BASE_URL}/oauth2/tokenP`;
    const payload = {
      "grant_type": "client_credentials",
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    report += '→ 요청 URL: ' + url + '\n';
    report += '→ 요청 중...\n';
    
    const res = UrlFetchApp.fetch(url, options);
    const statusCode = res.getResponseCode();
    const responseText = res.getContentText();
    
    report += '→ HTTP 상태 코드: ' + statusCode + '\n';
    
    if (statusCode === 200) {
      const data = JSON.parse(responseText);
      
      if (data.access_token) {
        report += '✅ 토큰 발급 성공!\n';
        report += '→ 토큰: ' + data.access_token.substring(0, 30) + '...\n';
        report += '→ 만료시간: ' + data.expires_in + '초\n\n';
        
        // 토큰을 저장
        const props = PropertiesService.getScriptProperties();
        const now = new Date().getTime();
        const expiresIn = data.expires_in * 1000;
        props.setProperty('KIS_ACCESS_TOKEN', data.access_token);
        props.setProperty('KIS_TOKEN_EXPIRY', String(now + expiresIn));
        
      } else {
        report += '❌ 토큰 발급 실패!\n';
        report += '→ 응답: ' + responseText + '\n\n';
        Logger.log(report);
        ui.alert('진단 결과', report, ui.ButtonSet.OK);
        return;
      }
    } else {
      report += '❌ HTTP 오류 발생!\n';
      report += '→ 응답: ' + responseText + '\n\n';
      Logger.log(report);
      ui.alert('진단 결과', report, ui.ButtonSet.OK);
      return;
    }
  } catch (e) {
    report += '❌ 토큰 발급 중 예외 발생!\n';
    report += '→ 오류: ' + e.toString() + '\n\n';
    Logger.log(report);
    ui.alert('진단 결과', report, ui.ButtonSet.OK);
    return;
  }
  
  // 3. 국내 주식 조회 테스트 (삼성전자)
  report += '📌 3단계: 국내 주식 조회 테스트 (삼성전자)\n';
  try {
    const token = PropertiesService.getScriptProperties().getProperty('KIS_ACCESS_TOKEN');
    const code = '005930';
    const url = `${SECRET.KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`;
    
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "FHKST01010100"
    };
    
    report += '→ 요청 URL: ' + url + '\n';
    report += '→ 요청 중...\n';
    
    const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    const statusCode = res.getResponseCode();
    const responseText = res.getContentText();
    
    report += '→ HTTP 상태 코드: ' + statusCode + '\n';
    
    if (statusCode === 200) {
      const data = JSON.parse(responseText);
      report += '→ rt_cd: ' + data.rt_cd + '\n';
      report += '→ msg_cd: ' + data.msg_cd + '\n';
      report += '→ msg1: ' + data.msg1 + '\n';
      
      if (data.rt_cd === "0") {
        const out = data.output;
        report += '✅ 주식 조회 성공!\n';
        report += `→ 삼성전자 현재가: ${out.stck_prpr}원\n`;
        report += `→ 전일대비: ${out.prdy_vrss}원 (${out.prdy_ctrt}%)\n`;
        report += `→ 52주 최고: ${out.w52_hgpr}원\n`;
        report += `→ 52주 최저: ${out.w52_lwpr}원\n\n`;
      } else {
        report += '❌ API 응답 오류!\n';
        report += '→ 전체 응답: ' + responseText.substring(0, 500) + '\n\n';
      }
    } else {
      report += '❌ HTTP 오류!\n';
      report += '→ 응답: ' + responseText.substring(0, 500) + '\n\n';
    }
  } catch (e) {
    report += '❌ 주식 조회 중 예외 발생!\n';
    report += '→ 오류: ' + e.toString() + '\n\n';
  }
  
  // 4. 해외 주식 조회 테스트 (AAPL)
  report += '📌 4단계: 해외 주식 조회 테스트 (AAPL)\n';
  try {
    const token = PropertiesService.getScriptProperties().getProperty('KIS_ACCESS_TOKEN');
    const code = 'AAPL';
    const excd = 'NAS';
    const url = `${SECRET.KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${code}`;
    
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "HHDFS00000300"
    };
    
    report += '→ 요청 URL: ' + url + '\n';
    report += '→ 요청 중...\n';
    
    const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    const statusCode = res.getResponseCode();
    const responseText = res.getContentText();
    
    report += '→ HTTP 상태 코드: ' + statusCode + '\n';
    
    if (statusCode === 200) {
      const data = JSON.parse(responseText);
      report += '→ rt_cd: ' + data.rt_cd + '\n';
      report += '→ msg_cd: ' + data.msg_cd + '\n';
      report += '→ msg1: ' + data.msg1 + '\n';
      
      if (data.rt_cd === "0" && data.output) {
        const out = data.output;
        report += '✅ 해외 주식 조회 성공!\n';
        report += `→ AAPL 현재가: $${out.last}\n`;
        report += `→ 전일대비: $${out.diff} (${out.rate}%)\n\n`;
      } else {
        report += '❌ API 응답 오류!\n';
        report += '→ 전체 응답: ' + responseText.substring(0, 500) + '\n\n';
      }
    } else {
      report += '❌ HTTP 오류!\n';
      report += '→ 응답: ' + responseText.substring(0, 500) + '\n\n';
    }
  } catch (e) {
    report += '❌ 해외 주식 조회 중 예외 발생!\n';
    report += '→ 오류: ' + e.toString() + '\n\n';
  }
  
  // 최종 요약
  report += '='.repeat(50) + '\n';
  report += '✅ 진단 완료\n';
  report += '\n위 결과를 확인하여 문제를 파악하세요.\n';
  report += '로그(보기 → 로그)에서도 같은 내용을 확인할 수 있습니다.\n';
  
  Logger.log(report);
  ui.alert('KIS API 진단 완료', report, ui.ButtonSet.OK);
}

/**
 * 간단 버전: 토큰만 확인
 */
function quickCheckToken() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('KIS_ACCESS_TOKEN');
  const expiry = props.getProperty('KIS_TOKEN_EXPIRY');
  
  let msg = '토큰 상태:\n\n';
  
  if (!token) {
    msg += '❌ 토큰이 없습니다.\n';
    msg += '→ debugKISAPI를 실행하여 토큰을 발급받으세요.';
  } else {
    const now = new Date().getTime();
    const isValid = expiry && now < Number(expiry) - 60000;
    const remainingMin = expiry ? Math.floor((Number(expiry) - now) / 1000 / 60) : 0;
    
    msg += '토큰: ' + token.substring(0, 30) + '...\n';
    msg += '유효성: ' + (isValid ? '✅ 유효' : '❌ 만료') + '\n';
    msg += '남은 시간: ' + remainingMin + '분\n';
  }
  
  Logger.log(msg);
  SpreadsheetApp.getUi().alert('토큰 상태', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
