---
name: GAS 배포 양쪽 동시 진행
description: KIS_API.js 수정 시 구/신 시스템 양쪽에 배포, 추가 명령 없이 진행
type: feedback
originSessionId: 2adc3ea2-b442-4bf5-9ac5-7bf835e26526
---
KIS_API.js 변경 시 구 시스템(old)과 신 시스템(new) 양쪽에 모두 배포한다.

**Why:** KIS_API.js는 두 폴더(apps-script/, apps-script-new/)에 각각 존재하는 공유 파일. 한 쪽만 업데이트하면 동작 불일치 발생.

**How to apply:** KIS_API.js 수정 후 배포 시 "양쪽에 업데이트합니다"라고 말하고 추가 승인 없이 old/new 순서로 배포 진행.
