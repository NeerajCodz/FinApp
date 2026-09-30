import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

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
    include: [
      '../../tests/**/*.test.ts',
      '../../tests/**/*.test.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    exclude: ['../../tests/web/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
});
