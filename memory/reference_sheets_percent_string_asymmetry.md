---
name: reference_sheets_percent_string_asymmetry
description: Sheets에 부호 % 문자열 setValues 시 음수만 분수 numeric으로 자동 파싱되는 비대칭 — 읽기에서 typeof 분기 필수
metadata: 
  node_type: memory
  type: reference
  originSessionId: 227ade63-ad96-4345-a7ea-46f258dbf6d0
---

Google Sheets에 `setValues`로 `'-7.08%'` 같은 **음수 % 문자열**을 쓰면 셀이 **분수 numeric**(-0.0708)으로 자동 파싱되고, `'+5.04%'`처럼 **`+` 접두 문자열은 텍스트로 보존**된다. 같은 컬럼에 타입이 섞여, `parseFloat(String(v))`로 읽으면 **음수 값만 100배 축소**된다 (FD5to6 d5 +8.04% vs 실제 -4.45% 사고, errors.md 2026-07-16).

**Why:** Sheets의 문자열 자동 해석이 부호에 따라 갈라지는 걸 모르면 "양수 날만 맞는" 미스터리 버그가 됨.

**How to apply:** GAS에서 % 값은 numeric+`setNumberFormat` 으로 쓰는 게 정석. 기존 혼합 컬럼을 읽을 땐 `typeof v === 'number' ? v*100 : parseFloat(...)` 분기 (FD5to6 `_mPctVal`, MobileAPI.js). "같은 컬럼인데 부호별로 값 스케일이 다르면" 이 함정부터 의심. [[feedback_verify_changes]]
