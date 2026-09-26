import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['../../tests/web/**/*.test.ts'],
    setupFiles: ['../../tests/web/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
