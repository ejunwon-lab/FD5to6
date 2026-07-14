---
name: feedback_trade_record_command
description: "\"매매기록!\"/\"매매기록하자!\" 명령어 → 카톡 체결 → 원장 자동 기록 프로세스 실행"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 632bf658-b254-428b-8635-f90fdd130a6e
---

사용자가 `매매기록!` 또는 `매매기록하자!`를 치고 증권사 체결 카톡을 붙여넣으면, **묻지 말고 매수/매도 원장 기록 프로세스를 돌린다**. (2026-07-14: 이 파이프라인을 만들어놓고 첫 실사용 때 자동 실행을 까먹어 사용자가 명령어로 고정 지시.)

**Why:** 카톡 매매 → 원장 자동 기록 파이프라인(`_appendTradeRow` doPost + `scripts/post_trade.py`)은 이미 구축돼 있는데, 트리거가 명시 안 돼서 매번 "어떻게 반영할까요" 되묻는 실수를 함. 명령어로 진입점을 고정.

**How to apply:** 절차 상세는 FD5to6 `CLAUDE.md` "매매기록!" 섹션 + `docs/plans/2026-06-11-카톡매매-원장자동기록.md`. 요지:
1. 파싱 (같은 종목 차수 → 수량 합산 1행)
2. 마스킹계좌·수수료 → [[reference_kakao_account_map]] 룩업 (신규면 질문·누적)
3. 종목코드/현재수량 → `python3 scripts/backup_sheets.py` 덤프 후 `_보유현황_.csv` grep
4. 전량/일부 판정 (매수 분류 미상이면 질문)
5. **확정 표 제시 → 사용자 확인** (confirm-then-write)
6. `python3 scripts/post_trade.py '<JSON>'` 건별 순차 POST
7. 재덤프로 실현손익·보유현황 검증
8. 신규 계좌면 memory 누적 + `저장!` 안내

관련: [[reference_kakao_account_map]] · [[feedback_state_assumptions]] · [[feedback_verify_changes]]
