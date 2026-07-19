---
name: GAS Secret.js 절대 손대지 않음
description: Secret.js는 무슨 일이 있어도 읽기·수정·생성·재전송 금지 — 사용자만 관리
type: feedback
originSessionId: 2a9a6e85-cab9-4398-9594-b124121defcf
modified: 2026-07-19T15:13:12.520Z
---
`Secret.js`는 **무슨 일이 있어도** Claude가 건드리지 않는다 — 열기·읽기·수정·생성·push 전부 금지. 그 안의 값(KIS 키 등)은 **오직 사용자가** GAS 에디터에서 직접 관리한다.

**Why:** KIS API 키 등 민감 정보. 로컬에 없고 원격 GAS에만 존재. 사용자가 명시적으로 못 박은 규칙 (2026-05-18).

**How to apply:**
- Secret.js를 절대 Write/Edit/Read 하지 않는다.
- `clasp push` 직접 실행 금지. 배포는 `python3 apps-script-v2/push_safe.py` (Secret.js를 원격에서 보존).
- **백업·복사·재해복구 제안 포함, Secret.js 관련 어떤 작업·안내도 하지 않는다** — "사용자가 직접 하시라"는 안내조차 금지 (2026-07-20 사용자 재확인: "6번은 절대로 아무 것도 하지마"). 개선 아이디어 목록에도 다시 올리지 않는다.
