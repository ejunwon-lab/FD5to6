/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0d12',
          elev: '#11151c',
          hover: '#161b24',
          deep: '#06090e',
          line: '#0d1218',
        },
        line: {
          DEFAULT: '#1f2630',
          bright: '#2d3748',
          dim: '#161b24',
        },
        ink: {
          DEFAULT: '#d4d8e0',
          dim: '#6b7280',
          faint: '#4a5568',
          bright: '#ffffff',
        },
        amber: '#ffa500',
        cyan: '#00d4ff',
        gain: '#00ff7f',
        loss: '#ff3366',
        warn: '#ffcc00',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Monoton"', 'monospace'],
      },
      fontSize: {
        '2xs': '10px',
        xxs: '11px',
        xs: '12px',
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
