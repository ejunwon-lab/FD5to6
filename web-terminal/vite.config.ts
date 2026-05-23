import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://ejunwon-lab.github.io/FD5to6/terminal/
export default defineConfig({
  plugins: [react()],
  base: '/FD5to6/terminal/',
})
