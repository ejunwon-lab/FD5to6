/**
 * TransactionSheet.gs
 * 거래 입력 시트 생성 및 관리
 */

/**
 * 거래 입력 시트 생성
 */
function createTransactionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTION);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAMES.TRANSACTION);
  }
  
  sheet.clear();
  
  // 헤더
  sheet.getRange('A1').setValue('💳 거래 입력').setFontSize(16).setFontWeight('bold');
  sheet.getRange('A2').setValue('매수/매도 거래를 입력하고 [입력] 버튼을 클릭하세요.').setFontSize(10);
  
  // 입력 폼
  const labels = [
    ['거래 유형', ''],
    ['종목 코드', ''],
    ['종목명', ''],
    ['분류', ''],
    ['거래소', ''],
    ['증권사', ''],
    ['구분', ''],
    ['수량', ''],
    ['단가', ''],
    ['수수료', ''],
    ['매입일/매도일', '']
  ];
  
  sheet.getRange('A3:B13').setValues(labels);
  sheet.getRange('A3:A13').setFontWeight('bold').setBackground('#e8f0fe');
  sheet.getRange('B3:B13').setBackground('#ffffff');
  
  // 열 너비 조정
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 200);
  
  // 데이터 유효성 검사
  const txTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['매수', '매도'], true)
    .build();
  sheet.getRange('B3').setDataValidation(txTypeRule);
  
  const categoryRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['주식', 'ETF', '채권', '펀드', '기타'], true)
    .build();
  sheet.getRange('B6').setDataValidation(categoryRule);
  
  const exchangeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['한국', '미국', '영국', '기타'], true)
    .build();
  sheet.getRange('B7').setDataValidation(exchangeRule);
  
  const brokerRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['삼성증권', '미래애셋투자증권'], true)
    .build();
  sheet.getRange('B8').setDataValidation(brokerRule);
  
  const accountTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['종합', 'ISA', '퇴직연금_개인형IRP(범용)', '종합_랩', '퇴직연금_개인IRP'], true)
    .build();
  sheet.getRange('B9').setDataValidation(accountTypeRule);
  
  // 오늘 날짜 자동 입력
  sheet.getRange('B13').setValue(new Date()).setNumberFormat('yyyy"년" m"월" d"일"');
  
  // 입력 버튼 (Drawing으로 대체 가능, 여기서는 셀로 표현)
  sheet.getRange('A15').setValue('[ 입력 ]')
    .setFontSize(14)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeight(15, 40);
  
  // 안내 메시지
  sheet.getRange('A17').setValue('📌 안내사항').setFontWeight('bold');
  sheet.getRange('A18').setValue('• 매수: 같은 종목코드+증권사+구분+분류면 수량/평균단가 업데이트, 아니면 새 행 추가');
  sheet.getRange('A19').setValue('• 매도: 보유 수량 차감 + 매도 기록 추가');
  sheet.getRange('A20').setValue('• 전량 매도 시: 해당 행이 매도 기록 섹션으로 이동');
  
  SpreadsheetApp.getUi().alert('✅ 거래 입력 시트가 생성되었습니다.\n\n"[ 입력 ]" 셀을 클릭하면 processTransaction 함수를 실행하도록 스크립트를 연결해주세요.');
}

/**
 * 거래 입력 시트로 이동
 */
function openTransactionSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTION);
  
  if (!sheet) {
    createTransactionSheet();
    sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TRANSACTION);
  }
  
  sheet.activate();
}
