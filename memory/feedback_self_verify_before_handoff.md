---
name: 내 변경은 내가 끝까지 검증 후 넘긴다
description: 버그 만들어 놓고 사용자에게 테스트시키지 말 것 — 명령·워크플로는 내가 직접 실행해 확인
metadata:
  type: feedback
---

내가 작성한 코드·명령·워크플로는 **사용자에게 테스트시키기 전에 내가 직접 실행해 동작을 확인**한다. 버그를 만들어 놓고 사용자가 돌려서 발견하게 하면 안 된다.

**Why:** telegram-push.yml에 `-X POST` 버그를 넣고 사용자에게 "Run workflow 눌러 확인하세요"라고 시켰는데, 그 테스트가 *내 버그* 때문에 실패함. 사용자가 "버그 만들어서 나한테 일 시킨다"고 정당하게 화냄. 나는 `gh workflow run` + `curl`로 직접 검증할 수단이 있었는데 안 씀.

**How to apply:**
- GitHub Actions 워크플로는 `gh workflow run <file> --ref main` → `gh run view <id> --log`로 **내가 직접 실행·로그 확인** 후 결과를 보고.
- 외부 호출(GAS 웹앱 등)은 `curl`로 내가 먼저 때려보고 응답 형태 확인 (단 GAS 웹앱은 `-X POST` 금지 — [[feedback_gas_curl_diagnosis]] / errors.md 2026-06-06).
- 사용자에게 남기는 작업은 *내가 원격으로 못 하는 것*(브라우저 OAuth, 계정 소유 트리거 끄기 등)으로 최소화. 검증 가능한 건 내가 검증.
- 관련: [[feedback_verify_changes]]
