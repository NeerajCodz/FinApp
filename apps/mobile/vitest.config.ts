import { defineConfig } from 'vitest/config';

export default defineConfig({
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
