module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // Desactivar reglas problemáticas con false positives
    'require-atomic-updates': 'off', // Muchos falsos positivos en Express middleware
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }], // Permitir algunos console en scripts
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] // Permitir variables con prefijo _
  },
  overrides: [
    {
      files: ['**/*.test.js', '__tests__/**/*.js', 'scripts/**/*.js'],
      rules: {
        'no-console': 'off', // Permitir console en tests y scripts
        'no-undef': 'off' // Jest globals
      }
    }
  ]
}
