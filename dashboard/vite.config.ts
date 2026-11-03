/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://thomascaruso.github.io/consumer-intel-lab/ in production.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/consumer-intel-lab/' : '/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
}))
