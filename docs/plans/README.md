# 설계 노트 (코딩 전 설계 게이트 산출물)

위험 변경(배포 GAS·`.github/workflows/*`·권한·외부 API)을 **코딩하기 전에** `/design-check` skill로 작성한 설계 노트를 모은다.

- 파일명: `YYYY-MM-DD-<주제>.md`
- 작성 규칙·트리거: CLAUDE.md "변경 전 설계 절차" + `.claude/skills/design-check/SKILL.md`
- 목적: 추론 가능한 에러를 코딩 전에 거르고, 사후 재참조용 기록 남기기

세션 문서(`docs/sessions/`)가 "무엇을 했나"라면, 여기는 "코딩 전에 무엇을 검증했나"다.
