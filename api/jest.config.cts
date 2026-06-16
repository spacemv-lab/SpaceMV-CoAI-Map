module.exports = {
  displayName: 'map-ai-api',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@txwx-monorepo/api-client$': '<rootDir>/../packages/api-client/src/index.ts',
    '^@txwx-monorepo/chat-contracts$': '<rootDir>/../packages/chat-contracts/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../coverage/api',
};
