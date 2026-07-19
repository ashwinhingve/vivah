/**
 * Jest configuration for the Expo mobile app.
 * jest-expo preset + React Native Testing Library for component tests,
 * plus plain unit tests for validation schemas.
 */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx,js}'],
  // pnpm resolves packages through node_modules/.pnpm/<name+scope@version>/,
  // so the allowlist matches the pnpm-encoded names (scope "/" becomes "+").
  transformIgnorePatterns: [
    'node_modules/\\.pnpm/(?!(react-native|@react-native\\+|@react-native-community\\+|expo|@expo\\+|@expo-google-fonts\\+|@testing-library\\+|react-navigation|@react-navigation\\+|nativewind|@smartshaadi\\+|zod|better-auth|@better-auth\\+))',
  ],
};
