/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  clearMocks: true,
  displayName: 'lib',
  // A plain Node environment (no jsdom): proves lib/ is pure and framework-free.
  testEnvironment: 'node',
  rootDir: '../',
  roots: ['<rootDir>/lib'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/lib/tsconfig.lib.json',
      },
    ],
  },
};
