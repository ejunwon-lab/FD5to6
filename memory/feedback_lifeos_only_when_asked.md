---
name: feedback_lifeos_only_when_asked
description: Life OS(내앱) 기록은 사용자가 Life OS에 넣으라고 직접 말할 때만 — "리마인드해줘" 같은 말만으로 스스로 넣지 않는다
metadata:
  type: feedback
---

"내일 하라고 리마인드해줘"라는 말에 Life OS 커넥터 안내문("앱 이름을 말하지 않아도 할 일은 여기에 기록")을 따라 할 일 3건을 넣었더니, 사용자가 "내가 life os라고 말 안 했을 텐데??" → **"앞으로는 말할 때만 해. 이번 건은 ㅇㅋ"** (2026-11-15).

**Why:** 사용자는 무엇이 어디에 기록되는지 자신이 정하고 싶어 한다. 커넥터에 적힌 일반 안내보다 사용자의 직접 지시가 우선이다.

**How to apply:** 리마인드·할 일 요청이 와도 사용자가 Life OS(내앱)를 직접 말하지 않았으면 Life OS에 쓰지 않는다. **"리마인드해줘" = 다음 `실행@` 때 할 일로 말해 달라는 뜻**(사용자 2026-11-15) — 묻지 말고 그 프로젝트 `docs/pending.md` 맨 위 `🔔 리마인드` 줄에 적고, 다음 `실행@` 요약에서 할 일로 먼저 말한다. 끝냈다고 하면 지운다. 조회(overview·search)도 요청이 있을 때만. 관련: [[feedback_confirm_before_action]] · [[feedback_stay_in_user_scope]]

전역 규칙(`harness/global-CLAUDE.md` "Life OS(내앱) 사용")에도 같은 내용을 넣었다 (2026-11-15) — 모든 프로젝트에 적용.
