/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        profit:  '#D91919',
        loss:    '#0D5AD9',
        accent:  '#405AE6',
        'card-bg':  'rgb(var(--card-bg) / <alpha-value>)',
        'page-bg':  'rgb(var(--page-bg) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
