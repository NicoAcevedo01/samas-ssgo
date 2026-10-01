import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base = nombre del repo en GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: '/samas-ssgo/',
})
