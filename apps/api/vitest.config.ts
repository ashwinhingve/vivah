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
  },
});
