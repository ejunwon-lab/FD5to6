/**
 * Quick_Fix_KIS.gs
 * KIS API 즉시 수정 스크립트
 * 
 * 이 파일을 Google Apps Script에 추가하고 quickFixKIS 함수를 실행하세요.
 */

function quickFixKIS() {
  const ui = SpreadsheetApp.getUi();
  
  // 1. 먼저 현재 URL로 테스트
  let report = '🔧 KIS API 즉시 수정 시도\n\n';
  
  const urlsToTry = [
    "https://openapi.koreainvestment.com",           // 포트 없음
    "https://openapi.koreainvestment.com:443",       // 명시적 443
    "https://openapi.koreainvestment.com:9443",      // 공식 포트
  ];
  
  let workingUrl = null;
  
  for (const testUrl of urlsToTry) {
    report += `📌 테스트 중: ${testUrl}\n`;
    
    try {
      const url = `${testUrl}/oauth2/tokenP`;
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
      
      const res = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(res.getContentText());
      
      if (data.access_token) {
        workingUrl = testUrl;
        report += `✅ 성공! 이 URL이 작동합니다!\n\n`;
        
        // 즉시 토큰 저장
        const props = PropertiesService.getScriptProperties();
        const now = new Date().getTime();
        const expiresIn = data.expires_in * 1000;
        props.setProperty('KIS_ACCESS_TOKEN', data.access_token);
        props.setProperty('KIS_TOKEN_EXPIRY', String(now + expiresIn));
        
        break;
      } else {
        report += `❌ 응답은 받았으나 토큰 없음: ${data.msg1 || JSON.stringify(data)}\n\n`;
      }
    } catch (e) {
      if (e.toString().includes('Address unavailable')) {
        report += `❌ 차단됨 (Google Apps Script 제한)\n\n`;
      } else {
        report += `❌ 오류: ${e.toString()}\n\n`;
      }
    }
    
    Utilities.sleep(500);
  }
  
  if (workingUrl) {
    report += '='.repeat(50) + '\n';
    report += `🎉 해결 완료!\n\n`;
    report += `작동하는 URL: ${workingUrl}\n\n`;
    report += `다음 단계:\n`;
    report += `1. Secret.gs 파일을 엽니다\n`;
    report += `2. KIS_BASE_URL을 다음으로 변경:\n`;
    report += `   KIS_BASE_URL: "${workingUrl}"\n`;
    report += `3. 저장합니다\n\n`;
    report += `또는 아래 코드를 Secret.gs에 복사하세요:\n\n`;
    report += `const SECRET = {\n`;
    report += `  KIS_APP_KEY: '${SECRET.KIS_APP_KEY}',\n`;
    report += `  KIS_APP_SECRET: '${SECRET.KIS_APP_SECRET}',\n`;
    report += `  KIS_BASE_URL: "${workingUrl}"\n`;
    report += `};\n`;
  } else {
    report += '='.repeat(50) + '\n';
    report += `❌ 모든 URL 실패\n\n`;
    report += `가능한 원인:\n`;
    report += `1. Google Apps Script가 KIS API 접근을 차단\n`;
    report += `2. KIS API 서비스 일시 중단\n`;
    report += `3. API 키가 잘못되었거나 만료됨\n\n`;
    report += `해결 방법:\n`;
    report += `1. KIS Developers 포털에서 API 키 재확인\n`;
    report += `2. 프록시 서버 사용 고려\n`;
    report += `3. KIS 지원팀 문의: https://apiportal.koreainvestment.com/\n`;
  }
  
  Logger.log(report);
  ui.alert('KIS API 수정 완료', report, ui.ButtonSet.OK);
  
  // 성공했다면 즉시 테스트
  if (workingUrl) {
    Utilities.sleep(1000);
    testWithNewUrl(workingUrl);
  }
}

function testWithNewUrl(baseUrl) {
  const ui = SpreadsheetApp.getUi();
  let report = '🧪 새 URL 테스트\n\n';
  
  try {
    const token = PropertiesService.getScriptProperties().getProperty('KIS_ACCESS_TOKEN');
    const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=005930`;
    
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "authorization": "Bearer " + token,
      "appkey": SECRET.KIS_APP_KEY,
      "appsecret": SECRET.KIS_APP_SECRET,
      "tr_id": "FHKST01010100"
    };
    
    const res = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    
    if (data.rt_cd === "0") {
      const price = data.output.stck_prpr;
      report += `✅ 성공!\n`;
      report += `삼성전자 현재가: ${price}원\n\n`;
      report += `🎉 KIS API가 정상 작동합니다!\n`;
      report += `이제 종목현황 업데이트를 실행할 수 있습니다.\n`;
    } else {
      report += `⚠️ API 응답: ${data.msg1}\n`;
    }
  } catch (e) {
    report += `❌ 테스트 실패: ${e}\n`;
  }
  
  Logger.log(report);
  ui.alert('테스트 결과', report, ui.ButtonSet.OK);
}
