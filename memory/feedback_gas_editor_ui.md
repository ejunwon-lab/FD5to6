---
name: GAS 에디터 직접 실행 시 getUi() 금지
description: GAS 에디터에서 직접 실행 가능한 함수에 SpreadsheetApp.getUi().alert() 쓰면 응답 없이 멈춤
type: feedback
originSessionId: 4b242a8a-8cf2-4b18-9775-e5e60c528468
---
에디터 직접 실행 가능한 GAS 함수(setup 함수, trigger 등록 함수 등)에서는 `SpreadsheetApp.getUi().alert()` 사용 금지.

**Why:** UI 컨텍스트가 없는 에디터 환경에서 `getUi()`가 응답 없이 대기 상태에 빠짐. 트리거 등록 자체는 완료됐지만 사용자는 "계속 실행 중"으로 보임.

**How to apply:** 에디터 직접 실행 가능한 함수에서는 `Logger.log()`로 결과 출력. 시트 메뉴에서만 호출되는 함수는 `getUi().alert()` 사용 가능.
