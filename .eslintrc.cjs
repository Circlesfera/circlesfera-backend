/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2023: true,
    jest: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'import', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:security/recommended',
    'prettier'
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json'
      }
    }
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    'import/no-default-export': 'error',
    'import/order': [
      'error',
      {
        groups: [['builtin', 'external'], ['internal'], ['parent', 'sibling', 'index']],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
        pathGroups: [
          {
            pattern: '@{core,modules,infra,interfaces,config,shared,workers}/*',
            group: 'internal'
          }
        ]
      }
    ]
  }
};

