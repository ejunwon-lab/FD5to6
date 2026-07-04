# FD5to6 산출물 인벤토리

> 이 프로젝트를 통해 만든 것들의 전체 목록. 새 산출물이 생기거나 상태가 바뀌면 갱신.
> last updated: 2026-07-04

## 1. 사용자가 쓰는 화면 (클라이언트 5종)

| 이름 | 무엇 | 상태 |
|---|---|---|
| Google Sheets 대시보드 | 메인 UI — 보유현황·손익·지표를 시트에 렌더(`buildDashboard`), 메뉴로 전체 업데이트·유지보수 | 🟢 운영 (주 사용 화면) |
| web (React PWA) | 모바일/일반용 포트폴리오 웹앱 — Holdings·수익 차트·Trade Log 등 (GH Pages 배포) | 🟢 운영 |
| web-desk | Bloomberg 스타일 데스크 — Dashboard·Holdings·Analysis·Indicators·Trade Log·Today, 단축키 첫글자 네비 | 🟢 운영 |
| iOS 앱 (NewFD7, SwiftUI) | 네이티브 포트폴리오 뷰 — XcodeGen 프로젝트 | 🟡 기능 완성, 빌드 확인 건 잔존 |
| Telegram 봇 | 양방향 워치 + 장중 손익 자동 푸시(거래일 09~16시 ~20분 간격) | 🟢 운영 |

## 2. 데이터 허브 — GAS 백엔드 (apps-script-v2)

| 이름 | 무엇 | 상태 |
|---|---|---|
| KIS API 연동 | 한투 API 토큰 관리 + 국내/해외 시세 병렬 조회 → 시트 캐시 (클라이언트는 시트만 읽음) | 🟢 운영 |
| `updateAllNew` 파이프라인 | 환율→가격→보유현황→종목지표→추이기록→대시보드 일괄 갱신 | 🟢 운영 |
| 자동 트리거 4종 | 매일 17:30 / 장중 매시 :30 / 텔레그램 푸시 / 연말 공휴일 동기화 | 🟢 운영 |
| doPost API 6액션 | `pushPnL`·`portfolioMetrics`·`emailReport`·`addTrade`·`addMarketReport`·Telegram webhook | 🟢 운영 |
| 포트폴리오 지표 엔진 | 익스포저%·MDD·d5/d20·일자별 수익률(거래일 필터) — 리포트용, 원화 절대액 미노출 | 🟢 운영 (입금 왜곡 보정 대기) |
| 카톡 매매 → 원장 자동기록 | 체결 알림 붙여넣기 → 파싱 → 원장 1행 + 연쇄 갱신 (멱등) | 🟢 운영 |
| 이메일 셀프발송 | 리포트 HTML 메일 (killswitch·화이트리스트 등 안전장치 5중) | 🟡 도착 확인 대기 |

## 3. 자동 리포트 시스템 (GitHub Actions + Claude CLI)

| 이름 | 무엇 | 상태 |
|---|---|---|
| US 일일 리포트 | 매 거래일 08:05 KST — 미국 마감 + 한국장 함의, 텔레그램+이메일+커밋 | 🟢 운영 |
| KR 일일 리포트 | 매 거래일 17:05 KST — PB 스타일 7섹션, 수급·업종·논리점검·기회 발굴 | 🟢 운영 (2026-07-03 데이터 복원) |
| 주간 리포트 | 일요일 13:05 KST — 주간 리캡 + 기여도 귀속 + 다음 주 계획 | 🟢 운영 (pre-fetch 라이브 2026-07-05 확인) |
| KR 기회 파이프라인 | `docs/reports/_kr_pipeline.md` — 섹터 추세·후보 승급(신규→관찰→연구)을 매일 누적하는 상태 파일 | 🟢 운영 |
| 투자 논리 파일 | `.github/scripts/kr-theses.md` — 종목별 thesis·재검토 트리거 (리포트가 매일 대조) | 🔴 초안, 사용자 확정 대기 |
| daisy-chain 스케줄러 | cron 드롭 회피 — run이 다음 run을 self-dispatch, 정시성 확보 (GAS 18분 dedup이 단일 권위) | 🟢 운영 (실측 검증 완료) |
| 무음 실패 알림 | 리포트 미생성·체인 사망 시 텔레그램 경고 + 빨간 run | 🟢 2026-07-03 추가 |

## 4. 개발·운영 도구

| 이름 | 무엇 |
|---|---|
| `apps-script-v2/push_safe.py` | Secret.js 보호 GAS 배포 (node --check 사전 검증) |
| `scripts/gas_redeploy.py` | Apps Script API로 버전 생성+배포 갱신 (에디터 클릭 불필요) |
| `scripts/post_trade.py` | 카톡 매매 기록 POST 헬퍼 |
| `scripts/save.sh` / `scripts/run.sh` | `저장!`·`실행@` 자동화 — memory 미러+커밋+push / pull+복원 |
| `scripts/check_stale.sh` | 인덱스 문서 ↔ 코드 정합 검사 (미등재 함수·신선도) |
| `.github/workflows/diag-egress.yml` | 러너 egress 진단 워크플로 — "차단" 이슈 재사용 도구 (2026-07-03 신규) |
| 배포 워크플로 2종 | `deploy-web.yml` / `deploy-web-desk.yml` → GH Pages 자동 배포 |

## 5. 지식·프로세스 자산 (재사용 가능한 무형 산출물)

| 이름 | 무엇 |
|---|---|
| docs 체계 | `code-map`(증상→위치 인덱스)·`errors`(증상→원인→해결)·`decisions`·`architecture`·`pending`·`sessions/`·`plans/` |
| `/design-check` 게이트 | 위험 변경 코딩 전 설계 노트 4항목 — 2026-07-03 첫 실증(진단이 가설을 뒤집어 대공사 회피) |
| 검증 절차 규약 | walk-through 필수·"어디·무엇·어떻게·예상값" 사용자 확인 형식 (CLAUDE.md) |
| memory 시스템 | 행동 지침 30+건 — `memory/` repo 미러로 멀티 맥 동기화 |
| 진단 노하우 | WebFetch≠curl≠IP 차단 층위 진단, GAS 재배포 API, daisy-chain 패턴 등 (memory·errors에 축적) |

---

**요약**: 화면 5종 + GAS 백엔드 1식 + 자동 리포트 채널 4종(일일 2·주간·장중 푸시) + 도구 9종 + 프로세스 자산 — 데이터 수집부터 분석·발송·운영까지 전 구간이 자동화된 개인 포트폴리오 시스템.
