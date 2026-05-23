---
name: gas-webapp-anyone-anonymous
description: GAS Web App에 익명 POST(Telegram·외부 webhook) 받으려면 appsscript.json에 access ANYONE_ANONYMOUS 명시 필수
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ff11f833-0d22-4b57-ae5a-4dcef779fffc
---

GAS Web App을 **외부 익명 POST**(Telegram webhook, 외부 서비스 등) 수신용으로 쓸 땐 `appsscript.json`의 `"webapp": {"access": "ANYONE_ANONYMOUS"}` 명시 필수. UI에서 "모든 사용자"로 설정해도 manifest의 access 값이 POST 라우팅 결정에 우선해서 **GET은 통과시키되 POST만 차단하는 비대칭 동작** 발생.

**Why**: 2026-05-23 Telegram webhook 진단 미궁의 진짜 원인. manifest는 `MYSELF`인데 UI는 "모든 사용자"였음. 시크릿 브라우저 GET은 멀쩡히 통과해 access 풀린 것처럼 보였지만 POST는 302 → 405로 차단. 발견까지 1시간+ 소요.

**How to apply**:
- 외부 webhook용 GAS Web App 만들 때 manifest 먼저 점검: `appsscript.json` → `webapp.access`
- access 값 변경 후엔 **새 deployment 생성 필수** (기존 deployment 편집은 메타데이터 안 바뀜 — manifest도 head 코드와 마찬가지로 deployment 생성 시점에 캡쳐됨)
- 관련 errors.md 항목: 2026-05-23 "Telegram webhook 302/405"

[[gas-curl-diagnosis]]
