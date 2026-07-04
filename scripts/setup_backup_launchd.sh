#!/bin/bash
# 시트 백업 launchd 등록 — 맥마다 1회 실행: bash scripts/setup_backup_launchd.sh
# 매주 일 21:00 scripts/backup_sheets.py 실행 → backups/ (repo 미적재)
# 경로·python은 실행 시점 머신 기준으로 채움 (halcyon / halcyon_m1 등 사용자명 무관)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$(command -v python3)"
LABEL="com.fd5to6.sheet-backup"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/backups"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PY}</string>
    <string>${ROOT}/scripts/backup_sheets.py</string>
  </array>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>21</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>${ROOT}/backups/backup.log</string>
  <key>StandardErrorPath</key><string>${ROOT}/backups/backup.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "✓ launchd 등록: 매주 일 21:00 → ${ROOT}/backups/"

# 전제조건 점검 (없으면 첫 실행이 실패하므로 미리 경고)
"$PY" -c "import requests" 2>/dev/null || echo "⚠ requests 없음 → ${PY} -m pip install requests --break-system-packages"
[ -f "$ROOT/.env" ] || echo "⚠ .env 없음 (TG_WEBHOOK_SECRET=... 1줄 필요 — gitignore라 맥마다 수동 생성)"
[ -f "$HOME/.clasprc.json" ] || echo "⚠ ~/.clasprc.json 없음 → npx clasp login 1회 필요"
echo "지금 1회 검증: launchctl kickstart gui/$(id -u)/${LABEL} && tail -1 '${ROOT}/backups/backup.log'"
