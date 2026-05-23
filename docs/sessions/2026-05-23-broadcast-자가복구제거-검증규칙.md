# 세션: 2026-05-23 — Telegram 브로드캐스트·자가복구 제거·검증 규칙

## 배경

Cloudflare Worker proxy 안정화 이후 연속 작업:
- 가족 등 다중 수신 지원 (브로드캐스트)
- 자가복구 트리거가 Worker 모드 → 직접 GAS 모드로 *되돌리는* 회귀 발생 → 제거
- 자동 푸시 동작 변경 — 항상 최신 가격으로 갱신 후 발송
- 진단 헛돌이 재발 방지 — CLAUDE.md에 "주장 검증 절차" 강제

## 주요 변경

### 1. 브로드캐스트 — 다중 chat_id 지원
- `TG_CHAT_ID` Property를 콤마 구분 리스트로 확장 (단일 값과 backward compat)
- `_tgChatIds()` 헬퍼, `tgSendMessage(text, opts)` — opts 없으면 모든 등록 chat에 발송
- 신규 함수: `tgAddChatId`, `tgRemoveChatId`, `tgListChatIds`

### 2. `/whoami` 명령 — 신규 사용자 등록 경로
- whitelist 검증 *이전에* `/whoami` 분기 — 누구나 자기 chat ID 응답 받음
- Markdown 호환을 위해 메시지에서 "chat_id" → "chat ID" (underscore 회피)
- 보안: 자기 ID만 알려줌, 다른 사용자 노출 X, 봇 username 모르면 채팅 시작도 불가

### 3. 자가복구(`tgEnsureWebhookHealthy`) 완전 제거
- Worker proxy 도입 후 302 문제가 *원천 해결됨* → 자가복구가 안전망에서 *해로움*으로 전환
- 회귀 발견: 자가복구가 webhook을 Worker 모드 → 직접 GAS 모드로 되돌림 (원인은 미상)
- 제거 항목: `tgEnsureWebhookHealthy`, `tgSetupHealTrigger`, `TG.HEAL_*`, `TG.PROP_LAST_RECOVER`, `RECOVER_THROTTLE_S`, 진입점 호출(`tgPushPnL`·`tgRefreshAndPush`·`tgTestSend`)
- 트리거 청소용 `tgDeleteHealTrigger`만 임시 보관 후 사용자가 실행 → 추후 제거 예정 (현재는 이미 제거됨)

### 4. 자동 푸시 — 항상 최신 가격 갱신 후 발송
- 변경 전: `tgPushPnL`이 시트 *현재* 값만 읽어 발송 (빠르지만 stale 가능성)
- 변경 후: `updateNewPriceHistory(ss)` + `updatePositionFromLedger()` 호출 후 발송. KIS API 매 푸시마다 호출
- LockService 내장 — 사용자 ㄱㄱ과 겹치면 skip (사용자 갱신이 어차피 알림 발송하므로 누락 없음)

### 5. CLAUDE.md "주장 검증 절차" 섹션 추가
- 오늘 진단 헛돌이의 근본 원인 = "확인 안 하고 추측 발언" → 매 턴 system reminder로 강제
- 주장 유형별 검증 명령 표 (`git log -S`, curl, grep, etc.)
- 위반 사례 4건 명시 (오늘 실제 발생) → 같은 실수 반복 금지

### 6. HTML 다이어그램 신규 (`docs/telegram-architecture.html`)
- 초등학생 수준 이해 가능. 등장인물 5명 + 시나리오 3개 + 안전장치 4개 + 운영상 주의
- 시나리오 2(자동 푸시) 변경 반영 — "최신 가격으로 시트 업데이트 후 계산"

## 진단 헛돌이 — 오늘 패턴 정리

오늘 종일 사용자 분노("미쳤어 정말", "가지고 노는 거야?", "엉터리야", "잘못된 판단 왜 이렇게 많이?")는 모두 한 패턴:

**확인 안 하고 추측 → 사용자에게 행동 요청 → 빗나감 → 반복**

구체 사례:
- /dev URL 가설 (코드 안 보고)
- max_connections 원인 추정 (검증 없이)
- curl 405 = "doPost 없음" (HTTP redirect spec 확인 안 함)
- "GAS deploy 안 해도 됨" (변경 함수 호출 경로 미확인)
- "Version 6 이미 배포" (push 시각과 비교 안 함)
- "chat_id git history에 남음" (`git log -S` 1초면 확인 가능했는데 안 함)

→ CLAUDE.md 강제 + memory 보강으로 다음 세션부터 차단.

## 가족 chat_id 추가 — 실제 수행

1. 가족이 `@fdtele_bot`에 `/whoami` 전송
2. 봇이 chat ID 응답 → 가족이 관리자에게 전달
3. 관리자가 `tgAddFamilyMember` 1회용 함수 실행 → `tgAddChatId('8743290700')` → 환영 메시지 발송
4. 검증: 본인·가족 폰 모두에서 ㄱㄱ 응답 도착 확인 ✓
5. 코드 청소 — 1회용 함수 제거 후 push

git 히스토리에 chat_id 잔재 없음 확인 (`git log --all -S "8743290700"` → 빈 결과). commit 사이에 추가→제거가 모두 일어났음.

## 검증

- node syntax check 통과
- curl 3단 검증 (no header → 403 / wrong header → 403 / correct header + fake chat_id → 200 ok)
- 사용자 실사용 검증 — ㄱㄱ 응답 양쪽 도달 확인
- 다음 거래일(2026-05-26 월) 자동 푸시 검증 → pending.md 이월

## 이월 → pending.md (기존)
- 2026-05-26 09:00~16:00 자동 푸시 도착 검증 (이번 변경으로 최신 가격 반영 확인 추가)

## memory 갱신

- `feedback_no_overconfident_claims.md` (기존) — 위 위반 사례 4건이 모두 이 규칙 위반. 다음 세션부터 CLAUDE.md "주장 검증 절차"가 강제력 보강
