import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Point workspace packages to their source so tests run without a build step.
      '@smartshaadi/types':   resolve(__dirname, '../../packages/types/src/index.ts'),
      '@smartshaadi/schemas': resolve(__dirname, '../../packages/schemas/src/index.ts'),
      '@smartshaadi/db':      resolve(__dirname, '../../packages/db/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/vitest.setup.ts',
        'src/index.ts',
      ],
      // Acceptance criteria from stabilization plan §3.2 / §4.1
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
    },
  },
});
