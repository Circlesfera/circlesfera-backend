import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@core/(.*)\\.js$': '<rootDir>/src/core/$1',
    '^@modules/(.*)\\.js$': '<rootDir>/src/modules/$1',
    '^@infra/(.*)\\.js$': '<rootDir>/src/infra/$1',
    '^@interfaces/(.*)\\.js$': '<rootDir>/src/interfaces/$1',
    '^@config/(.*)\\.js$': '<rootDir>/src/config/$1',
    '^@shared/(.*)\\.js$': '<rootDir>/src/shared/$1',
    '^@workers/(.*)\\.js$': '<rootDir>/src/workers/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@infra/(.*)$': '<rootDir>/src/infra/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@workers/(.*)$': '<rootDir>/src/workers/$1'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json',
      diagnostics: {
        ignoreCodes: [151002]
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@jest/globals))'
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  reporters: ['default'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};

export default config;

