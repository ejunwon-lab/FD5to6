---
name: project_pb_report_email
description: 시장 리포트 PB 격상 + 이메일 셀프발송 채널(안전장치 5중) — 2026-06-20 구축
metadata: 
  node_type: memory
  type: project
  originSessionId: 6020b076-c075-4ed1-9cb3-f5dc304a1520
---

매일 시장 리포트가 **단순 리캡 → 내 포트 중심 PB 자문**으로 격상됨(2026-06-20). 텔레그램 + **이메일**(halcyon.public@gmail.com 셀프) 동시 발송.

**구조**: kr/us-prompt 7섹션 역피라미드 — ⚡한줄+액션 → 💼내포트 → 🧭논리·방향 → 📊시장 → 🔮전망·시나리오 → 🎯기회 → 📅변수. 결론·내포트 위로, 종합산문 폐지, 한 사실 한 번. US 리포트 핵심 = 미국장→내일 한국 반도체(48%) 선행신호.

**데이터 경계(중요)**: 가격·수급·로테이션 + 조건부 시나리오만. **밸류에이션 목표가·컨센서스 단정 금지**(환각). US 거시는 기사 출처(한경 등) 강제, 일반지식 메우기 금지, 해석은 추론 라벨.

**이메일 (GAS emailReport, [[reference_gas_redeploy_via_api]])**: `MailApp.sendEmail`, 수신=발송=`getEffectiveUser` 소유자 **고정**(제3자 불가). 안전장치 5중 — killswitch(`email_disabled`, `emailKillSwitch_ON/OFF` 토글)·제목화이트리스트(`Market Close/Wrap`)·일일상한6·주소마스킹·수신자고정. `script.send_mail` 스코프(재승인 완료). `_mdToHtml`로 htmlBody. send_telegram.py 4096 분할.

**데이터 정합성**: `portfolioReturn{d5,d20}` = 일별 자산변화율(dRate) 복리누적(매매 강건, KOSPI/KOSDAQ 단위일치 비교). operatingRate(누적)는 매매 오염이라 강등.

**휴장**: 직전거래일 리뷰 풀 리포트(빈 메시지 폐지). KR은 Yahoo `^KS11`/`^KQ11` 폴백.

GAS v18→v22. 발송은 market-report.yml job(daisy-chain dispatch, guard 멱등). 프롬프트 수정 = `.github/scripts/{kr,us}-prompt.md`. 설계: `docs/plans/2026-06-20-PB리포트-이메일채널.md`. **월요일(6/22) 첫 실런 = 이메일 HTML 실발송 라이브 검증.**
