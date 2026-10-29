/**
 * Architecture rules (ADR-0004, ADR-0012, docs/engineering/project-structure.md).
 * Run with `pnpm arch`. CI fails on any violation.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make modules impossible to reason about in isolation.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-do-not-import-apps',
      severity: 'error',
      comment: 'Shared packages must never depend on deployable apps.',
      from: { path: '^packages/' },
      to: { path: ['^apps/', '^@teamtown/(server|web|desktop|website)(/|$)'] },
    },
    {
      name: 'apps-do-not-import-other-apps',
      severity: 'error',
      comment: 'Apps share code only through packages/*.',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/([^/]+)/', pathNot: '^apps/$1/' },
    },
    {
      name: 'framework-free-packages',
      severity: 'error',
      comment: 'kernel, world-core and contracts run on client and server; they must not depend on frameworks.',
      from: { path: '^packages/(kernel|world-core|contracts)/' },
      // Matches resolved (node_modules/...) and unresolved (bare specifier) imports alike.
      to: { path: '(^|node_modules/)(react|react-dom|three|@react-three|@nestjs|@mikro-orm|electron|fastify)(/|$)' },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'Domain layer: pure TypeScript, only packages/kernel (coding guidelines §2).',
      from: { path: '^apps/server/src/modules/[^/]+/domain/' },
      to: {
        path: [
          '(^|node_modules/)(@nestjs|@mikro-orm|fastify|livekit-server-sdk)(/|$)',
          '^apps/server/src/modules/[^/]+/(application|infrastructure|interface)/',
        ],
      },
    },
    {
      name: 'application-depends-on-ports-only',
      severity: 'error',
      comment: 'Use cases depend on ports, never on adapters.',
      from: { path: '^apps/server/src/modules/[^/]+/application/' },
      to: { path: '^apps/server/src/modules/[^/]+/(infrastructure|interface)/' },
    },
    {
      name: 'modules-talk-via-public-api',
      severity: 'error',
      comment: 'Other modules may only import a module through its public-api.ts.',
      from: { path: '^apps/server/src/modules/([^/]+)/' },
      to: {
        path: '^apps/server/src/modules/([^/]+)/',
        pathNot: ['^apps/server/src/modules/$1/', '^apps/server/src/modules/[^/]+/public-api\\.ts$'],
      },
    },
    {
      name: 'presence-is-never-persisted',
      severity: 'error',
      comment: 'ADR-0012: presence data lives in memory only.',
      from: { path: '^apps/server/src/modules/presence/' },
      to: { path: '(^|node_modules/)@mikro-orm(/|$)' },
    },
    {
      name: 'world-renders-state-only',
      severity: 'error',
      comment: 'The R3F world displays store state; it never talks to the realtime connection directly.',
      from: { path: '^apps/web/src/world/' },
      to: { path: '^apps/web/src/(realtime|features)/' },
    },
    {
      name: 'web-features-are-isolated',
      severity: 'error',
      comment: 'Feature slices must not reach into each other.',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: { path: '^apps/web/src/features/([^/]+)/', pathNot: '^apps/web/src/features/$1/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|\\.astro|\\.turbo|coverage)/' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};
