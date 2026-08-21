
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  clearMocks: true,
  displayName: 'widgets',
  rootDir: '../',
  roots: ['<rootDir>/actions'],
  testMatch: ['**/*.widget.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/actions/jest.widget.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/actions/tsconfig.widget.test.json',
        isolatedModules: true,
      },
    ],
  },
};
