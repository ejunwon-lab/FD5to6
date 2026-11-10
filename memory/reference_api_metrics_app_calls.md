---
name: reference-api-metrics-app-calls
description: 앱(web·desk·iOS) GAS 호출 장애의 시각을 분 단위로 특정하는 법 — Cloud Monitoring request_count(앱 OAuth 프로젝트)로 scripts.run 응답 코드 시계열 조회
metadata:
  node_type: memory
  type: reference
  originSessionId: 48bef0b8-beb8-4690-8089-decab74199e3
  modified: 2026-11-10T13:49:30.724Z
---

앱 3개의 `scripts.run` 호출 결과(200/404/403…)는 앱 OAuth 클라이언트의 GCP 프로젝트(번호 71319598693) Cloud Monitoring에 분 단위로 남는다. clasp 토큰(cloud-platform 스코프)으로 읽힌다:
`GET https://monitoring.googleapis.com/v3/projects/71319598693/timeSeries` · filter `metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api" AND resource.labels.service="script.googleapis.com"` · `aggregation.alignmentPeriod=60s`, `perSeriesAligner=ALIGN_DELTA`, `crossSeriesReducer=REDUCE_SUM`, `groupByFields=metric.labels.response_code`.

Claude 자신의 시험 호출은 clasp 클라이언트(다른 프로젝트)로 집계돼 섞이지 않는다 — 순수 앱 호출만 보임. 실행 기록 API(processes)는 clasp 토큰 스코프 부족(403)이라 이 방법이 대안.

**Why:** 2026-11-10 앱 404 원인을 "추정"으로 두 번 보고했다가, 이 집계로 "편집자 계정 저장 2분 뒤 첫 404 → 소유자 저장 1~2분 뒤 복구"를 확정. 처음부터 봤으면 왕복이 없었다.

**How to apply:** 앱이 GAS 호출에 실패하면 가설 세우기 전에 이 시계열부터 — 깨진 시각·복구 시각을 Drive `modifiedTime`·배포 시각과 대조. 관련: [[feedback_no_overconfident_claims]] [[feedback_self_verify_before_handoff]]
