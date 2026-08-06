// 데스크 로컬 설정 (localStorage) — Settings 페이지에서 편집, 각 컴포넌트는 마운트 시 읽음.
// 탭 전환 = 컴포넌트 재마운트라 즉시 반영엔 이벤트가 필요 없다 (2026-07-23).

export type HoldingsViewMode = 'card-web' | 'card-terminal' | 'list'
export type DeskTheme = 'modern' | 'terminal'

export interface DeskSettings {
  holdingsViewMode: HoldingsViewMode
  /** Dashboard 홀딩스 기본 표시 종목 수 (0 = 전체 펼침) */
  holdingsInitialVisible: number
  /** modern: Pretendard+소프트 팔레트 / terminal: Bloomberg 네온 원형 */
  theme: DeskTheme
}

const KEY = 'desk_settings_v1'

// 카드 폴드는 기기 불문 항상 접힘 시작(2026-08-06) — cardFoldDefault 옵션 제거됨
export const DEFAULT_SETTINGS: DeskSettings = {
  holdingsViewMode: 'card-web',
  holdingsInitialVisible: 9,
  theme: 'modern',
}

export function loadSettings(): DeskSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<DeskSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: DeskSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // localStorage 불가(사파리 프라이빗 등) — 세션 한정 무저장으로 동작
  }
}

/** <html data-theme> 스탬프 — CSS 변수 캐스케이드라 리마운트 없이 즉시 반영 */
export function applyTheme(theme: DeskTheme): void {
  document.documentElement.dataset.theme = theme
}
