import { useState } from 'react'
import { Panel } from '../ui/Panel'
import {
  applyTheme, DEFAULT_SETTINGS, loadSettings, saveSettings,
  type CardFoldDefault, type DeskSettings, type DeskTheme, type HoldingsViewMode,
} from '../../lib/settings'

// Settings (단축키 S) — 데스크 로컬 설정. 저장 즉시 localStorage 반영, 각 화면은 재진입 시 적용.
export function SettingsPage() {
  const [settings, setSettings] = useState<DeskSettings>(() => loadSettings())
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const update = (patch: Partial<DeskSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    if (patch.theme) applyTheme(patch.theme)
    setSavedAt(new Date().toLocaleTimeString('ko-KR'))
  }

  return (
    <main className="overflow-y-auto p-2 sm:p-3 grid gap-2.5 grid-cols-1 lg:grid-cols-2" style={{ gridAutoRows: 'min-content' }}>
      <div className="lg:col-span-2 text-2xs text-ink-faint uppercase tracking-widest">
        {savedAt ? `저장됨 · ${savedAt} — 화면 재진입 시 적용` : '변경 즉시 저장 · 화면 재진입 시 적용'}
      </div>

      <Panel title="테마" meta="즉시 반영">
        <div className="p-4 space-y-4">
          <SettingRow label="화면 테마" desc="Modern: 가독성 개선(Pretendard·소프트 팔레트) / Terminal: 네온 원형">
            <OptionGroup<DeskTheme>
              value={settings.theme}
              options={[
                { value: 'modern', label: 'Modern' },
                { value: 'terminal', label: 'Terminal' },
              ]}
              onChange={(v) => update({ theme: v })}
            />
          </SettingRow>
        </div>
      </Panel>

      <Panel title="Holdings 기본 뷰" meta="Dashboard·Holdings 탭">
        <div className="p-4 space-y-4">
          <SettingRow label="뷰 모드" desc="홀딩스 목록의 기본 표시 형태">
            <OptionGroup<HoldingsViewMode>
              value={settings.holdingsViewMode}
              options={[
                { value: 'card-web', label: '▤ Web 카드' },
                { value: 'card-terminal', label: '▦ Terminal 카드' },
                { value: 'list', label: '☰ List' },
              ]}
              onChange={(v) => update({ holdingsViewMode: v })}
            />
          </SettingRow>
          <SettingRow label="기본 표시 종목 수" desc="상위 N종목만 표시 후 '전체 보기' (0 = 항상 전체)">
            <OptionGroup<number>
              value={settings.holdingsInitialVisible}
              options={[
                { value: 6, label: '6' },
                { value: 9, label: '9' },
                { value: 12, label: '12' },
                { value: 0, label: '전체' },
              ]}
              onChange={(v) => update({ holdingsInitialVisible: v })}
            />
          </SettingRow>
          <SettingRow label="카드 접기 기본값" desc="auto = 모바일 접힘 / 데스크톱 펼침">
            <OptionGroup<CardFoldDefault>
              value={settings.cardFoldDefault}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'folded', label: '항상 접힘' },
                { value: 'unfolded', label: '항상 펼침' },
              ]}
              onChange={(v) => update({ cardFoldDefault: v })}
            />
          </SettingRow>
        </div>
      </Panel>

      <Panel title="관리" meta="local">
        <div className="p-4 space-y-3">
          <p className="text-xs text-ink-dim">
            설정은 이 브라우저에만 저장됩니다 (localStorage). 서버·시트에는 아무것도 기록하지 않습니다.
          </p>
          <button
            onClick={() => { update({ ...DEFAULT_SETTINGS }) }}
            className="border border-line px-3 py-1 text-xs uppercase tracking-widest text-ink-dim hover:border-amber hover:text-amber"
          >
            기본값 복원
          </button>
        </div>
      </Panel>
    </main>
  )
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5">
        <span className="text-xs text-ink font-medium">{label}</span>
        <span className="ml-2 text-2xs text-ink-faint">{desc}</span>
      </div>
      {children}
    </div>
  )
}

function OptionGroup<T extends string | number>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex border border-line flex-wrap">
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 lg:py-1 text-2xs uppercase tracking-widest ${i > 0 ? 'border-l border-line' : ''} ${
            value === o.value ? 'bg-amber text-bg' : 'text-ink-dim hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
