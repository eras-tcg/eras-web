// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const boundaries = require('eslint-plugin-boundaries');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'eras',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'eras',
          style: 'kebab-case',
        },
      ],
    },
  },
  // Components that style native elements (`button[erasButton]`) use attribute selectors.
  {
    files: [
      'src/app/ui/primitives/button/*.ts',
      'src/app/ui/primitives/chip/*.ts',
      'src/app/ui/primitives/icon-button/*.ts',
      'src/app/features/simulator/board/sidebar-item.component.ts',
    ],
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'attribute', prefix: 'eras', style: 'camelCase' }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  // Layer boundaries (ver PLAN_MIGRACION_FRONT_ANGULAR.md 2.1):
  // features -> data-access -> core, features -> ui -> core; ui y data-access nunca importan features; ui nunca importa data-access.
  {
    files: ['src/app/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: 'tsconfig.app.json' },
      },
      'boundaries/elements': [
        { type: 'core', pattern: 'src/app/core/**/*' },
        { type: 'data-access', pattern: 'src/app/data-access/**/*' },
        { type: 'ui', pattern: 'src/app/ui/**/*' },
        { type: 'features', pattern: 'src/app/features/**/*' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { from: { element: { type: 'core' } }, allow: [{ to: { element: { type: 'core' } } }, { to: { element: { type: 'ui' } } }] },
            { from: { element: { type: 'ui' } }, allow: [{ to: { element: { type: 'core' } } }, { to: { element: { type: 'ui' } } }] },
            { from: { element: { type: 'data-access' } }, allow: [{ to: { element: { type: 'core' } } }, { to: { element: { type: 'data-access' } } }] },
            { from: { element: { type: 'features' } }, allow: [{ to: { element: { type: 'core' } } }, { to: { element: { type: 'ui' } } }, { to: { element: { type: 'data-access' } } }, { to: { element: { type: 'features' } } }] },
          ],
        },
      ],
    },
  },
]);
