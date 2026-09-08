import pluginQuery from '@tanstack/eslint-plugin-query'
import { defineConfig } from 'eslint/config'
import expoConfig from 'eslint-config-expo/flat.js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import reactCompiler from 'eslint-plugin-react-compiler'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

export default defineConfig([
  expoConfig,
  ...pluginQuery.configs['flat/recommended'],
  reactCompiler.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
    },
  },
  {
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },
    rules: {
      'import/no-deprecated': 'error',
      'import/no-duplicates': 'error',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native-reanimated',
              importNames: [
                'runOnJS',
                'runOnUI',
                'runOnRuntime',
                'executeOnUIRuntimeSync',
                'createWorkletRuntime',
                'isWorkletFunction',
                'makeShareableCloneRecursive',
              ],
              message:
                'Deprecated in react-native-reanimated v4. Import from react-native-worklets instead (scheduleOnRN, scheduleOnUI, scheduleOnRuntime, runOnUISync, createWorkletRuntime, isWorkletFunction, createSerializable).',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/ios/**',
      '**/android/**',
      'tmp/**',
      '**/.expo/**',
      '**/assets/**',
    ],
  },
])
