---
name: efficient-multi-file-edits
description: "여러 파일 수정·구조 변경 작업 시 효율 규칙 — Read 병렬화, TS 타입 변경 전 grep, 빌드 한 번에 잡기"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ff11f833-0d22-4b57-ae5a-4dcef779fffc
---

여러 파일을 동시에 고치는 작업(폴더 rename, 타입 확장, 일관성 변경 등)에서 시간 낭비 패턴을 줄인다.

**Why**: 2026-05-25 web-terminal → web-desk rename + 전체업데이트 버튼 추가 작업. 단순 중간 복잡도였는데 30~60초를 비효율로 더 썼음. 사용자가 "왜 오래 걸렸냐" 지적 → 정직 분석 결과 아래 패턴들이 원인.

**How to apply**:

1. **Read를 병렬화한다** — 여러 파일을 Edit 해야 할 게 미리 보이면, 한 메시지에 Read들을 다 묶어서 호출한다. 차례로 Read→Edit→Read→Edit 하면 통신 왕복 비용 누적.

2. **TS 타입 추가/변경 전에 grep 먼저** — 인터페이스에 필수 필드를 추가하면 모든 객체 생성·setState·반환문이 영향받음. 타입 정의를 바꾸기 *전에* 영향 받는 모든 사용처를 grep으로 확인. 그래야 빌드 한 번에 통과.

3. **System reminder(TodoWrite 권유)에 매번 응하지 않는다** — 단순 3단계 미만 작업이면 todo 안 만들어도 됨. 흐름 끊기지 말 것.

4. **GitHub Pages 배포 후 첫 확인은 5초 sleep + retry, 안 되면 30초 더** — CDN 전파 지연 평균 30~60초. 한 번에 길게 sleep 잡는 것보다 짧게 retry가 빠를 때도 있고, 새 path는 더 오래 걸림. 첫 시도 200 안 나오면 바로 30초 sleep 후 재확인.

5. **rename 시**: `git mv` 후에도 *파일 내부의 옛 경로 문자열*은 자동으로 안 바뀜 (예: workflow YAML 안의 `web-terminal/**` 경로). rename 작업 체크리스트:
   - 폴더 rename
   - vite.config / tsconfig 등 빌드 설정의 path
   - 워크플로 YAML 내 path/workdir/destination_dir
   - package.json name
   - index.html title
   - 문서 사이드 참조 (sessions/ 등은 역사적 기록이라 안 바꿔도 OK)
