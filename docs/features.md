# 기능 현황

last updated: 2026-05-25

## ✅ 완료

### iOS 앱
- 구글 로그인 (GoogleSignIn)
- 대시보드 — 포트폴리오 요약 (총매입/현재가/수익/수익률, 일간변동)
- 종목 목록 — 카드형, 펼치기/접기, 전체 터치 영역
- 분석 — 분류별·계좌별 도넛차트, 수익률 순위
- 참고지표 — 카테고리별 섹션 카드 (KOSPI/KOSDAQ/SPX 등)
- 플로팅 캡슐 탭바 (4탭)
- 백그라운드 네트워크 세션
- 캐시 서비스 (앱 시작 시 즉시 표시)

### GAS
- 포트폴리오 데이터 조회 (`mobileGetPortfolio`)
- 가격 갱신 (`mobileTriggerUpdate`)
- 종목현황 업데이트 전체/빠른 (`mobileUpdateHoldingsFull/Fast`)
- 통합 업데이트 (`mobileUpdateAll`)
- 참고지표 조회·저장 (`mobileGetReferenceIndicators`)
- 추이 기록 (Section A/B/C)
- 카톡 자동입력 (신시스템 전용, 구시스템 Web App 경유 openById)
- 종목상태 이력 (*종목상태_이력* 시트 자동 누적)
- 장기 가격 이력 (*장기_가격_이력* 시트, KIS 주봉/일봉 백필) + 신규 종목 자동 1Y 백필
- 1M/3M/6M/1Y *현재가_이력* + *장기_가격_이력* 통합 직접 계산
- 종목 상세 API (newMobileGetStockDetail) + 월별 실현손익 API (newMobileGetMonthlyRealized)
- 대시보드 보유종목 정렬 드롭다운 + 매입금액 컬럼
- KIS API — 국내주식, 해외주식, 국내지수, 해외지수, 국내선물
- Yahoo Finance 연동 (선물 데이터)
- GOOGLEFINANCE fallback (VIX, TNX, DXY, 금, WTI)
- Named Range 기반 동적 셀 참조

### Telegram 봇 (애플워치 손익 알림)
- 워치 → Telegram 봇 → GAS webhook 우회 구조 (시크릿은 GAS Properties에만, 클라이언트에 0개)
- 양방향: "갱신" 메시지 → 가격+보유현황 갱신 후 손익 회신 (워치 답글 가능)
- 자동 푸시: 거래일 09:00~16:00, 매시 :00/:20/:40 근처 (3개 트리거)
- 보안: webhook URL secret query + chat_id 화이트리스트 이중 검증, `update_id` 중복 제거, `LockService` 동시 처리 차단

## 🔄 미검증 (구현은 됐으나 실제 동작 확인 필요)

- KIS 해외지수 API (SPX/NDX/DJI/SOX) — tr_id HHDFS00000300
- KIS 국내선물 API (코스피200선물) — tr_id FHMIF10000000
- GOOGLEFINANCE 금 (`COMEX:GC1!`), WTI (`NYMEX:CL1!`), 달러인덱스 (`DX-Y.NYB`)

### 웹앱 (React PWA — web/)
- Google OAuth 로그인 (GIS)
- 대시보드 — 합계수익/오늘수익/확정운용/환율 + 수익 히스토리 차트
- 종목 목록 — 검색/계좌필터/정렬/expandable 카드
- 분석 — 매트릭스/계좌별5탭/연환산차트/52주포지션
- 참고지표 — 카테고리별 섹션 + 갱신 버튼
- GitHub Actions 자동 배포 → https://ejunwon-lab.github.io/FD5to6/
- PWA (홈화면 설치 가능)

### 데스크 (Bloomberg 스타일 — web-desk/)
- Google OAuth 로그인 (GIS)
- 5 메뉴: Dashboard · Holdings · Analysis · Indicators · Activity
- **Dashboard**: KPI strip(총자산=주식+대기자금 · Total Return · Today P&L · Positions · Cash Reserve) · Markets 위젯(6 지표) · Equity Curve(6 기간 필터) · Recent Activity · DashboardHoldings 통합
- **Holdings**: Account P&L 패널 (주식 계좌별 → 비주식 자산(펀드·예금·보험·기타) → 대기자금 → 순자산 합계) + 3-view 토글(Web 카드/Terminal 카드/List) + 검색·필터·정렬 + 종목 상세 모달
- **계좌명 표시 규칙**: `{미래/삼성}_{계좌명}` (예: 미래_종합_랩 · 삼성_ISA · 미래_퇴직연금 · 삼성_퇴직연금) — `web-desk/src/lib/accountDisplay.ts` 공통 유틸
- **Indicators**: Top Gainers/Losers (각 3건) + Market Heatmap (|Δ%| 격자) + 카테고리별 패널
- **Analysis**: Risk-Return KPI strip(Sharpe·MaxDD·Vol·Win·Best) · Allocation 도넛 · Concentration bar · Profit Contribution(±막대, ₩/% 토글) · Top Winners/Losers
- **Activity**: 월별 P&L + 5 KPI strip
- **Ticker** (상단 스크롤): live indicators + holdings movers, 종목명 메인 표시
- **표시 규칙**: 모든 숫자 풀(`toLocaleString()`), 종목명 메인 + 종목코드 보조
- **자동 캐시 구조** (2026-05-25):
  - `DataProvider` Context 단일 데이터 소스 (모든 페이지가 1 instance 공유, 페이지 전환 시 fetch 0건)
  - 첫 진입: portfolio + indicators + profitHistory 우선 → monthlyRealized prefetch
  - 시간당 자동 백그라운드 재페치 (GAS 자동 갱신과 매칭)
- ⚡ 전체 업데이트 버튼: 사용자 명시 KIS 강제 갱신
- GitHub Actions 자동 배포 → https://ejunwon-lab.github.io/FD5to6/desk/

### GAS 자동 트리거
- `scheduledDailyUpdate` — 매일 17:30 장 마감 후 정리 (`setupDailyTrigger`)
- `scheduledHourlyUpdate` (2026-05-25 신규) — 거래일 09:30~16:30 매시 :30(±5분) `updateAllNew`. `everyMinutes(30)` + 핸들러 분/시각/거래일 체크. LockService로 tgPushPnL·사용자 갱신과 충돌 시 skip
- `tgPushPnL` — Telegram 자동 푸시 (매시 :00/:20/:40, 거래일 09:00~16:00만 발송)
- `onEdit` 트리거 — *설정* 시트 C7:C12 편집 시 같은 행 E열에 yyyy-MM-dd HH:mm 자동 스탬프 (`_handleCashReserveTimestamp`)

### 대기자금 (2026-05-25 신규)
- *설정* 시트 A7:E12에 사용자 수동 입력 (증권사·구분·금액·비고·업데이트 날짜)
- `newMobileGetPortfolio` 응답에 `cashReserve: { items, total }` 필드로 노출 (기존 summary·holdings 무변경)
- 데스크: KpiStrip 총자산 = 주식 평가 + 대기자금, Holdings Account P&L 하단에 대기자금 행 + 순자산 합계
- 다른 클라이언트(iOS·web·Telegram)는 신규 필드 무시 (선택적 호환)

## ❌ 미완료

