import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      '../../tests/**/*.test.ts',
      '../../tests/**/*.test.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    environment: 'node',
    globals: true,
  },
});
