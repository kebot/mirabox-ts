import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'mirabox-client',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
