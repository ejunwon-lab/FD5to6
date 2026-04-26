# 에러 로그

---

## 2026-04-24

### NavigationStack + PageTabViewStyle 충돌
- **증상**: 앱 실행 시 까만 화면, "Layout requested for visible navigation bar... nested navigation controllers" 로그
- **원인**: PageTabViewStyle 내부 뷰에 NavigationStack을 중첩하면 iOS가 충돌
- **해결**: 모든 뷰에서 NavigationStack 제거. `.navigationTitle`, `.toolbar` 대신 커스텀 헤더 VStack 사용
- **교훈**: PageTabViewStyle과 NavigationStack은 함께 쓸 수 없음

### pull-to-refresh CancellationError
- **증상**: 화면을 당겼다 놓으면 "Cancelled" 에러 메시지 표시
- **원인**: SwiftUI refreshable이 취소될 때 CancellationError를 throw하는데 일반 catch에서 에러로 처리됨
- **해결**: `catch is CancellationError { }` 별도 분기로 무시. `guard !isLoading` 추가로 중복 호출 방지

### Color(.separator) 컴파일 에러
- **증상**: "No exact matches in call to initializer"
- **원인**: SwiftUI의 `Color(.separator)`는 특정 버전에서 모호한 오버로드
- **해결**: `Color(UIColor.separator)`로 변경

### _IS_MOBILE_CALL 전역변수 중첩 호출 덮어쓰기
- **증상**: 앱에서 "Cannot read properties of null (reading 'alert')" 에러
- **원인**: `mobileUpdateAll()` → `runFullUpdate()` → `updateReferenceIndicators()` → `mobileGetReferenceIndicators()` 중첩 호출 시, 내부 함수의 `finally { _IS_MOBILE_CALL = false }` 가 외부 호출의 `true` 상태를 덮어씀. 이후 `runFullUpdate()`에서 `ui = null` 인데 `ui.alert()` 호출
- **해결**: `mobileGetReferenceIndicators()` 시작 시 `_prevMobileCall` 에 현재 값 저장, `finally` 에서 `false` 대신 저장값으로 복원
- **교훈**: 전역 플래그를 여러 함수가 공유할 때 중첩 호출 시 덮어쓰기 위험. 항상 이전 값을 저장·복원하는 패턴 사용

---

## 2026-04-26

### iOS 앱 타기기 설치 시 서명 에러 (0xe8008016)
- **증상**: `The executable was signed with invalid entitlements` — 설치 실패
- **원인**: `Info.plist`의 `CFBundleIdentifier`가 `com.jw.fd5to6finance`로 하드코딩되어 있었고, 코드사인은 `com.jun.fd5to6finance`로 서명 → 불일치
- **해결**: `CFBundleIdentifier`를 `$(PRODUCT_BUNDLE_IDENTIFIER)`로 변경. `project.pbxproj` 및 `BackgroundNetworkSession.swift`의 구 번들 ID도 함께 수정
- **교훈**: Info.plist의 CFBundleIdentifier는 반드시 `$(PRODUCT_BUNDLE_IDENTIFIER)` 변수로 지정해야 빌드 설정과 일치함

---

### GAS 지표 대부분 0 반환
- **증상**: 참고지표_히스토리에서 KOSPI/KOSDAQ 외 모두 0
- **원인 1**: 미국선물 심볼 `ES=F`, `NQ=F`는 GOOGLEFINANCE 미지원
- **원인 2**: 상품 선물 `CL=F`, `GC=F`는 GOOGLEFINANCE 미지원
- **원인 3**: KIS 해외지수 API 미검증으로 SPX/NDX 등 실패 가능
- **해결**: ES/NQ → Yahoo Finance API로 변경. CL/GC → `NYMEX:CL1!`, `COMEX:GC1!`로 변경. SPX/NDX/DJI/SOX → gfSymbol fallback 추가
