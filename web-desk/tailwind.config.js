/** @type {import('tailwindcss').Config} */
// 색·크기는 CSS 변수(src/index.css 테마 블록)에서 공급 — 테마 전환은 <html data-theme>.
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: c('bg'),
          elev: c('bg-elev'),
          hover: c('bg-hover'),
          deep: c('bg-deep'),
          line: c('bg-line'),
        },
        line: {
          DEFAULT: c('line'),
          bright: c('line-bright'),
          dim: c('line-dim'),
        },
        ink: {
          DEFAULT: c('ink'),
          dim: c('ink-dim'),
          faint: c('ink-faint'),
          bright: c('ink-bright'),
        },
        amber: c('amber'),
        cyan: c('cyan'),
        gain: c('gain'),
        loss: c('loss'),
        warn: c('warn'),
      },
      fontFamily: {
        mono: ['var(--font-num)'],
        display: ['"Monoton"', 'monospace'],
      },
      fontSize: {
        '2xs': 'var(--fs-2xs)',
        xxs: 'var(--fs-xxs)',
        xs: 'var(--fs-xs)',
      },
      letterSpacing: {
        widest2: '0.18em',
        widest3: '0.22em',
      },
      animation: {
        pulse: 'pulseOpacity 1.4s infinite',
        blink: 'blink 1s step-end infinite',
        scroll: 'scroll 60s linear infinite',
      },
      keyframes: {
        pulseOpacity: { '50%': { opacity: 0.4 } },
        blink: { '50%': { opacity: 0 } },
        scroll: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
}
