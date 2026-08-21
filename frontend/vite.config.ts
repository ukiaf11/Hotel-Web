import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `VITE_BASE` lets the same build target a sub-path host (GitHub Pages serves the
// app from /<repo>/) as well as a root-domain host such as Vercel.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
