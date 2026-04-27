---
name: XcodeGen 재생성 시 서명 설정 확인
description: XcodeGen으로 pbxproj 재생성 전 project.yml에 서명 설정이 명시되어 있는지 확인
type: feedback
originSessionId: 5d1784ea-2c78-47eb-81e3-4749bb2c0694
---
XcodeGen(`xcodegen generate`)으로 project.pbxproj를 재생성하기 전에, project.yml에 아래 서명 설정이 명시되어 있는지 반드시 확인한다:
- `CODE_SIGN_STYLE: Automatic`
- `CODE_SIGN_IDENTITY: "Apple Development"`
- `DEVELOPMENT_TEAM: [팀 ID]`

**Why:** XcodeGen은 project.yml에 없는 설정을 pbxproj에서 삭제함. `CODE_SIGN_STYLE = Automatic`이 누락되면 Xcode 디버거 실행은 되지만 iOS 콜드 런치에서 서명 검증 실패 (2026-04-27 발생, 내 실수)

**How to apply:** `xcodegen generate` 호출 전 project.yml의 settings.base 섹션 확인. 현재 이 프로젝트의 팀 ID는 `3N9UDPW4BP` (junspad2@gmail.com)
