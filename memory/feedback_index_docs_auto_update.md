---
name: index-docs-auto-update
description: 함수/스키마/트리거/기능/결정/에러가 바뀔 때마다 같은 작업에서 인덱스 문서 자동 갱신 (사용자 명시 지시 불필요)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e9e7f391-3392-4162-9c42-001fe6a546bc
---

코드·시트·시스템에 변경이 생기면 **사용자가 따로 "문서 정리해"라고 지시하지 않아도**, 같은 작업(같은 turn)에서 해당 인덱스 문서를 함께 갱신한다.

**Why:** 인덱스 문서들(architecture·code-map·api-reference·features·decisions·pending·errors)은 Claude가 매 작업 시작 시 "전체 코드 통독 대신" 빠르게 위치·구조 파악에 쓰는 핵심 진입점. stale되면 잘못된 함수를 보고 시간 낭비. 사용자는 매번 갱신 지시할 의무가 없으며, 갱신은 Claude 책임이다.

**How to apply** — 변경 유형별 자동 갱신 대상:

| 변경 유형 | 자동 갱신할 문서 |
|---|---|
| GAS 함수 추가·삭제·이름변경·시그니처 변경 | `docs/code-map.md` 해당 .js 섹션 |
| 데스크/웹/iOS 컴포넌트 추가·삭제·이름변경 | `docs/code-map.md` Web Desk / Web / iOS 섹션 |
| 시트 컬럼 추가/순서변경/의미변경 | `docs/architecture.md` 시트 스키마 + `docs/code-map.md` GAS 시트 스키마 |
| 자동 트리거 추가/시각 변경/조건 변경 | `docs/architecture.md` 트리거 표 + `docs/features.md` GAS 자동 트리거 + CLAUDE.md "시스템 한눈에" 트리거 표 |
| API 응답 JSON 필드 추가/이름변경/계산 변경 | `docs/api-reference.md` |
| 새 기능 완성 / 기존 기능 제거 | `docs/features.md` (last updated 날짜 갱신) |
| 옵션 중 채택한 설계 결정 (작은 결정도 포함 — 사용자가 "추천" 선택한 경우도) | `docs/decisions.md` (날짜·결정·이유·대안 검토) |
| 미완료 작업 추가 / 기존 완료 | `docs/pending.md` |
| 새 버그 진단·해결 | `docs/errors.md` (증상·원인·해결·교훈) |
| 표시 규칙·코드 관례 등 영구 적용 사용자 피드백 | memory 파일 + MEMORY.md 인덱스 |

**갱신 시점**: 변경을 commit하기 직전 같은 turn에서. 코드 commit과 docs commit을 굳이 분리하지 않는다 — 한 commit에 묶거나, 같은 turn 내 연속 commit으로.

**last updated 날짜**: `architecture.md`·`features.md`·`api-reference.md` 수정 시 최상단 `last updated:` 날짜를 사용자 messages에서 받은 absolute date(`Today's date is YYYY-MM-DD`)로 갱신.

**예외**: 트리비얼 변경(오타·공백·주석 한 줄)에는 인덱스 갱신 불필요. 함수·구조·동작·인터페이스 변경이면 무조건 갱신.

연관: [[number-display-full]] · [[stock-name-primary]] (표시 규칙 자동 적용도 같은 원리 — 사용자 매번 지시 불필요)
