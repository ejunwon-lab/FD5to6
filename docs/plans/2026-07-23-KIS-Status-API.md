# 2026-07-23 — KIS Status 페이지 + 시스템 상태 API 설계 노트 (/design-check)

데스크 로드맵 2단계. 미구현 nav `kis`를 실페이지로 — GAS API 1개 신설(배포 서버코드 → 게이트 대상).

## 1. 외부 동작 가정 + 근거

- **`_buildDiag()` 재사용** — Diag.js에 이미 존재(now·isTradingDay·isMarketDay·priceAsOfDate·priceHistTail·holidaysTail·stockCount·metricFill·lastUpdate). 새 함수 `newMobileGetSystemStatus()` = `_buildDiag()` + `kis_carried_status`(Properties: {date, carried, total} — NewSystem.js:852, 종목코드 미포함) 래핑. 로직 신설 없음, 읽기 전용.
- **Diag.js 규칙 준수** — "공개 엔드포인트 없음(doGet 없음)" 규칙: scripts.run은 소유자 OAuth 토큰 필수(포트폴리오 금액 API와 동일 인증)라 익명 공개 아님 ✓. "민감 정보(금액·종목명·계좌·수량) 금지" 규칙: `_buildDiag`·carried_status 페이로드에 원래 없음 ✓ — 새 필드 추가 안 함.
- **클라이언트 3곳 devMode HEAD** — push_safe만으로 반영 (기존 확인). Telegram 웹훅은 이 함수 미사용 → 재배포 불필요.

## 2. 과거 부류 (errors.md)

- GAS 에디터 getUi() 금지(memory) — 새 함수는 UI 호출 없음 ✓.
- "푸시 0원 stale 단서"(2026-07-04) — kis_carried_status의 원 용도. 읽기만 하므로 그 경로 무영향.

## 3. 추론 가능 vs 실환경 전용

- 머리로 거름: 페이로드 구성·JSON 직렬화·에러 시 {success:false}.
- 실환경에서만: 실제 응답 필드 채움 상태 → 사용자 화면 확인으로 이관.

## 4. 검증 방법

- 자동: push_safe node --check / desk tsc·build / walk-through: carried=2, total=23 → 배지 "직전가 유지 2/23" 경고색; carried=0 → "전 종목 최신" ✓.
- 사용자: 데스크 사이드바 KIS Status(단축키 K) → 시스템 상태·KIS 시세 상태·지표 충족도·최근 휴장일이 채워져 보이는지.

→ 게이트: 통과 (읽기 전용 재사용, 신규 로직·민감 필드 0)
