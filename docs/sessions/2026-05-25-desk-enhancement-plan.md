# 세션: 2026-05-25 — web-desk 마무리 다듬기 + 고도화 계획

## 진행 흐름

오전~오후: Equity Curve 기능 + Markets 위젯 + 환율 데이터 + Holdings 토글/strip 다듬기  
오후 후반: web-terminal → web-desk 리네임 + 전체 업데이트 버튼  
저녁: 4개 메뉴 고도화 계획 수립 (10개 데스크 분석 기반)

## 코드 변경 요약 (이미 commit 완료된 것들)

| 커밋 | 내용 |
|---|---|
| 4c3d36e | Equity Curve 기간 버튼 실제 작동, 1D→6M 교체, fullDate 필드 추가, sample 30→180일 |
| d09f7db | Markets 위젯 6개 지표로 확장 (KOSPI·KOSDAQ·SPX·NDX·USD·GBP) |
| 8b662dd | 환율 데이터 소스 수정 — `newMobileGetPortfolio.usdRate/gbpRate` 사용 (indicators 아님) |
| cd95ffc | Holdings 토글 순서 Web→Terminal→List, 기본값 Web |
| d6c0ceb | Holdings 현황 strip 동적 카드 5종 (정렬 키별), 종목명 표시 |
| a31adb2 | **web-terminal → web-desk 폴더·URL·워크플로 전체 리네임** + ⚡ 전체 업데이트 버튼 |

## 주요 발견 / 결정

- **환율 위치 함정**: `newMobileGetIndicators`엔 DXY만 있고 USD/KRW·GBP/KRW 없음. portfolio 응답의 최상위 `usdRate`/`gbpRate` 필드(Settings 시트 B2/B3) 사용. memory 저장
- **신시스템 4개 클라이언트 매핑 확인**: web-desk·web·Telegram·iOS — Script ID 동일. memory 저장
- **`category` 필드는 섹터 아님** (사용자 확인) — 거래원장의 자산 유형 정도. 섹터 데이터는 Yahoo Finance API로 별도 fetch 필요

## 신규 URL
- 현행: https://ejunwon-lab.github.io/FD5to6/desk/
- 이전(deprecated): https://ejunwon-lab.github.io/FD5to6/terminal/

## 고도화 계획 (이번 세션 산출)

전세계 데스크 10개 분석 → 4개 메뉴 (Holdings·Analysis·Indicators·Trade Log) 강화 계획 수립.  
전체 내용: `docs/desk-enhancement-plan.md`

**3 Phase 구분**:
- Phase A: GAS 작업 0, 프론트만 (1~2시간) — Holdings 풀 기능, 익스포저 매트릭스, 수익 기여도, 마켓 히트맵, 상승/하락 TOP
- Phase B: GAS 2개 + 프론트 (4~6시간) — 지표 history, Yahoo 섹터, 벤치마크 비교, 월별 히트맵, 세금 시뮬
- Phase C: GAS 4개 + 프론트 + 외부 API (6~9시간) — 상관관계, 보유↔지표 영향도, 이코노믹 캘린더(KR+US), 거래 빈도, 수수료, CSV export

**사용자 결정사항**:
1. 섹터 출처 → Yahoo Finance
2. 배당 데이터 → 완전히 나중에 (Phase C에서도 제외)
3. 이코노믹 캘린더 → 한국 + 미국 주요 일정
4. 모든 GAS 확장 = HEAD 코드 변경 (devMode:true 사용이라 deployment 재배포 불필요)

## 메모리 갱신

- `project_web_terminal_gas_integration.md` — 4 클라이언트 연동 매핑 (web-desk·web·Telegram·iOS) + 환율 위치 함정
- `feedback_efficient_multi_file_edits.md` — 다중 파일 수정 효율 규칙 (Read 병렬화, TS 타입 변경 전 grep, rename 체크리스트)

## 다음 세션 (이어서)

Phase A부터 진행 — Holdings 풀 기능 이식 + 익스포저 매트릭스 + Analysis 수익 기여도 + Indicators 상승/하락 TOP + 마켓 히트맵.

승인 옵션:
- 옵션 1: Phase A만
- 옵션 2: Phase A + B-GAS만 (백엔드 미리)
- 옵션 3: Phase A + B 전체
- 옵션 4: 다른 순서
