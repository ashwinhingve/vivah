/**
 * Jest configuration for the React Native / Expo app.
 *
 * Uses the `jest-expo` preset as-is. Do NOT override `transformIgnorePatterns`
 * here: the preset's own setup files (@react-native/js-polyfills, and the RN
 * jest-preset setup) ship as ESM and must themselves be transformed, so any
 * hand-written replacement pattern that forgets one of them breaks every suite
 * with "Cannot use import statement outside a module" before a single test runs.
 *
 * Pinned to the ios platform variant. The bare `jest-expo` preset runs each
 * suite once per platform (ios/android/web), which triples the reported test
 * count for no added signal on logic-level unit tests — and an inflated count
 * is exactly the kind of number that hides a regression.
 *
 * Two setup stages, because they run at different times and need to:
 *   setupFiles        — jest.setup.js sets IS_REACT_ACT_ENVIRONMENT before the
 *                       React runtime is initialised (see that file).
 *   setupFilesAfterEnv — jest.setup.ts registers jest.mock() factories, which
 *                       require the jest object to already exist.
 */
module.exports = {
  preset: 'jest-expo/ios',
  // Each jest-expo worker loads the whole RN module graph, so one worker per
  // core thrashes: the full suite took 53s and six React-Query screens blew the
  // 5s timeout purely from CPU starvation — every one of them passes in ~0.6s
  // on its own. Capped, the same suite runs in ~5s. A timeout that only appears
  // under parallelism is a scheduling artifact, not a failing test, and it is
  // not worth the hours it costs to re-diagnose next time.
  maxWorkers: 2,
  setupFiles: [...(require('jest-expo/ios/jest-preset').setupFiles ?? []), '<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{js,ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/'],
};
