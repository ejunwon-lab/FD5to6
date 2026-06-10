---
name: feedback_global_env_consistent
description: 전역 환경은 늘 동일하게 — 전역 설정 변경은 항상 harness repo(claude-2026)에 커밋·푸시
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 864969ab-74ca-4465-8fbf-a5f884fa7966
---

사용자 지시: "환경은 늘 동일하게 해줘." 전역 설정(권한·CLAUDE.md 등)을 바꾸면 디스크 적용으로 끝내지 말고 **harness repo에 커밋·푸시**해서 모든 컴퓨터·세션에서 동일하게 유지한다.

**Why:** 전역 설정의 SSOT는 `~/claude-2026/harness/`다. `~/.claude/settings.json`은 거기 `global-settings.json`으로의 **심링크**(편집 시 실제 경로로 써야 함 — 심링크 직접 쓰기 거부됨), `~/.claude/CLAUDE.md`는 `실행@`(run.sh)이 `global-CLAUDE.md`에서 복사하는 캐시. repo에 커밋 안 하면 다른 컴퓨터엔 반영 안 됨.

**How to apply:** 전역 권한/CLAUDE.md 변경 후 `cd ~/claude-2026 && git add harness/ && git commit && git push`. settings.json 편집은 `readlink -f`로 실제 타겟(`harness/global-settings.json`) 잡아서 편집.

관련: bash 권한은 `allow: Bash(*)` + 위험계열만 `ask`(rm/sudo/설치/ssh/git파괴) + 치명타 `deny`. 인터프리터(python/node/npx 등)는 ask에서 제거해 무프롬프트(2026-06-09). [[feedback_just_do_it]]
