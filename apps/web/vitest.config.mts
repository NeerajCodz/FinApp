import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@convex\//,
        replacement: fileURLToPath(new URL('../../convex/', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['../../tests/web/**/*.test.ts'],
    setupFiles: ['../../tests/web/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
