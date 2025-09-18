module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  ignorePatterns: [
    'node_modules/',
    'reports/',
    'dist/',
    'coverage/',
  ],
  overrides: [
    {
      files: ['src/**/*.{js,mjs,jsx,ts,tsx}'],
      rules: {
        'no-ui-literals': 'error',
      },
    },
  ],
};
