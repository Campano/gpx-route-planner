import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.js'],
    globals: true,
    include: ['src/**/*.test.{js,jsx}']
  }
})

