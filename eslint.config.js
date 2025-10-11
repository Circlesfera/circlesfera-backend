export default [
  // Configuración global para todos los archivos JS
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
        // ES modules
        import: 'readonly',
        // Timers
        setTimeout: 'readonly',
        setInterval: 'readonly',
        setImmediate: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        clearImmediate: 'readonly'
      }
    },
    rules: {
      // === Estilo de código (mantener estándares del proyecto) ===
      'semi': ['error', 'never'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'block-spacing': ['error', 'always'],
      'comma-spacing': ['error', { before: false, after: true }],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'space-before-blocks': ['error', 'always'],
      'space-before-function-paren': ['error', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
      'space-infix-ops': 'error',

      // === Variables ===
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-const-assign': 'error',
      'no-undef': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true }],

      // === Mejores prácticas ===
      'no-console': 'off', // Permitido en backend
      'no-debugger': 'warn',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-with': 'error',
      'no-throw-literal': 'error',
      'no-return-await': 'error',
      'require-await': 'warn',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      'prefer-promise-reject-errors': 'error',

      // === Estructuras de control ===
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-lonely-if': 'error',
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'error',

      // === Funciones ===
      'arrow-body-style': ['error', 'as-needed'],
      'prefer-arrow-callback': 'error',
      'func-style': ['error', 'expression', { allowArrowFunctions: true }],
      'no-param-reassign': ['error', { props: false }],

      // === Objetos y Arrays ===
      'object-shorthand': ['error', 'always'],
      'prefer-destructuring': ['error', {
        array: false,
        object: true
      }, {
          enforceForRenamedProperties: false
        }],
      'prefer-spread': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': ['error', 'never'],

      // === Imports/Exports ===
      'no-duplicate-imports': 'error',
      'sort-imports': ['error', {
        ignoreCase: true,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false
      }],

      // === Seguridad ===
      'no-new-func': 'error',
      'no-new-object': 'error',
      'no-new-wrappers': 'error',
      'no-script-url': 'error',

      // === Errores potenciales ===
      'no-await-in-loop': 'warn',
      'no-constant-condition': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty-character-class': 'error',
      'no-ex-assign': 'error',
      'no-extra-boolean-cast': 'error',
      'no-func-assign': 'error',
      'no-inner-declarations': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-obj-calls': 'error',
      'no-sparse-arrays': 'error',
      'no-unreachable': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error'
    }
  },

  // Configuración específica para archivos de test
  {
    files: ['**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      // Reglas más flexibles para tests
      'no-unused-expressions': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'prefer-arrow-callback': 'off'
    }
  },

  // Archivos a ignorar
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/uploads/**',
      '**/logs/**',
      '**/*.min.js',
      '**/public/**',
      '**/.next/**',
      '**/out/**',
      '**/server.log',
      '**/*.config.js' // Archivos de configuración pueden tener su propio estilo
    ]
  }
]
