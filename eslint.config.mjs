import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/.next/**',
      'apps/mobile/assets/**',
      'apps/mobile/dist/**',
      'apps/mobile/android/**',
      '**/*.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Generated asset manifests: React Native bundles static images only through require().
    files: ['packages/ui/src/avatar-assets.native.ts', 'packages/ui/src/avatar-assets.web.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    // Crash-class rules: hooks order and keyed lists.
    files: ['**/*.tsx'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '19.2' } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],
    },
  },
);
