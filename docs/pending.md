# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.
확인 예정일이 있는 항목은 줄 안에 `⏰YYYY-MM-DD` 태그 — `실행@` 때 `scripts/check_pending_due.sh`가 만기 도래 항목을 자동 표시 (닫으면 태그째 삭제).

> 2026-07-16 대청소: 2026-05월 stale 항목 10건을 증거 실측으로 닫음(트리거 생존=대시보드 17:32 갱신·현재가_이력 당일 행, 주간 pre-fetch=run 29179140896 로그 HTTP=200, 리포트 커밋=FD5to6-reports 당일 커밋). 상세는 `docs/sessions/2026-07-16-pending대청소-TWR.md`.

---

## 🔴 결정·확인 대기 (사용자 액션 필요)

- **🔴 GAS 죽은 코드 정리 — Secret.js 확인 대기 (2026-07-03)** — 모바일 GET 8함수(`newMobileGet*` 등)+KIS 메서드 절반이 로컬 grep 도달 불가. 단 원격 전용 Secret.js가 doGet 라우팅 보유 가능 → **사용자가 GAS 에디터에서 Secret.js 내 `doGet`/`newMobileGet` 참조 유무 확인** 후 삭제 범위 확정. 부수: 환율 fallback 불일치(`_getFxRates` 0 vs `_mGetFxRates` 1400/1700 — 5곳 중복), buildDashboard 셀 단위 I/O 배치화.
- **🔴 프라이버시 스크럽 마무리 — GitHub Support GC 요청 (2026-07-16 격상)** — force-push 2회(금액·실거래 스크럽) 완료했으나 **dangling 객체는 GitHub 서버에 남아 옛 SHA URL로 접근 가능**. https://support.github.com/request 에 "force-pushed ejunwon-lab/FD5to6 to remove sensitive files; please run GC" 요지로 요청해야 정리 완결.
- **🔴 kr-theses.md 투자논리 초안 → 사용자 확정** — 확정 시 리포트의 "(논리 초안)" 라벨 제거. + KR 리포트 로테이션/파이프라인 분석이 실제 유용한지 내용 품질 피드백. (구 "KR 리포트 B+C" 항목의 잔여분)

## 🟡 진행 중 · 예정

- **🟡 자동화 watchdog — 첫 정기 heartbeat 확인만 잔여 (2026-07-19 구축)** ⏰2026-07-21 — `watchdog.yml`(매일 21:10·22:10 KST) + `scripts/watchdog_check.sh` + pre-commit 금액·시크릿 스캐너(`scripts/git-hooks/pre-commit`, run.sh가 각 맥 자동 활성화) 배포. 로컬 스모크·자가테스트 8/8·라이브 dispatch 통과. **잔여**: 첫 cron heartbeat가 21:1x~22:1x에 텔레그램 도착하는지 + 거래일 항목(발송 N건·시트 오늘·리포트 US/KR) 전부 ✅인지 확인. 설계: `docs/plans/2026-07-19-자동화-watchdog.md`
- **🟡 휴장일 권위 소스 전환 — 시트 실측 확인만 잔여 (2026-07-20 배포)** ⏰2026-07-26 — 채택 기준을 이름 화이트리스트 → 구글 캘린더 '공휴일' 분류(DESCRIPTION)로 교체 + `scheduledHolidaySync` 매월 25일 실행(12월 게이트 제거). push_safe 배포 완료. **잔여**: 🗓️ 휴장일 동기화 실행(메뉴 1클릭 또는 7/25 04:00 트리거 자동) 후 *휴장일* 시트에 **2026-06-03 지방선거일 행 존재 + 스승의날 부재** 확인. 부수 [확인 필요]: 주 맥북 백업 덤프 *현재가_이력*에 2026-06-03 행 유무(잠복 결함 실제 발현 여부 — errors.md 2026-07-20). 설계: `docs/plans/2026-07-20-휴장일-권위소스.md`
- **🟡 시트 타입계약 실데이터 1회 확인 (2026-07-20 구축)** ⏰2026-07-27 — `scripts/check_sheet_types.py`(합성 테스트 6클래스 통과) — `backup_sheets.py`가 백업 직후 자동 실행. **잔여**: 다음 실백업(주 맥북 launchd 일 21:00 주1회) 출력에서 "✓ 타입계약 통과" 또는 위반 목록 확인.
- **🟡 제헌절 휴장 반영 — 월요일 푸시 정상 확인만 잔여 (2026-07-17)** ⏰2026-07-20 — 제헌절 공휴일 재지정(당일 첫 적용) 미반영으로 텔레그램 오발송. Holidays.js 3곳 수정·배포(HOLIDAY_NAMES '제헌절'·고정휴장 루프 7/17·fallback) + 시트 동기화 완료 + workflow 재가동. **잔여**: 다음 거래일(월 7/20) 09:00~ 첫 푸시가 정상 발송되는지 확인(체인 재시드 후). 설계·상세: `docs/plans/2026-07-17-제헌절-휴장일-반영.md`, 세션 `docs/sessions/2026-07-17-제헌절-휴장일.md`
- **🟡 US 리포트 첫 시도 실패 수리 — 라이브 검증 대기 (2026-07-16)** ⏰2026-07-20 — permission bypass·max-turns 40·파일명 결정론화 배포(dc464c4). 확인: ①dry_run 스모크(run 29490849045) 결과 ②내일 08:0x 첫 US dispatch success + ⚠️ 알림 부재 ③17:0x KR·일요일 weekly도 같은 변경 적용됨. 설계: `docs/plans/2026-07-16-US리포트-첫시도실패-수리.md`

- **🟡 주간 수익률 입금 왜곡(TWR) 보정 — 구현·배포 완료(v29~v30), 소급 기록만 잔여 (2026-07-16)** ⏰2026-07-20 — ①원장 `구분=입금/출금` 행(addTrade 확장, 멱등) + ②read-time TWR 보정·suspect 플래그 배포, POST 실측 통과. 부수로 **% 셀 비대칭 파싱 버그**(음수 dRate 100배 축소 → d5 +8.04%가 실제 -4.45%) 발견·수정(errors.md 2026-07-16). **소급 기록까지 완료(7/16 저녁)**: "6/23 입금"은 오진(실제 시장 폭락일 — 파싱 버그가 진범), 신한만기 기록시차 2건(7/7·7/9)을 flow 행으로 소급 교정·실측 검증(7/9 -5.78→+2.06 flowAdj). **잔여**: ①내일(7/17) 첫 자동 재계산 후 *보유현황* 정상 확인 ②운영 습관 — 내부 이동은 같은 날 양쪽 반영 or flow 행 기록. 은행 예금 입출금은 시트 직접 행만(addTrade는 미래·삼성 계좌만). 설계·실측: `docs/plans/2026-07-16-TWR-입금왜곡보정.md`
- **🟡 매도 복기 v2 — 곡선 소급 (2026-07-15)** — v1(매도추적 시트+웹/데스크 카드+기간별 번 돈 타일) 배포 완료(GAS v27). 오늘 스냅샷은 판 종목 47건 전량 커버. 남은 것: *현재가_이력* 시작(2026-01-11) 이전 매도의 매도일~현재 일별 곡선 gap을 KIS 국내 일봉(FHKST03010100) 1회 소급 충전(수동 함수, 트리거 X). 실사용으로 곡선 효용 확인 후 진행. 해외(MU)는 환율 반영 시 함께.
- **🟡 리포트 private 분리 — 다른 맥 3단계만 잔여 (2026-07-16 갱신)** — 라이브 커밋 검증 완료(7/16 실측: FD5to6-reports에 매 거래일 US·KR + 주간 WEEK-07-05·07-12 커밋). 남은 것: **다른 맥 3단계** ⓐ FD5to6 세션 열고 `실행@`(run.sh 자동 재정렬·리포트 clone) ⓑ `.env` 생성(`TG_WEBHOOK_SECRET=...` — 값은 주 맥북 FD5to6/.env에서 복사) ⓒ `bash scripts/setup_backup_launchd.sh` 1회.
- **🟡 프론트 호스팅 GitHub Pages 의존 탈피 검토 (2026-07-10)** — 7/9 Actions 광역 장애로 반나절 라이브 미반영. 대안 1순위 Cloudflare Pages(`wrangler pages deploy dist`). 이전 비용 = base 경로 rebuild + OAuth 도메인 갱신. 사용자 '이번엔 대기' 결정 — Pages 재발 시 진행.
- **🟡 데스크 로드맵 (2026-07-23 전수 분석 → 5단계, 사용자 승인)** — ①신뢰성 묶음 ✅ ②KIS Status 페이지 ✅(GAS newMobileGetSystemStatus) ③모바일 2단계 ✅(Today 컨트롤 가로스크롤 — Analysis·히트맵은 기대응 확인) ④포맷 로케일 통일 ✅(107곳 toLocaleString에 'ko-KR' 일괄 지정 — fmtKRW 전면 치환은 표기 회귀 위험 대비 이득 없어 제외) ⑤ 1차분 ✅(Price History·Settings·Phase C 3종[드로다운 underwater·분류 도넛·홀딩스 CSV]). **⑤ 잔여**: 실현손익 CSV, 상관관계 매트릭스(종목별 일봉 N회 조회 필요 — 비용 검토), 이코노믹 캘린더, Dividends(데이터 설계부터 — /design-check). ⑥Analysis 리스크 지표 자산 기반 교정 ✅(totalAsset API + Sharpe·Vol·MDD 분모 교체, TWR 한계는 주석 명시 — 완전 TWR 공용화는 후속 후보). 분석 상세: `docs/sessions/2026-07-23-수익로직감사-데스크반응형.md`
- **🟡 web-desk 모바일 반응형 — Dashboard 완료(실기기 확인됨), Today→Analysis 잔여 (2026-07-23)** — 완료: MobileTabBar(하단 탭 6)·100dvh 셸·홀딩스 상위 9 접기·필터바 2행화·카드 폴드 A안(접힘 2줄 헤더, 모바일 기본 접힘, 전역 토글) — 사용자 아이폰 확인 완료. **잔여**: Today·Analysis 탭 모바일 다듬기 + 사용 피드백 반영.
- **🟡 web-desk 테마 시스템 — 구현 완료, 실기기 확인 대기 (2026-07-23)** — 가독성 개선(Pretendard·대비≥4.5:1·소프트 팔레트·모바일 폰트 상향)을 Modern 테마로, 기존 네온은 Terminal 테마로 보존. Settings에서 전환(기본 Modern). 빌드·tsc·vitest 통과. **잔여**: 배포 후 사용자 아이폰·데스크톱에서 Modern 확인 + Terminal 전환 회귀 확인. 근거: decisions.md 2026-07-23.
- **🟡 위생 묶음 마무리 확인 2건 (2026-07-16 일괄 처리 완료)** ⏰2026-07-20 — ①~⑤ 전부 처리(로케일 ko-KR 통일·52주 공용화·kst는 기수정 확인 / format 테스트 채움·desk vitest 신설 / save.sh 트레일러·npm ci·desk 테스트 step / code-map 등재 / Trend.js % numeric+서식 v31). **잔여 확인만**: ⓐ내일 첫 `updateAllNew` 후 *추이 기록* % 셀 — 시트 표시 `+X.XX%` 정상 + 덤프에서 S·Y·AC·AF numeric 분수 + POST dailyReturns 정상 ⓑweb/iOS "전일 수익" — 다음 음수 마감일에 화면 확인(AF 파싱 수정 클라 검증).
- **🟡 PB 리포트 이메일 — 실도착 확인 (사용자, 나중에)** — 매 거래일 US·KR 자동 생성·커밋·텔레그램 발화는 무결 확인(7/16까지). 이메일 HTML 실도착만 확인(halcyon.public Gmail). 주간 리포트 이메일 포함.
- **🟡 매매기록! 잔여** — ①기록 날짜가 GAS 서버 기준(로컬과 1일 차 가능) — 날짜 민감 건 사용자 확인 ②기록 정정/삭제 수단 없음(append만) — 필요 시 deleteTrade/editTrade. 새 마스킹 계좌 등장 시 memory 누적.
- **🟢 코딩 전 설계 게이트 2단계 — hook 강제 (2026-06-09)** — 1단계(전역 규칙+`/design-check` skill) 구축 완료. 남은 것: 위험 변경에 첫 적용해 효과 증명(→ 2026-07-16 TWR에 적용 중) → 확인되면 PreToolUse hook으로 강제 게이트 추가.

## ⚪ 백로그 (착수 전)

- **대시보드 우측 상단 버튼 정리** — 역할 재정의 논의 완료, UI/레이블 정리 작업 예정
- **iOS 묶음** — ①공휴일 전일 수익 표시 버그: DashboardView.swift 수정 완료, Xcode 빌드 후 확인 ②새 시스템 연결: mobileGetPortfolio를 *포지션*/*가격_히스토리* 기반으로 전환(Phase 3) ③HoldingCard 3줄 식 반영 빌드
- **installable onEdit 트리거 등록** — Apps Script 에디터에서 onEdit installable 트리거 추가(대시보드 정렬 드롭다운). 미등록이어도 다른 기능 무영향
- **웹앱 다크모드 스타일 개선** — 다크모드 색상/대비 보정
- **2차 분석/시각화 보강** — MDD/변동성/Sharpe, 매매 패턴 분석(월별 거래 빈도, 보유기간 vs 수익률 산점도) — 1차 결과 사용자 검토 후 결정
