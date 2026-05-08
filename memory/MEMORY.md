# Memory Index

- [Model routing](feedback_model_routing.md) — 복잡한 작업은 Opus 4.7, 단순 작업은 Sonnet으로 처리
- [GAS Secret.js 금지](feedback_gas_secret.md) — GAS 배포 시 Secret.js 절대 수정/재전송 금지
- [프로젝트 개요](project_overview.md) — FD5to6 전체 구조, GAS/iOS 파트, 주요 파일 위치
- [iOS UI 현황](project_ios_ui.md) — 대시보드/종목/탭 현재 UI 상태 및 디자인 결정사항
- [계획 변경 시 승인 필수](feedback_approval_required.md) — 기능 삭제·구조 변경 등 큰 변경은 먼저 승인받고 진행
- [저장! 명령어](feedback_save_command.md) — "저장!" = 중간 저장 + 동기화 한 번에 실행
- [번들 ID 변경 시 구 앱 삭제](feedback_bundle_id_change.md) — 번들 ID 변경 시 빌드 전에 기기에서 구 앱 삭제 안내 필수
- [XcodeGen 재생성 시 서명 설정](feedback_xcodegen_signing.md) — xcodegen 전 project.yml에 CODE_SIGN_STYLE 등 서명 설정 명시 확인
- [옵션 먼저 설명](feedback_options_first.md) — 설정/방법 제안 시 선택지와 trade-off 먼저 설명, 결정은 사용자에게
- [작업 전 승인 필수](feedback_confirm_before_action.md) — 방향 설명 → 상의 → 승인 후 진행. 제약 감안해서 먼저 물어볼 것
- [할 수 있는 건 바로 실행](feedback_just_do_it.md) — 배포·커밋 등 직접 실행 가능한 작업은 사용자에게 넘기지 않고 바로 한다
- [GAS 에디터 직접 실행 시 getUi() 금지](feedback_gas_editor_ui.md) — setup/trigger 등록 함수에서 getUi().alert() 쓰면 에디터에서 멈춤, Logger.log() 사용
- [존댓말 사용 필수](feedback_speech_level.md) — 모든 한국어 대화에서 예외 없이 존댓말 사용
- [함수 실행 안내 시 파일명 포함](feedback_function_file.md) — 함수 실행 안내 시 항상 GAS 파일명 함께 명시
