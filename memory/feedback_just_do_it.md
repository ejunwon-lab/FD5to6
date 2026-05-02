---
name: 할 수 있는 건 바로 실행
description: 사용자에게 "~해주세요" 대신 직접 실행할 것
type: feedback
originSessionId: e72eef2d-5351-4f88-af4b-9cfbf4c16795
---
GAS 배포(`push_safe.py`), git 명령 등 Claude가 직접 실행할 수 있는 작업은 사용자에게 넘기지 말고 바로 실행한다.

**Why:** 사용자가 직접 할 수 있는 일을 시키는 건 불필요한 번거로움.

**How to apply:** 작업 완료 후 후속 실행이 필요한 경우(배포, 커밋, 빌드 등) 승인이 필요한 게 아니면 그냥 바로 한다.
