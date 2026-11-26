import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@convex\//,
        replacement: fileURLToPath(new URL('../../convex/', import.meta.url)),
      },
      {
        find: /^@finapp\/widgets$/,
        replacement: fileURLToPath(new URL('../../packages/widgets/src/index.ts', import.meta.url)),
      },
      {
        find: /^@finapp\/mcp\/(.*)$/,
        replacement: fileURLToPath(new URL('../../packages/mcp/src/$1', import.meta.url)),
      },
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL('./', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['../../tests/web/**/*.test.ts', '../../tests/widgets/**/*.test.ts'],
    setupFiles: ['../../tests/web/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
