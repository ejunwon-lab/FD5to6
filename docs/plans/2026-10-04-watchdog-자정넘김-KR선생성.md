# 설계 노트 — watchdog 자정 넘김 오탐 + KR 리포트 선생성 (2026-10-04)

## 문제 (실측)

GH schedule cron 지연이 8/28부터 **+4~7h**로 커져 KST 자정을 넘김. 두 곳이 "실행 시점 날짜 = 오늘"을 전제하고 있어 동시에 깨짐.

1. **watchdog 오탐** — 21:10·22:10 예약이 00:06~05:05(익일)에 실행 → 막 시작된 날짜를 검사 → 평일 "푸시 0건·시트 stale·US 없음", 일요일 "WEEK 없음"으로 🔴 → run red → 실패 메일 매일 2통. 8/28~10/4 schedule run 중 success는 **토요일 새벽 실행분뿐**(검사 항목 없음). 실제 자동화는 정상(푸시 체인 alive, market-report 최근 14회 success).
2. **KR 리포트 선생성 (실결함)** — KR 백업 cron(17:42 KST 예약)이 자정 넘어 실행 → `DATE_KST`가 다음 날 → 파일 없음 → **전일 장 데이터로 "다음 날짜" 파일 생성·발송** → 그날 17:0x 정규 dispatch는 "이미 발송됨 — skip". 리포트 repo 커밋 시각 대조로 **9건** 확인(8/28·8/29(토)·9/1·9/15·9/22·9/29·9/30·10/1·10/2). 해당일 저녁 마감 리포트 미생성. watchdog은 파일 존재만 봐서 ✅로 통과시킴.

## 변경

| # | 파일 | 내용 |
|---|---|---|
| A | `.github/scripts/report_window.sh` (신규) + `market-report.yml` 가드 3곳 | 자동 실행(schedule·auto dispatch)은 **창 안에서만 생성** — US 평일 08:00~21:59 / KR 평일 17:00~23:59 / weekly 일요일 13:00~23:59 KST. 창 밖이면 기존 `already=yes` 경로로 skip. 수동 dispatch는 무관(강제 재생성 유지) |
| B | `scripts/watchdog_check.sh` | **대상일** 개념 도입 — KST 20시 이전 실행이면 전일을 검사(`WATCHDOG_DATE`로 주입 가능). 푸시 run 집계를 대상일 하루 창으로, 시트는 "마지막 행 == 오늘" → "대상일 행 존재"로, 리포트는 존재 + **커밋 시각 검사**(대상일 당일·US 7시/KR 16시 이후) |
| C | `watchdog.yml` | 입력 `auto`·`date` 추가, `run-name`으로 cron/chain/manual 구분, dedup 키를 "오늘 성공 run" → "**같은 대상일** 성공 run(cron·chain)"으로, 리포트 checkout `fetch-depth: 0`, dry_run은 red 안 냄 |
| D | `telegram-push.yml` | 체인이 매일 21:10~21:59 KST 창에서 `watchdog.yml` auto dispatch (리포트 dispatch와 같은 함수 패턴, `|| true` 격리 안) |

## 1. 외부 동작 가정 + 근거

- GITHUB_TOKEN의 `workflow_dispatch`는 재귀 방지 예외라 체인→타 워크플로 dispatch 가능 → 같은 체인의 market-report dispatch가 8/27 이후 매 거래일 08:06~08:32·17:10~17:20 커밋으로 실측됨(리포트 repo 커밋 시각).
- telegram-push는 `--ref main` self-dispatch → 다음 체인 run(≤120분 내)부터 새 워크플로 파일 적용. 체인 재시작 불필요.
- `run-name`은 `github`·`inputs` 컨텍스트 사용 가능, `gh run list --json displayTitle`로 조회됨 → **[실환경 확인]** dispatch 후 displayTitle 실측.
- `actions/checkout`은 기본 `fetch-depth: 1` → 커밋 시각 조회엔 이력 필요 → `fetch-depth: 0`(md만 있는 소형 repo).
- 리포트 커밋 = 생성 직후(같은 job) → 커밋 시각 ≈ 생성 시각. 수동 재생성 시 마지막 커밋이 갱신되므로 `git log -1`(마지막 커밋) 기준.
- `git log --date=format-local` + `TZ=Asia/Seoul` → macOS·ubuntu 동일 출력(로컬 실측 가능).

## 2. 과거 부류 (errors.md)

- **6/8~10 "cron ~4.5h 지연"** — 같은 뿌리. 당시 해결은 "체인 dispatch로 주경로 정시화, cron은 백업 강등". 백업 cron이 **자정을 넘길 만큼** 밀리는 경우와 watchdog cron은 미커버 → 이번에 창 가드(A)와 대상일(B)로 닫음. 교훈 재확인: *시각 간격·"오늘"에 의존하는 멱등은 스케줄러 지연에 깨진다.*
- **7/19 watchdog 설계 노트** — "정시성 불요(지연 발화도 검사 가치 동일)" 가정이 틀림(자정 넘김 미고려). + "daisy-chain 무수정" 원칙은 이번에 완화 — market-report dispatch로 3개월 검증된 동일 패턴, `|| true` 격리 안이라 poke 루프·체인 dispatch에 영향 없음.
- **6/10 `push | tail` exit code 은폐** — 파이프 뒤 판정 없음. dedup은 `if`로 명시.
- **6/8 안전망 2회 레이스** — watchdog은 read-only, 중복 실행 최악 = 메시지 2통. 체인 run 교대가 21:10~21:59에 걸리면 2회 dispatch 가능 → dedup(같은 대상일 성공 run)이 흡수.
- **7/23 "침묵 실패"** — 창 가드로 skip된 날 주경로까지 실패하면 리포트 무생성·무알림 → watchdog 리포트 검사(🔴 없음)가 잡음(설계상 의도된 분담).

## 3. 추론 가능 vs 실환경 전용

- 머리로 거름: 창 판정(요일·시각 산술, `10#` octal 회피), 대상일 규칙, dedup 대상일 일치, 기존 `already` 출력 재사용으로 후속 step 전부 skip, `bash -e`에서 `if ! cmd` 안전.
- 로컬 실측 가능(오늘): `report_window.sh` 케이스 표, `watchdog_check.sh`를 `WATCHDOG_DATE`로 과거일 재현(리포트 repo clone) — 10/1은 KR 🔴(00:23 커밋), 9/28은 전부 ✅ 기대.
- 실환경에서만: ① `run-name`/displayTitle 실제 값 ② 체인의 21:1x watchdog dispatch 실발화 ③ 자정 넘은 KR 백업 cron이 실제로 skip 로그를 내는지 ④ 러너에서 `fetch-depth: 0` + 커밋 시각 판정 → ①④는 push 직후 dry_run dispatch로, ②는 당일 밤, ③은 다음 거래일 밤 이후 run 로그로.

## 4. 상대 시스템에서 보이는 것

- 신규 외부 호출 없음. GitHub API: watchdog dispatch 1회/일 추가, 푸시 run 조회 `-L 30→100`(페이지 1회). GAS 호출 수 불변.

## 5. 검증 방법

- 자동: `bash -n` 2개 · yaml 파싱 3개 · `report_window.sh` 케이스 표 · `watchdog_check.sh` 과거일 재현 3건 · `--print-target` 2건.
- 라이브(push 직후): `gh workflow run watchdog.yml -f dry_run=true -f date=2026-10-01` → 로그에 KR 커밋 시각 🔴, run은 success(dry_run), 발송 없음.
- 사용자: ① 텔레그램 `🩺 자동화 헬스체크`가 **21:1x KST**에 도착 ② 실패 메일 중단 ③ 다음 거래일 KR 리포트가 17:1x에 도착, 익일 새벽 재발송 없음.

→ 게이트: **통과** (실환경 ①④는 당일 dry_run, ②③은 run 로그 사후 확인)
