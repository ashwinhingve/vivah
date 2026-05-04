import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/migrations/**',
      '**/.next/**',
      '**/coverage/**',
    ],
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      // <img> is intentional in places where next/image is unsuitable
      // (blob: previews, simple thumbnails). Downgrade to warning.
      '@next/next/no-img-element': 'warn',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Core TypeScript rules matching project conventions
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // Relax rules in test files
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    // Brand-token guardrail — only enforced inside the web app's source.
    // Ban raw Tailwind color classes and raw hex literals in JSX, so that
    // tokens defined in apps/web/src/app/globals.css remain the single
    // source of truth for color. New screens stay on-brand by default.
    files: ['apps/web/src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Raw Tailwind color classes inside className strings.
          // Allowed: bg-surface, bg-secondary, bg-background, bg-card,
          //          bg-primary, bg-teal, bg-gold, bg-success, bg-warning,
          //          bg-destructive, bg-foreground, bg-muted, bg-border,
          //          bg-accent, bg-popover, bg-input, bg-ring,
          //          and the same prefixes for text-/border-.
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\b(?:bg|text|border)-(?:gray-\\d|slate-\\d|zinc-\\d|neutral-\\d|stone-\\d|red-\\d|orange-\\d|amber-\\d|yellow-\\d|lime-\\d|green-\\d|emerald-\\d|teal-(?:50|100|200|300|400|500|600|700|800|900)|cyan-\\d|sky-\\d|blue-\\d|indigo-\\d|violet-\\d|purple-\\d|fuchsia-\\d|pink-\\d|rose-\\d)/]",
          message:
            'Use brand tokens (bg-surface, text-muted-foreground, text-teal, text-success, text-destructive, text-warning, border-gold, etc.) instead of raw Tailwind color classes. See apps/web/src/app/globals.css for the full token list.',
        },
        {
          // Tailwind JIT arbitrary hex value inside className: bg-[#7B2D42], etc.
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(?:bg|text|border)-\\[#[0-9A-Fa-f]{3,8}\\]/]",
          message:
            'Use brand tokens instead of arbitrary hex color classes (e.g. bg-[#7B2D42] → bg-primary).',
        },
        {
          // Raw hex string literals inside style={{ … }} object expressions.
          selector:
            "JSXAttribute[name.name='style'] Property[key.name=/^(?:color|background|backgroundColor|borderColor|fill|stroke)$/] Literal[value=/^#[0-9A-Fa-f]{3,8}$/]",
          message:
            'Use brand-token className instead of raw hex in inline style (e.g. style={{ color: \"#7B2D42\" }} → className=\"text-primary\").',
        },
      ],
    },
  },
];
