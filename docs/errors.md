# 에러 로그

---

## 2026-05-29

### routine이 prompt 무시하고 가이드 파일의 옛 URL 사용 → "Worker가 IP 차단"으로 오진단
- **증상**: routine prompt에 Worker URL + "GAS 직접 호출 금지" 명시했는데도 1차 update 후 run에서 또 403 받음. routine 보고: "Cloudflare Worker가 routine IP를 차단"
- **원인**:
  - routine이 `docs/market-report-routines.md` Read 후 가이드의 GAS URL(`script.google.com/.../exec`)을 사용 — prompt Step 4의 Worker URL을 무시
  - 받은 403의 응답 본문은 `"Host not in allowlist"` ← **GAS가 응답하는 문자열**. Worker는 secret 불일치 시 `'forbidden'` 응답하므로 다름
  - 즉 routine이 호출한 곳은 GAS이고, 그것을 Worker 탓으로 잘못 진단·보고
- **검증**: 로컬에서 같은 Worker URL로 curl POST → 200 OK · 시트 적재 정상. Worker는 IP allowlist 없음 (worker.js 코드에 `request.headers.get` secret 검증만 있음)
- **해결**: routine prompt 강화 — (a) "절대 규칙" 섹션 맨 위에 GAS URL 금지 명시, (b) "가이드 Read 권장 안 함, prompt 절대 우선", (c) 가이드 파일 자체도 Worker URL로 갱신해 충돌 제거, (d) 실패 보고 시 *실제 호출한 URL* 명시 의무화
- **교훈**:
  - **routine prompt가 외부 파일을 Read하게 두면 prompt vs 파일 충돌 발생 가능**. self-contained 권장. 가이드 Read는 보조 정도로만
  - **routine의 실패 진단 보고를 곧이곧대로 믿지 말 것** — Claude가 자기가 한 행동을 잘못 분석할 수 있음. 응답 본문·실제 호출 URL을 명시하라고 prompt에서 강제
  - 응답 403의 본문 문자열이 어느 layer에서 왔는지(Worker `'forbidden'` vs GAS `"Host not in allowlist"`) 비교가 layered proxy 디버깅의 결정적 단서

### claude.ai routines → GAS Web App 403 "Host not in allowlist"
- **증상**: claude.ai routine 환경에서 `script.google.com`에 GET/POST 모두 403 "Host not in allowlist" 응답. GAS doPost 도달 전 Google 인프라 차원 거부. 어제 등록한 시장 리포트 routine 2개가 리포트 작성 후 POST 단계에서 실패
- **원인**: claude.ai routine 실행 컨테이너(Anthropic 클라우드)의 IP 대역이 Google Apps Script Web App의 allowlist에 없음. **GAS 코드·인증·oauthScopes 모두 무관** — Anthropic IP 자체 차단. routine 외 환경(로컬·Cloudflare·일반 인터넷)에선 정상 동작
- **해결**: 기존 Cloudflare Worker (`apps-script-v2/cloudflare-worker/worker.js`)를 routine → GAS proxy로 재사용. Worker는 globally distributed라 Google allowlist에 포함된 IP에서 forward. Worker 코드 변경 0줄 — 이미 단순 forward 구조 (헤더 검증 후 body 그대로 GAS로). routine 프롬프트의 POST URL을 GAS `/exec`에서 Worker URL로 변경 + `X-Telegram-Bot-Api-Secret-Token` 헤더 추가하면 끝
- **교훈**:
  - **claude.ai routine은 GAS Web App을 직접 호출할 수 없다.** 우회 proxy (Cloudflare Worker 등) 필수
  - 이미 있는 Telegram Worker proxy를 다른 용도(시장 리포트 적재)로도 재사용 가능 — 같은 인증 체계 + 단순 forward 구조 덕분
  - 새 외부 시스템에서 GAS doPost를 호출하는 모든 경우 같은 문제 가능성 — IP allowlist 차단을 우선 의심

### "You do not have permission to call UrlFetchApp.fetch. Required permissions: http"
- **증상**: 시트 ⚡ 전체 업데이트 또는 트리거 실행 시 마지막 갱신 실패 메시지에 `Required permissions: http`. 시각 09:13에 발생 (정규 트리거 슬롯 아님 — 사용자 수동 클릭 추정)
- **원인**: `appsscript.json`에 `oauthScopes`가 명시되어 있지 않으면 GAS가 스코프를 *자동 추론*. 평소엔 작동하나 **새 deployment 생성·권한 동의 흐름 리셋 시 추론 스코프에서 `script.external_request`(UrlFetchApp 권한)가 누락되는 경우 발생**. 2026-05-28 시장 리포트 큐 인프라 추가로 새 deployment 생성한 것이 트리거
- **해결**: `appsscript.json`에 `oauthScopes` 명시 (`spreadsheets`·`script.external_request`·`script.scriptapp`·`calendar.readonly`·`userinfo.email`) + `push_safe.py` 재배포 + 사용자가 Apps Script 에디터에서 UrlFetchApp 호출 함수 1회 실행해 권한 재승인
- **교훈**:
  - 새 deployment 생성 시 권한 동의 흐름이 리셋될 수 있음. `oauthScopes` 명시는 GAS 프로젝트 기본값으로 둘 것
  - "Required permissions" 메시지가 보이면 스코프 누락 또는 동의 만료 — `appsscript.json` 점검이 first stop

---

## 2026-05-28

### `deploy-web.yml` 수동 trigger 후 `/desk/` 폴더 통째로 삭제 (404)
- **증상**: web (PWA) 만 배포했는데 `https://ejunwon-lab.github.io/FD5to6/desk/` 가 404. desk hash 자체가 fetch 안 됨
- **원인**: `peaceiris/actions-gh-pages@v4` 의 *기본 동작*은 `publish_dir` 내용으로 gh-pages 브랜치 *전체 덮어쓰기*. `deploy-web-desk.yml` 은 `keep_files: true` + `destination_dir: desk` 로 desk/ 하위만 갱신·기존 보존인데, `deploy-web.yml` 은 *둘 다 없이* gh-pages 루트 덮어쓰기 → desk/ 폴더 통째 삭제
- **해결**:
  - `deploy-web.yml` 에 `keep_files: true` 추가 → 향후 web 배포 시 desk/ 등 서브 deployment 보존
  - `deploy-web-desk` workflow 수동 trigger (`gh workflow run deploy-web-desk.yml --ref main`) → `/desk/` 복원
- **참고 사고 (별건)**: `peaceiris/actions-gh-pages@v4` action 다운로드가 `codeload.github.com` 일시 장애로 3회 fail. 30~60분 두고 재시도하니 회복. *GitHub 인프라 일시 장애 패턴* — 같은 commit SHA가 캐시 미스되면 가끔 발생, 시간 두고 재시도가 정답

---

## 2026-05-26

### 시계열 그래프에 주말·공휴일이 표시되는 문제 (errors.md 2026-05-17 같은 패턴 확장)
- **증상**: 대시보드/데스크 차트 (equityCurve·IndicatorHistory·priceHistory) X축에 토·일·공휴일이 그대로 노출되어 시각 노이즈 + Benchmark 차트 등에서 date 매칭 어긋남
- **원인**: GAS 응답에서 비거래일 행을 drop하지 않음. 2026-05-17에 *현재가_이력*은 처리됐지만 다른 시계열 endpoint는 미처리
- **해결**: 3개 시계열 endpoint에 `_isTradingDateStr(dateStr)` (Holidays.js의 *휴장일* 시트 + 토/일 체크) filter 추가 — 시트는 그대로, 응답에서만 drop
  - `newMobileGetProfitHistory` (추이 기록 → equityCurve)
  - `newMobileGetIndicatorHistory` (참고지표_히스토리)
  - `newMobileGetStockDetail` priceHistory (안전망)
- **영향**: 4개 클라이언트 (web-desk·web·iOS·Telegram) 모두 자동 혜택. *추이 기록* 시트 자체는 보존 → 데이터 손실 0

---

## 2026-05-23

### Telegram webhook 간헐 실패 — Telegram이 GAS 302 redirect를 안 따라감 (Cloudflare Worker proxy로 해결)
- **증상**: webhook URL·access·doPost 모두 정상인데 "ㄱㄱ" 메시지에 *간헐적으로만* 응답. `getWebhookInfo`에 `last_error: Wrong response from the webhook: 302 Moved Temporarily`. pending_update_count 누적
- **원인**: GAS Web App POST는 항상 `googleusercontent.com/macros/echo?user_content_key=...`로 302 redirect 응답. Telegram의 webhook 전송 클라이언트가 이 redirect를 *때때로* 안 따라감 → 302를 final response로 간주해 에러 기록 → backoff
- **확정 진단**:
  - Python urllib·Node fetch·CF Workers fetch (WHATWG fetch spec 준수) → POST → 302 follow → 200 + 'forbidden'/'ok'
  - curl `-L --post302` → 405 `allow: HEAD, GET` (curl이 redirect target에 다시 POST 보내는데 그 endpoint는 GET만 허용 — **이게 진단 1시간+ 헛돌이의 원인**)
- **해결**: Cloudflare Worker proxy 도입
  - Telegram → Worker(secret_token 헤더 검증) → GAS /exec(redirect:'follow') → 200 → Telegram에 직결
  - Worker 코드 30줄, 무료 티어로 충분, 비용 0
  - 셋업: `apps-script-v2/cloudflare-worker/README.md`
- **추가 함정 — Cloudflare secret deploy gotcha**:
  - Settings에서 secret 추가하면 **새 version만 만들고 active deployment는 옛 버전 유지**. UI에 "deploy required" 알림 없음
  - 진단: Deployments 탭 → Version History에서 "Add secret: ..." version에 파란 막대(active) 없음 → 수동 promote 필요
  - 해결: 최신 version 우측 `···` → "Deploy this version"
- **교훈**:
  - **GAS Web App 디버깅에 curl 결과 단독 신뢰 금지**. Python urllib·Node fetch·등 spec 준수 클라이언트로 교차 검증 ([[feedback_gas_curl_diagnosis]])
  - Telegram webhook + GAS Web App 조합은 *간헐적으로 깨짐* — 신뢰성 필요하면 Cloudflare Worker 같은 proxy 필요
  - Cloudflare Workers: secret 변경 후 반드시 Deployments 탭에서 최신 version active 확인

---

### Telegram webhook 302/405 — appsscript.json `webapp.access: MYSELF`가 익명 POST 차단
- **증상**: webhook 등록은 성공("Webhook was set")하지만 Telegram에서 "갱신" 보내도 응답 없음. `getWebhookInfo`에 `last_error: Wrong response from the webhook: 302 Moved Temporarily` + `pending_update_count` 누적
- **검증**:
  - GET 익명 호출(시크릿 브라우저)은 정상 → "doGet 함수 없음" 페이지 (deployment 살아있음)
  - POST는 302 → googleusercontent.com/macros/echo → 405 `allow: HEAD, GET` (POST 차단)
  - **결정적 진단**: curl의 `--post302`는 redirect 처리에서 405를 보이지만, Python urllib(RFC 준수 redirect-following)로 같은 URL POST 치면 **200 + 'forbidden'** — doPost가 실제로 실행됨을 확인. 즉 deployment에 따라 다름
- **원인**: `appsscript.json`의 `"webapp": {"access": "MYSELF"}` — GAS Web App 배포 시 manifest의 access 값이 deployment에 캡쳐됨. UI에서 "모든 사용자"로 설정해도 deployment 메타데이터의 access는 manifest 값을 따라가는 비대칭 동작 (GET은 풀리지만 POST 라우팅은 manifest 우선)
- **해결**:
  1. `appsscript.json` → `"webapp": {"access": "ANYONE_ANONYMOUS", "executeAs": "USER_DEPLOYING"}` 로 변경
  2. push (manifest 갱신)
  3. **새 deployment 생성** ("새 배포" — 기존 편집 X). 기존 deployment는 만들어진 시점의 access 값에 묶여있어 변경 안 됨
  4. 새 URL을 Properties `TG_WEBAPP_URL`로 교체 후 `tgInstallWebhook` 재실행
- **부수 방어선** (이번에 함께 도입):
  - `tgInstallWebhook`이 자동 감지된 URL이 /dev면 거부, /exec만 사용 (`ScriptApp.getService().getUrl()`이 에디터 컨텍스트에서 /dev 반환하는 별개 함정)
  - `tgEnsureWebhookHealthy` — `getWebhookInfo`로 상태 점검 → 비정상 시 자동 재등록 (5분 throttle), 30분 트리거 + 모든 진입점 안전망
- **교훈**:
  - GAS Web App **익명 POST 필수** 시 `appsscript.json`의 `access: ANYONE_ANONYMOUS` 명시. UI 설정과 manifest 값이 어긋나면 POST만 미묘하게 차단됨
  - **GAS Web App 디버깅 시 curl은 신뢰 금지**. `--post302`나 default redirect 변환이 RFC와 다르게 동작해 405를 만들어내 진짜 원인을 가림. Python urllib·requests 같은 표준 클라이언트로 교차 검증
  - "head 코드와 deployment 코드 별개" 원칙이 *manifest*에도 적용됨 — manifest를 push해도 기존 deployment의 권한·실행 사용자 메타데이터는 안 바뀜. **새 deployment 생성 필수**

---

### Telegram webhook 무한 루프 — 무거운 갱신 + update_id 중복 미처리
- **증상**: Telegram 봇에 "갱신" 1번 보냈는데 봇이 손익 메시지 + "갱신중..." 무한 반복. 사용자가 "그만" 보내도 멈추지 않음
- **원인 1**: `tgRefreshAndPush`가 `newMobileUpdateAll()` 호출 → KIS 가격 + 보유현황 + 대시보드 + 추이 전체 갱신 → 30초+ 소요 → Telegram이 webhook 응답 못 받고 같은 `update_id`로 retry → GAS doPost가 또 처리 → 무한 루프
- **원인 2**: doPost가 `update_id`를 검사하지 않아 retry된 update를 새 메시지로 처리
- **원인 3 (별도 함정)**: Web App deployment는 *배포 시점의 코드*를 영구히 실행. `clasp push` 후 새 deployment를 만들거나 "배포 관리 → 신규 버전"으로 갱신해야 새 코드 반영. 시간 트리거(`tgPushPnL`)는 head 코드를 직접 실행하므로 무관
- **해결**:
  1. `update_id` 중복 제거 — PropertiesService에 마지막 처리한 ID 저장, 같으면 즉시 ok 반환
  2. `LockService.tryLock(1000)` — 동시 처리 차단
  3. 갱신 작업 경량화 — `updateNewPriceHistory` + `updatePositionFromLedger`만 (대시보드 렌더·`logToTrendSheet` 생략)
  4. `setWebhook` 옵션에 `max_connections:1`·`drop_pending_updates:true`
  5. 코드 수정 후 **"배포 관리 → 신규 버전"** 실행 (이 단계 누락이 1차 수정이 안 먹은 직접 원인)
- **교훈**:
  - GAS doPost가 외부 webhook을 받으면 retry 가능성 항상 고려 → update_id/event_id 같은 멱등 키 필수
  - Web App 코드 수정은 `clasp push`만으론 반영 안 됨. deployment 버전 갱신 또는 신규 deployment 필요. **head 코드(시간 트리거·`scripts.run`)와 deployment 코드(`/exec`)는 별개**
  - 외부에서 호출하는 webhook 핸들러는 응답 빠르게(<10초) 만들고, 무거운 작업은 트리거로 분리하거나 락으로 직렬화

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

---

## 2026-05-17

### 대시보드 변동 라벨이 "최근"이어야 할 때 "오늘"로 표시 (iOS/웹)
- **증상**: 비거래일(일요일)에 대시보드가 "오늘 수익"으로 표시. 잠깐 정상("최근")이다가 다시 "오늘"로 바뀜. 금액도 금요일 수익이 아닌 0에 가깝게 나옴
- **원인**: `updateNewPriceHistory()`(NewSystem.js)가 거래일 여부를 확인하지 않고 *현재가_이력*에 오늘 날짜 행을 추가 → 주말에 업데이트 버튼을 누르면 비거래일 날짜 행이 누적됨. 그 결과 `priceAsOfDate`(마지막 행 날짜)가 비거래일 날짜가 되어 `decideChangeLabel`이 "오늘" 반환. `_mCalcExtras`의 변동 계산도 `주말가−금요일가≈0`으로 오염 ("작동하다 바뀜" = 캐시(정상)→fresh fetch(오염))
- **해결**: (A) `updateNewPriceHistory`에 `_mIsTradingDay()` 가드 추가 — 비거래일엔 행 미기록. (B) `priceAsOfDate`는 마지막 *거래일* 행을 역방향 스캔, `_mCalcExtras`는 비거래일 행 필터링 (`_isTradingDateStr` 헬퍼 추가). (C) 클라이언트 `decideChangeLabel`(changeLabel.ts/ChangeLabel.swift)이 비거래일이면 priceAsOfDate와 무관하게 "최근" 우선 판정
- **교훈**: 이력 시트에 거래일 데이터만 들어간다는 전제로 라벨/변동 로직이 설계됨. 시트에 쓰는 쪽에서 거래일 가드를 빠뜨리면 읽는 쪽 로직이 전부 어긋남. 데이터 소스 가드 + 읽기 측 강건화 양쪽 모두 필요

### 다계좌 보유 종목의 1주일/1달 손익이 항상 ─(빈칸)
- **증상**: *대시보드* 보유종목 현황에서 특정 종목(TIGER 차이나테크 TOP10, KODEX AI전력핵심설비 등)의 "1주일 손익"·"1달 손익"이 보유기간(11개월+)과 무관하게 계속 빈칸
- **원인**: Dashboard.js `_calcExtraColumns()`의 `txByCode`/`qtyAtDate`가 *거래_원장*을 **종목코드 단위로만** 합산. 손익 가드 `qtyAtDate(code) !== curQty`에서 `curQty`는 *보유현황* 행별 **계좌별 수량**이라, 같은 종목을 2개 이상 계좌에서 보유하면 `qtyAtDate(code)`(전 계좌 합계)와 영구 불일치 → `pnlAt`이 항상 null 반환. JUN & SOO 공동 포트폴리오라 다계좌 보유가 정상 케이스
- **해결**: `txByKey`를 `code||증권사||계좌` 단위로 키잉, `qtyAtDate(key, …)`로 계좌별 판정. (`pctAt` 기반 m1/m3/m6/y1 %는 수량 가드가 없어 원래 정상이었음)
- **교훈**: *보유현황*은 (종목,증권사,계좌) 행 단위인데 원장 집계를 코드 단위로 하면 다계좌 종목에서 어긋남. 집계 키 granularity를 소비처(curQty)와 일치시켜야 함
- **후속**: 다계좌 수정 후에도 랩 계좌(미래애셋 종합_랩 등 기간 내 거래 잦은 계좌)는 수량 변동 가드(`qtyAtDate !== curQty`)에 걸려 계속 빈칸. `pnlAt`을 **정확한 기간 손익**(오늘 평가금액 − N일전 평가금액 − 기간 내 순매수금액)으로 교체 → 수량이 변해도 올바른 값, 가드 제거. 수량 불변 종목은 결과 동일. 원장 read 8→10열 확장(금액 열 사용)

### 비거래일에 buildDashboard 시 보유종목표 확장 컬럼 전부 빈칸
- **증상**: 주말·공휴일에 *대시보드* 갱신하면 당일 등락·당일/1주/1달 손익 컬럼이 전 종목 ─
- **원인**: Dashboard.js `_calcExtraColumns`·`_calcTodayProfit`이 "오늘 날짜 행"이 없으면(`todayIdx===-1`) 즉시 빈 결과 반환. `updateNewPriceHistory`에 거래일 가드가 생긴 뒤로는 비거래일에 *현재가_이력* 오늘 행이 아예 없어 항상 발동. `_mCalcExtras`(모바일)에는 fallback이 있었으나 Dashboard.js에는 없어 불일치
- **해결**: 두 함수에 `_mCalcExtras`와 동일한 fallback 추가 — 오늘 행 없으면 마지막 거래일을 today로, 그 직전 거래일을 prev로
- **교훈**: 같은 계산이 모바일·시트 두 곳에 따로 구현돼 한쪽만 보강되면 어긋남. 계산 로직 단일화 필요(감사 #4)

### syncHolidays가 기념일(스승의 날 등)을 휴장일로 등록 → 거래일 오판
- **증상**: 휴장일 동기화 후 웹앱이 5/15(금)을 건너뛰고 priceAsOfDate·수익을 5/14(목) 기준으로 표시
- **원인**: `syncHolidays`가 구글 '대한민국 공휴일' 캘린더의 **모든 이벤트를 무필터로** *휴장일* 시트에 기록. 그 캘린더엔 스승의날(5/15)·어버이날 등 증시가 여는 '기념일'도 포함됨 → `_isKoreanHoliday`가 5/15를 휴일로 오판 → `_isTradingDateStr` 거짓 → 5/15 비거래일 취급
- **해결**: `syncHolidays`에 휴장일 이름 화이트리스트(`HOLIDAY_NAMES`) 추가 — 신정·설날·삼일절·어린이날·부처님오신날·현충일·광복절·추석·개천절·한글날·성탄절·대체공휴일·임시공휴일·근로자의날만 채택, 나머지 기념일 제외
- **교훈**: 외부 캘린더는 '공휴일'과 '기념일'을 섞어 제공함. 휴장일 = 공휴일이 아니라 '증시가 닫는 날'이므로 이름 기준으로 명시적으로 걸러야 함
