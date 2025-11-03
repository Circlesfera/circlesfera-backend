import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^(\.\./.*)\\.js$': '$1',
    '^@core/(.*)\\.js$': '<rootDir>/src/core/$1.ts',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@modules/(.*)\\.js$': '<rootDir>/src/modules/$1.ts',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@infra/(.*)\\.js$': '<rootDir>/src/infra/$1.ts',
    '^@infra/(.*)$': '<rootDir>/src/infra/$1',
    '^@interfaces/(.*)\\.js$': '<rootDir>/src/interfaces/$1.ts',
    '^@interfaces/(.*)$': '<rootDir>/src/interfaces/$1',
    '^@config/(.*)\\.js$': '<rootDir>/src/config/$1.ts',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@shared/(.*)\\.js$': '<rootDir>/src/shared/$1.ts',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@workers/(.*)\\.js$': '<rootDir>/src/workers/$1.ts',
    '^@workers/(.*)$': '<rootDir>/src/workers/$1'
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  reporters: ['default'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: './tsconfig.json'
      }
    ]
  }
};

export default config;

