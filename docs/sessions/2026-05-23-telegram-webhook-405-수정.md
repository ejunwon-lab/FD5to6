# 세션: 2026-05-23 — Telegram webhook 302/405 디버깅·수정

## 배경
- 새벽 작업으로 Telegram 봇 구축 완료(`2026-05-23-telegram-봇-워치-손익알림.md`) 직후, "한 번은 ㄱㄱ로 됐다가" 다시 메시지 응답 없음
- 사용자: "갱신", "ㄱㄱ" 보내도 봇이 침묵. 시간 길게 걸린 디버깅 — 사용자 분노 다수 표명

## 진단 과정 (요약·실패 경로 포함)

1. `tgEnsureWebhookHealthy` 실행 → `last_error: Wrong response from the webhook: 302 Moved Temporarily`, pending: 4
2. **틀린 추정 1**: deployment access "본인만"으로 돌아간 줄 알았음 → 시크릿 브라우저 GET 테스트 → "doGet 함수 없음" 페이지 정상 표시 → access는 풀려있다고 확인 → 가설 폐기
3. **틀린 추정 2**: 새 deployment에 `doPost`가 없을 것 → curl POST 직접 시도 → `HTTP/2 302 → HTTP/2 405 allow: HEAD, GET` 받음 → "doPost 없음" 확신 → 사용자에게 새 버전 배포 요청 (반복)
4. 사용자 새 배포 후에도 동일 405 → 진단 미궁
5. 사용자 GAS 에디터에서 `Main.gs`의 `function doPost(e)` 존재 직접 확인 → 코드는 있음 확정
6. `appsscript.json` 열어봄: `"webapp": {"access": "MYSELF", ...}` 발견
7. `ANYONE_ANONYMOUS`로 변경 + push + **신규** deployment 생성 → 새 URL 받음
8. **결정적 검증**: curl 대신 Python urllib로 POST → **HTTP 200 + "forbidden"**. doPost 실행 확정
9. `TG_WEBAPP_URL` 새 URL 교체 + `tgInstallWebhook` 재실행 → 텔레그램에서 "갱신" 응답 도착 ✓

## 실제 원인

`appsscript.json`의 `"webapp": {"access": "MYSELF"}`. 이게 deployment 생성 시 메타데이터로 캡쳐되어 **익명 POST만 차단**. GET은 UI 설정("모든 사용자")에 따라가지만 POST는 manifest의 access 값을 우선시하는 GAS 비대칭 동작.

**부수적으로 디버깅을 1시간+ 헛돌게 한 진단 함정**:
- curl이 GAS의 302 → googleusercontent.com redirect 처리를 RFC와 다르게 함. `--post302`로 강제해도 405 받음. Python urllib는 같은 URL에 동일 POST 보내면 200 받음. **curl 결과만 보고 deployment doPost 없다고 단정한 게 진단 미궁의 핵심 원인**

## 변경 파일

- `apps-script-v2/appsscript.json` — `access: MYSELF → ANYONE_ANONYMOUS`
- `apps-script-v2/Telegram.js` — `tgEnsureWebhookHealthy`(자가 복구) + `tgSetupHealTrigger`(30분 트리거) + 키워드 "ㄱㄱ" 추가 + `tgInstallWebhook`의 /dev URL 거부 로직(자동 감지 URL이 /dev면 무시, /exec만 사용)
- `apps-script-v2/Main.js` — 메뉴 "📤 Telegram — 즉시 발송 (테스트)" 항목 제거
- `docs/errors.md` — 진짜 원인(`access: MYSELF`)과 curl 신뢰 금지 교훈 정정 기록

## 교훈 (memory·errors.md 반영)

1. **GAS Web App 익명 POST**: `appsscript.json`의 `webapp.access`를 `ANYONE_ANONYMOUS` 명시. UI에서 "모든 사용자"로 설정해도 manifest 값이 POST 라우팅 결정에 우선
2. **GAS deployment 디버깅에 curl 사용 금지**. Python urllib·requests 같이 RFC 준수 redirect-following 클라이언트로 교차 검증해야 가짜 405에 속지 않음
3. **"head 코드와 deployment 코드 별개"가 manifest에도 적용**. manifest를 push해도 기존 deployment 권한은 안 바뀜. 새 deployment 생성 필수

## 사용자 피드백

- 1시간+ 진단 헛돌이로 사용자 강한 분노 ("가지고 노는 거야?", "장난해?"). 가설을 확신처럼 제시하고 빗나간 게 반복된 게 직접 원인
- 추측 단계임을 더 명확히 표시했어야 함. 검증되지 않은 결론으로 사용자 행동(새 배포 등) 반복 요구한 게 시간 낭비의 핵심

## 이월 → pending.md

- 다음 거래일(2026-05-26 월) 09:00~16:00 사이 자동 푸시 도착 검증 (기존 항목 유지)

## 알려진 잔여 사항

- `push_safe.py` 출력 중 `Protected on remote: none` — Secret.js가 원격에 보이지 않는 듯한 메시지. 별도 점검 필요 (이번 세션 범위 외)
