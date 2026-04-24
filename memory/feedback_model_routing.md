---
name: Model routing - Opus for complex, Sonnet for simple
description: Use Opus 4.7 for complex tasks, Sonnet for simple tasks via Agent tool model parameter
type: feedback
originSessionId: 2a9a6e85-cab9-4398-9594-b124121defcf
---
복잡한 작업은 Agent 툴로 서브에이전트를 띄울 때 `model: "opus"` 지정, 단순한 작업은 현재 Sonnet으로 처리.

**Why:** 사용자가 명시적으로 요청 — 작업 난이도에 따라 모델을 선택해서 품질/속도 균형을 맞추고 싶어함.

**How to apply:** 작업 시작 전 난이도 판단. 설계, 복잡한 리팩터, 아키텍처 분석 등은 Opus 후보 → **반드시 사용자에게 먼저 확인 후 사용**. 코드 수정, 단순 검색, 설정 변경 등은 Sonnet으로 바로 처리.
