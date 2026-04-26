import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/mirabox-client',
      'packages/web-client',
    ],
  },
})
