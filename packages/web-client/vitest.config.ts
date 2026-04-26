import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const root = path.resolve(__dirname)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
    },
  },
  test: {
    name: 'web-client',
    root,
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
