# 에러 로그

---

## 2026-04-27

### iOS 콜드 런치 "더 이상 사용할 수 없음" — 번들 ID 변경 후 구 앱 잔존
- **증상**: 앱 아이콘 탭 시 "Finance를 더 이상 사용할 수 없음" 다이얼로그. Xcode 실행·앱 스위처 재개는 정상
- **원인**: 번들 ID 변경(`com.jun` → `com.junwon`) 시 Xcode가 새 앱만 설치하고 구 앱은 삭제하지 않음. 홈 화면에 두 개의 Finance 앱이 생겨, 탭하던 아이콘이 만료된 구 앱이었음
- **해결**: 기기에서 구 앱 직접 삭제
- **교훈**: 번들 ID 변경 시 빌드 전에 기기에서 기존 앱 먼저 삭제 안내 필수

### iOS 서명 설정 누락 — XcodeGen 재생성 시 CODE_SIGN_STYLE 유실
- **증상**: 콜드 런치 실패 (위 에러와 복합)
- **원인**: XcodeGen 재생성 시 project.yml에 없던 `CODE_SIGN_STYLE = Automatic`이 pbxproj에서 삭제됨. DEVELOPMENT_TEAM도 이전 Mac 팀 ID(44DWWF283N) 잔류
- **해결**: project.yml에 `CODE_SIGN_STYLE: Automatic`, `DEVELOPMENT_TEAM: 3N9UDPW4BP` 명시
- **교훈**: XcodeGen 재생성 전 서명 설정이 project.yml에 모두 명시되어 있는지 확인

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

## 2026-04-27 (2)

### 모바일 앱 갱신 실패 — KIS 토큰 만료 시 재발급 실패
- **증상**: 모바일 앱에서 업데이트 시 "토큰 익스파이어" 에러. 시트에서 직접 "가격 갱신" 후에는 모바일이 정상 동작
- **원인**: KIS Access Token 24시간 만료 시, Apps Script API 실행 컨텍스트에서는 토큰 재발급이 간헐적으로 실패. 시트 직접 실행은 성공하여 Properties에 저장 → 이후 모바일은 유효 토큰 사용
- **해결**: 매일 오전 8:30 `runFullUpdate` 자동 트리거 등록 (`setupDailyTrigger()`). 장 시작 전 토큰을 사전 갱신하여 모바일 호출 시 항상 유효한 상태 보장
- **교훈**: GAS를 Apps Script API로 호출할 때 외부 API 토큰 재발급이 실패할 수 있음. 직접 실행 컨텍스트와 차이가 있을 수 있으므로 시간 트리거로 사전 갱신하는 패턴이 안전

### iOS 번들 ID 불일치로 설치 실패 (0xe8008016) — 재발
- **증상**: 다른 폰에 설치 시 "The executable was signed with invalid entitlements" (0xe8008016)
- **원인**: `PRODUCT_BUNDLE_IDENTIFIER`를 `com.junwon.fd5to6finance`로 변경했으나, `Sources/Info.plist`와 `project.yml info.properties`의 `CFBundleIdentifier`가 `com.jw.fd5to6finance`로 하드코딩 → 코드서명과 불일치
- **해결**: `Sources/Info.plist`의 `CFBundleIdentifier`를 `$(PRODUCT_BUNDLE_IDENTIFIER)` 변수로 변경. `project.yml`의 `info.properties`에서 `CFBundleIdentifier` 항목 제거 후 XcodeGen 재생성
- **교훈**: `CFBundleIdentifier`는 항상 `$(PRODUCT_BUNDLE_IDENTIFIER)` 변수로만 지정. 번들 ID 변경은 `project.yml`의 `PRODUCT_BUNDLE_IDENTIFIER` 한 곳만 수정

---

### GAS 지표 대부분 0 반환
- **증상**: 참고지표_히스토리에서 KOSPI/KOSDAQ 외 모두 0
- **원인 1**: 미국선물 심볼 `ES=F`, `NQ=F`는 GOOGLEFINANCE 미지원
- **원인 2**: 상품 선물 `CL=F`, `GC=F`는 GOOGLEFINANCE 미지원
- **원인 3**: KIS 해외지수 API 미검증으로 SPX/NDX 등 실패 가능
- **해결**: ES/NQ → Yahoo Finance API로 변경. CL/GC → `NYMEX:CL1!`, `COMEX:GC1!`로 변경. SPX/NDX/DJI/SOX → gfSymbol fallback 추가
