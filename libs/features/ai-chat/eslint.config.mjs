import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['web/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@map-ai/features/ai-chat/*'],
              message: 'Use relative imports inside ai-chat',
            },
            {
              group: ['**/server/**'],
              message: 'Web code must not import server code',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@map-ai/features/ai-chat/*'],
              message: 'Use relative imports inside ai-chat',
            },
            {
              group: ['**/web/**'],
              message: 'Server code must not import web code',
            },
          ],
        },
      ],
    },
  },
];
