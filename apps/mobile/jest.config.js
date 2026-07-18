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
 */
module.exports = {
  preset: 'jest-expo/ios',
  setupFiles: [...(require('jest-expo/ios/jest-preset').setupFiles ?? []), '<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{js,ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/'],
};
