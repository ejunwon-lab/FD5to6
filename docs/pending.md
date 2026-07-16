# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.

> 2026-07-16 대청소: 2026-05월 stale 항목 10건을 증거 실측으로 닫음(트리거 생존=대시보드 17:32 갱신·현재가_이력 당일 행, 주간 pre-fetch=run 29179140896 로그 HTTP=200, 리포트 커밋=FD5to6-reports 당일 커밋). 상세는 `docs/sessions/2026-07-16-pending대청소-TWR.md`.

---

## 🔴 결정·확인 대기 (사용자 액션 필요)

- **🔴 GAS 죽은 코드 정리 — Secret.js 확인 대기 (2026-07-03)** — 모바일 GET 8함수(`newMobileGet*` 등)+KIS 메서드 절반이 로컬 grep 도달 불가. 단 원격 전용 Secret.js가 doGet 라우팅 보유 가능 → **사용자가 GAS 에디터에서 Secret.js 내 `doGet`/`newMobileGet` 참조 유무 확인** 후 삭제 범위 확정. 부수: 환율 fallback 불일치(`_getFxRates` 0 vs `_mGetFxRates` 1400/1700 — 5곳 중복), buildDashboard 셀 단위 I/O 배치화.
- **🔴 프라이버시 스크럽 마무리 — GitHub Support GC 요청 (2026-07-16 격상)** — force-push 2회(금액·실거래 스크럽) 완료했으나 **dangling 객체는 GitHub 서버에 남아 옛 SHA URL로 접근 가능**. https://support.github.com/request 에 "force-pushed ejunwon-lab/FD5to6 to remove sensitive files; please run GC" 요지로 요청해야 정리 완결.
- **🔴 kr-theses.md 투자논리 초안 → 사용자 확정** — 확정 시 리포트의 "(논리 초안)" 라벨 제거. + KR 리포트 로테이션/파이프라인 분석이 실제 유용한지 내용 품질 피드백. (구 "KR 리포트 B+C" 항목의 잔여분)

## 🟡 진행 중 · 예정

- **🟡 주간 수익률 입금 왜곡(TWR) 보정 — 구현·배포 완료(v29~v30), 소급 기록만 잔여 (2026-07-16)** — ①원장 `구분=입금/출금` 행(addTrade 확장, 멱등) + ②read-time TWR 보정·suspect 플래그 배포, POST 실측 통과. 부수로 **% 셀 비대칭 파싱 버그**(음수 dRate 100배 축소 → d5 +8.04%가 실제 -4.45%) 발견·수정(errors.md 2026-07-16). **소급 기록까지 완료(7/16 저녁)**: "6/23 입금"은 오진(실제 시장 폭락일 — 파싱 버그가 진범), 신한만기 기록시차 2건(7/7·7/9)을 flow 행으로 소급 교정·실측 검증(7/9 -5.78→+2.06 flowAdj). **잔여**: ①내일(7/17) 첫 자동 재계산 후 *보유현황* 정상 확인 ②운영 습관 — 내부 이동은 같은 날 양쪽 반영 or flow 행 기록. 은행 예금 입출금은 시트 직접 행만(addTrade는 미래·삼성 계좌만). 설계·실측: `docs/plans/2026-07-16-TWR-입금왜곡보정.md`
- **🟡 매도 복기 v2 — 곡선 소급 (2026-07-15)** — v1(매도추적 시트+웹/데스크 카드+기간별 번 돈 타일) 배포 완료(GAS v27). 오늘 스냅샷은 판 종목 47건 전량 커버. 남은 것: *현재가_이력* 시작(2026-01-11) 이전 매도의 매도일~현재 일별 곡선 gap을 KIS 국내 일봉(FHKST03010100) 1회 소급 충전(수동 함수, 트리거 X). 실사용으로 곡선 효용 확인 후 진행. 해외(MU)는 환율 반영 시 함께.
- **🟡 리포트 private 분리 — 다른 맥 3단계만 잔여 (2026-07-16 갱신)** — 라이브 커밋 검증 완료(7/16 실측: FD5to6-reports에 매 거래일 US·KR + 주간 WEEK-07-05·07-12 커밋). 남은 것: **다른 맥 3단계** ⓐ FD5to6 세션 열고 `실행@`(run.sh 자동 재정렬·리포트 clone) ⓑ `.env` 생성(`TG_WEBHOOK_SECRET=...` — 값은 주 맥북 FD5to6/.env에서 복사) ⓒ `bash scripts/setup_backup_launchd.sh` 1회.
- **🟡 프론트 호스팅 GitHub Pages 의존 탈피 검토 (2026-07-10)** — 7/9 Actions 광역 장애로 반나절 라이브 미반영. 대안 1순위 Cloudflare Pages(`wrangler pages deploy dist`). 이전 비용 = base 경로 rebuild + OAuth 도메인 갱신. 사용자 '이번엔 대기' 결정 — Pages 재발 시 진행.
- **🟡 web-desk 모바일 컴팩트 모드 (2026-07-04 사용자 요청)** — 7/4 반응형 보강으로 급한 불은 껐고, 장기적으로 폰 전용 컴팩트 모드(밀도 낮춘 레이아웃·List view 카드형·min-w 테이블 재설계) 정식 설계. web(PWA)과의 역할 분담 결정과 함께.
- **🟡 위생 묶음 마무리 확인 2건 (2026-07-16 일괄 처리 완료)** — ①~⑤ 전부 처리(로케일 ko-KR 통일·52주 공용화·kst는 기수정 확인 / format 테스트 채움·desk vitest 신설 / save.sh 트레일러·npm ci·desk 테스트 step / code-map 등재 / Trend.js % numeric+서식 v31). **잔여 확인만**: ⓐ내일 첫 `updateAllNew` 후 *추이 기록* % 셀 — 시트 표시 `+X.XX%` 정상 + 덤프에서 S·Y·AC·AF numeric 분수 + POST dailyReturns 정상 ⓑweb/iOS "전일 수익" — 다음 음수 마감일에 화면 확인(AF 파싱 수정 클라 검증).
- **🟡 PB 리포트 이메일 — 실도착 확인 (사용자, 나중에)** — 매 거래일 US·KR 자동 생성·커밋·텔레그램 발화는 무결 확인(7/16까지). 이메일 HTML 실도착만 확인(halcyon.public Gmail). 주간 리포트 이메일 포함.
- **🟡 매매기록! 잔여** — ①기록 날짜가 GAS 서버 기준(로컬과 1일 차 가능) — 날짜 민감 건 사용자 확인 ②기록 정정/삭제 수단 없음(append만) — 필요 시 deleteTrade/editTrade. 새 마스킹 계좌 등장 시 memory 누적.
- **🟢 코딩 전 설계 게이트 2단계 — hook 강제 (2026-06-09)** — 1단계(전역 규칙+`/design-check` skill) 구축 완료. 남은 것: 위험 변경에 첫 적용해 효과 증명(→ 2026-07-16 TWR에 적용 중) → 확인되면 PreToolUse hook으로 강제 게이트 추가.

## ⚪ 백로그 (착수 전)

- **대시보드 우측 상단 버튼 정리** — 역할 재정의 논의 완료, UI/레이블 정리 작업 예정
- **iOS 묶음** — ①공휴일 전일 수익 표시 버그: DashboardView.swift 수정 완료, Xcode 빌드 후 확인 ②새 시스템 연결: mobileGetPortfolio를 *포지션*/*가격_히스토리* 기반으로 전환(Phase 3) ③HoldingCard 3줄 식 반영 빌드
- **installable onEdit 트리거 등록** — Apps Script 에디터에서 onEdit installable 트리거 추가(대시보드 정렬 드롭다운). 미등록이어도 다른 기능 무영향
- **웹앱 다크모드 스타일 개선** — 다크모드 색상/대비 보정
- **2차 분석/시각화 보강** — MDD/변동성/Sharpe, 매매 패턴 분석(월별 거래 빈도, 보유기간 vs 수익률 산점도) — 1차 결과 사용자 검토 후 결정
