import typescript from '@tada5hi/eslint-config-typescript';

export default [
    { ignores: ['**/dist/**'] },
    ...await typescript(),
    {
        rules: {
            '@stylistic/object-curly-spacing': 'off', // maintainer: declined 2026-10-28
            '@stylistic/exp-list-style': 'off', // maintainer: declined 2026-10-28
            '@stylistic/comma-dangle': 'off', // maintainer: declined 2026-10-28
            '@stylistic/object-curly-newline': 'off', // maintainer: declined 2026-10-28
            'unicorn/prefer-optional-catch-binding': 'off', // maintainer: declined 2026-10-28
            '@typescript-eslint/no-unused-vars': 'off', // maintainer: declined 2026-10-28
            'class-methods-use-this': 'off',
            'dot-notation': 'off',
            'no-use-before-define': 'off',
            'no-underscore-dangle': 'off',
            'no-shadow': 'off',
            'no-constant-condition': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-this-alias': 'off',
        },
    },
];
