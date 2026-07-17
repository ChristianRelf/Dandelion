// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

/**
 * Dandelion ESLint flat configuration.
 *
 * We intentionally use the (fast, robust) non-type-checked `recommended` preset
 * so linting never depends on a fully-resolving multi-project type graph. Type
 * safety is enforced separately by `npm run typecheck`.
 */
export default tseslint.config(
  {
    ignores: [
      'out/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      // Agent worktrees are whole checkouts of this repo living inside it. Each
      // brings its own tsconfig, and the type-aware parser refuses to guess
      // between them — so linting the tree would fail on every file, in a
      // checkout that already lints itself.
      '.claude/worktrees/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  // Main + preload run in a Node/Electron context.
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'electron.vite.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Renderer runs in a Chromium/browser context.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-refresh': reactRefresh },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Tests may use dev-only globals and looser typing.
  {
    files: ['tests/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  // Build-time scripts. CommonJS because Electron only supports an ESM main
  // process via a package.json entry, and they report progress to a terminal.
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
);
