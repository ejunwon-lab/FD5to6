---
name: GAS Secret.js 절대 수정 금지
description: GAS 배포 시 Secret.js를 절대 건드리지 않는다
type: feedback
originSessionId: 2a9a6e85-cab9-4398-9594-b124121defcf
---
Secret.js는 절대 수정하거나 재전송하지 않는다.

**Why:** KIS API 키 등 민감 정보 포함. `.claspignore`에 등록되어 있어 `clasp push` 대상에서 제외됨. 그런데 `clasp push`는 원격 전체를 로컬로 교체하므로, Secret.js가 push 목록에 없으면 **원격에서 자동 삭제**된다.

**How to apply:**
- `clasp push`를 자동으로 실행하지 않는다. 사용자가 명시적으로 요청해야만 실행.
- push 전 반드시 "Secret.js가 원격에서 삭제됩니다 — 진행할까요?" 확인.
- GAS 파일 수정 후 배포는 사용자가 GAS 에디터에서 직접 하도록 안내하는 것이 안전.
