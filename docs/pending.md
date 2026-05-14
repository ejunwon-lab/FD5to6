# Pending (열린 항목)

완료되면 이 파일에서 삭제하고 해당 세션 문서에 "완료" 기록.

---

## 🟢 예정 작업

- **대시보드 우측 상단 버튼 정리** — 버튼 역할 재정의 논의 완료, 실제 UI/레이블 정리 작업 예정
- **iOS 공휴일 전일 수익 표시 버그** — DashboardView.swift 수정 완료, Xcode 빌드 후 확인 필요
- **새 시스템 → iOS 연결** — mobileGetPortfolio 데이터 소스를 *포지션*/*가격_히스토리* 기반으로 전환 (Phase 3)
- **웹앱 다크모드 스타일 개선** — 다크모드에서 색상/대비 보정 필요
- **웹앱 숫자 표시 풀 출력** — krwCompact(억/만 축약) → 전체 숫자 표시로 변경 (또는 설정 옵션)
- **2차 분석/시각화 보강** — MDD/변동성/Sharpe ratio, 매매 패턴 분석 (월별 거래 빈도, 보유기간 vs 수익률 산점도) 등 — 1차 결과 사용자 검토 후 결정
- **카톡 마스킹 계좌 매핑 누적** — 카톡 자동입력 사용 시 새 마스킹 계좌번호 등장하면 reference 메모리에 누적
- **구시스템 잔존 임시 파일 정리** — `Quick_Fix_KIS.js`, `debugKISAPI.js` 사용 여부 사용자 결정 후 삭제
- **migrateOverseasUsdToKrw 일회성 함수 제거** — 해외 종목 USD→KRW 환산 완료 후 NewSystem.js의 migrateOverseasUsdToKrw / _fetchHistoricalFx / _findFxForDate 함수 삭제
- **17:30 자동 트리거 등록 확인** — 사용자가 GAS 메뉴 "⏰ 매일 17:30 자동 트리거 등록" 한 번 클릭 후 정상 작동 검증
- **installable onEdit 트리거 등록** — Apps Script 에디터에서 onEdit installable 트리거 추가 (대시보드 정렬 드롭다운 작동)
- **새 *보유현황*의 K/L/M 수식 수동 입력 안내** — 펀드/예금/보험 종목: J(현재단가) + K(평가금액)=G*J, L(손익)=K-I, M(수익률)=IF(I>0,L/I,0) 수식 한 번 입력 후 보존됨
