module.exports = {
  env: {
    es2021: true,
    node: true,
    browser: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 13,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-var-requires': 'off',
  },
};
