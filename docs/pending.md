# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.

---

## 🟢 예정 작업

- **대시보드 우측 상단 버튼 정리** — 버튼 역할 재정의 논의 완료, 실제 UI/레이블 정리 작업 예정
- **iOS 공휴일 전일 수익 표시 버그** — DashboardView.swift 수정 완료, Xcode 빌드 후 확인 필요
- **새 시스템 → iOS 연결** — mobileGetPortfolio 데이터 소스를 *포지션*/*가격_히스토리* 기반으로 전환 (Phase 3)
- **웹앱 다크모드 스타일 개선** — 다크모드에서 색상/대비 보정 필요
- **2차 분석/시각화 보강** — MDD/변동성/Sharpe ratio, 매매 패턴 분석 (월별 거래 빈도, 보유기간 vs 수익률 산점도) 등 — 1차 결과 사용자 검토 후 결정
- **카톡 마스킹 계좌 매핑 누적** — 카톡 자동입력 사용 시 새 마스킹 계좌번호 등장하면 reference 메모리에 누적
- **17:30 자동 트리거 등록 확인** — 사용자가 GAS 메뉴 "⏰ 매일 17:30 자동 트리거 등록" 한 번 클릭 후 정상 작동 검증
- **installable onEdit 트리거 등록** — Apps Script 에디터에서 onEdit installable 트리거 추가 (대시보드 정렬 드롭다운 작동)
- **새 *보유현황*의 K/L/M 수식 수동 입력 안내** — 펀드/예금/보험 종목: J(현재단가) + K(평가금액)=G*J, L(손익)=K-I, M(수익률)=IF(I>0,L/I,0) 수식 한 번 입력 후 보존됨
- **변동 라벨(오늘/전일/최근) 클라이언트 검증** — 원인 확정·수정 완료(errors.md 2026-05-17 참조). 비거래일 행이 *현재가_이력*에 누적되던 버그. GAS(NewSystem/MobileAPI) 배포 완료 → iOS·웹 모두 새 fetch 시 "최근"으로 표시됨. 사용자 앱 재실행/새로고침 후 최종 확인 필요. 클라이언트 방어 코드(changeLabel.ts/ChangeLabel.swift)는 다음 웹 배포·iOS 빌드 시 반영
- **Telegram 봇 자동 푸시 워치 알림 검증** — 2026-05-23 구축 완료. 다음 거래일(2026-05-26 월) 09:00~16:00 사이 워치에 자동 손익 알림 도착 여부 최종 확인. 트리거 3개(`tgPushPnL`, 매시 :00/:20/:40 근처) Apps Script 트리거 화면에서 확인됨
- **🕐 장중 매시 :30 자동 트리거 등록** — 2026-05-25 GAS 함수 배포 완료. 사용자가 시트 메뉴 🛠️ 유지보수 → 🕐 매시 :30 장중 자동 트리거 등록 1회 클릭 필요. 다음 거래일(2026-05-26 월) 10:30 이후 *대시보드* 시트 상단 "마지막 업데이트" 시각으로 정상 작동 검증
- **데스크 Account P&L · Phase A 신규 컴포넌트 사용자 검증** — 2026-05-25 배포 완료. Holdings/Indicators/Analysis 페이지에서 새 패널(Account P&L · Gainers/Losers · Market Heatmap · Profit Contribution) 표시·동작·디자인 사용자 확인. 보완 요청 받아 다음 세션에서 반영
- **Trade Log 전면 재설계 사용자 검증** — 2026-05-25 배포 완료 (GAS `newMobileGetMonthlyRealized` 행 단위 응답 + ActivityPage KPI 6칸·테이블 9컬럼·표시 규칙 적용). hard refresh 후 ① KPI 우측 Total Fees 칸 ② 막대 라벨 풀 숫자 ③ 종목명 메인+코드 보조 ④ 실제 매매 데이터 표시 (sample 아님) 확인. 세션 문서: `2026-05-25-trade-log-재설계.md`
- **Today 페이지 + 휴장일 drop + Footer 라벨 + web/iOS 동기화 사용자 검증** — 2026-05-27~28 배포 완료. 세션 문서: `2026-05-27-today-동기화-인프라.md`. 확인 항목: ① 데스크 단축키 Y → Today 페이지 (KPI 4칸 + 막대 카드) ② Dashboard ProfitChart·Analysis BenchmarkPanel·Monthly Heatmap·Indicator Detail Modal 차트 X축에 토·일·공휴일 안 보임 ③ 데스크 Footer 라벨 D/Y/H/A/I/T ④ web Holdings 카드 우측 3줄 (현재가 / +N원 +X.XX% / +N × M주 = +NM원). iOS HoldingCard 식은 별도 — Xcode 빌드 + 기기 설치 필요
- **데스크 사이드바 메뉴 중복 제거 + 단축키 첫글자 사용자 검증** — 2026-05-25 배포 완료. Realized P&L 메뉴 제거 (Workspace > Trade Log 한 곳만) + 사이드바 단축키 F1~F9 → 첫글자 단일키 (D/H/A/I/T/P/V/K/S) + App.tsx keydown 리스너 신규. hard refresh 후 ① Data 섹션에 Price History·Dividends 2개만 ② 사이드바 hint 단일 글자 ③ D/H/A/I/T 누르면 즉시 페이지 전환 ④ 검색창에 글자 입력 시 단축키 무시 ⑤ Cmd+D 브라우저 북마크 정상 동작 확인
- **🌅🌆 시장 리포트 (Claude Routines → 시트 → Telegram) 사용자 검증** — 2026-05-28 GAS 측 코드·배포 완료 (`Telegram.js`의 큐 함수 + `Main.js doPost` 분기 + 메뉴 3개). 셋업 가이드: `docs/market-report-routines.md`. 사용자 작업: ① **GAS Manage deployments → New version**으로 활성 deployment 업데이트 (URL 유지) ② 시트 메뉴 **🛠️ 유지보수 → 📊 시장 리포트 — 08:05·17:05 트리거 ON** 클릭 ③ claude.ai에서 routine 2개 등록 (US: cron `0 23 * * 0-4`, KR: cron `0 8 * * 1-5`) — 프롬프트는 가이드 파일에 그대로 있음, `{{WEB_APP_URL}}`·`{{SECRET}}`·보유종목 리스트 3곳만 치환. 메뉴의 **📤 큐 즉시 발송**으로 수동 테스트 가능 (먼저 시트에 직접 행 추가 후 클릭). → **선결: 아래 권한 재승인 완료 후 진행**
- **UrlFetchApp 권한 재승인 (긴급)** — 2026-05-29 09:13 권한 에러 발생. `appsscript.json`에 `oauthScopes` 명시 + 재배포 완료. **사용자 작업**: Apps Script 에디터에서 **`updateNewPriceHistory`** (NewSystem.js) 함수 ▶ Run → 권한 모달 → "고급 → 이동" → 모든 권한 허용 1회. 그 다음 시트 ⚡ 전체 업데이트 정상 동작 확인. 자세한 내용 `docs/errors.md` 2026-05-29 항목
