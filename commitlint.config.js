/**
 * Conventional Commits with the bounded context or package as scope, e.g. `feat(meetings): add knock requests`.
 * Every commit must carry a DCO sign-off (`git commit -s`), see CONTRIBUTING.md.
 * @type {import('@commitlint/types').UserConfig}
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'signed-off-by': [2, 'always', 'Signed-off-by:'],
  },
};
