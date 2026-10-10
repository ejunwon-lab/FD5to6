# 2026-10-10 — watchdog 라이브 확정 · 안드로이드 PWA 설치 복구 · gh-pages 배포 직렬화

## 1. watchdog 정시화 라이브 확정 (실행@ 만기 실측)
- 10/5~10/9: 체인 dispatch 매일 21:1x success, cron 백업 dedup skip, KR 백업 cron 자정 넘김 7회 "창 밖" skip, KR 리포트 매일 17:09~17:16 커밋. 10/5 대체공휴일·10/9 한글날 휴장 판정 정상.
- 예외 1건: 10/5 21:10 run에서 gh run list·GAS 응답 동시 공백 → 🔴 → 10/6 05:32 백업이 같은 대상일 재점검 ✅(설계대로 자가 회복). 재시도 추가는 개선 후보로만.
- pending 4건 닫음(watchdog + 7월 잔여 3건: 휴장일 권위 소스·제헌절 후 푸시·US 리포트 수리). watchdog_check.sh Broken pipe 노이즈 제거.

## 2. 안드로이드 크롬 전체 화면 안 됨 → PWA 설치 조건 복구
- 원인: web `icon-192/512.png` 404 + sw 없음, desk 매니페스트 자체 없음. iOS는 메타 태그만 봐서 정상이었음.
- 수리: PNG 아이콘(web은 qlmanage+라운드 마스크, desk는 신규 icon.svg+rsvg), desk manifest.json + index.html 메타, 양쪽 패스스루 sw.js + main.tsx 등록. 라이브 8파일 200.
- 사용자 확인 잔여: pending 참조.

## 3. gh-pages 동시 push 레이스
- 위 커밋에서 web 배포 실패(non-fast-forward) 발견 → 재실행 복구 → 두 배포 워크플로에 `concurrency: gh-pages` 직렬화. 적용 push 자체에서 pending 대기 → 순차 success 실측.

## 문서
errors.md(2026-10-10 2건 + 10/4 후속 관찰), features·code-map, plans 1건, changelog, pending.
