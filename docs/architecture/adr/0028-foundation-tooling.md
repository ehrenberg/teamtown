# ADR-0028: Foundation tooling (milestone M0)

- **Status:** Accepted
- **Date:** 2026-10-30
- **Deciders:** Product owner

## Context

Milestone M0 turns the decided stack (ADR-0003, ADR-0015, ADR-0021) into a working monorepo. Several
tooling details were still open, and some of the newest tool versions turned out to be incompatible with each other.

## Decision

| Topic              | Decision                                                                                                                               | Notes                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Node.js            | **Node 24 LTS**, provided **per project** by pnpm (`devEngines.runtime`, `onFail: download`)                                           | The system Node version is not touched                                                                                           |
| Package manager    | **pnpm 12** (`packageManager` field)                                                                                                   |                                                                                                                                  |
| Package scope      | **`@teamtown/*`**                                                                                                                      |                                                                                                                                  |
| TypeScript         | **6.0.x**                                                                                                                              | TypeScript 7 (native compiler) has no JS API yet; typescript-eslint supports TS < 6.1. Revisit when the ecosystem supports TS 7. |
| Lint & format      | **ESLint 9 + Prettier**, typed rules (`strictTypeChecked`), react-hooks, jsx-a11y (strict)                                             | ESLint 10 is not yet supported by eslint-plugin-jsx-a11y                                                                         |
| Internal packages  | **Ship TypeScript source** (`exports` → `src/index.ts`); consumers compile them                                                        | Nothing is published to npm                                                                                                      |
| App bundling       | Server and desktop are bundled with **tsup** (SWC for NestJS decorator metadata); web with **Vite**; website with **Astro**            | Internal packages are bundled into the server (`noExternal`)                                                                     |
| Import style       | Relative imports include the `.ts` extension (`allowImportingTsExtensions`)                                                            | Works with Vite, tsup, Vitest and Node type stripping                                                                            |
| HTTP adapter       | **Fastify** for NestJS                                                                                                                 |                                                                                                                                  |
| Git hooks          | **lefthook** (format + lint staged files) and **commitlint** (Conventional Commits + DCO sign-off)                                     | CI runs the same checks                                                                                                          |
| Dependency updates | **Dependabot** (npm, GitHub Actions, Docker Compose) with grouped updates                                                              | TypeScript, ESLint and `@types/node` majors are held back on purpose (see above)                                                 |
| Install scripts    | pnpm blocks dependency install scripts; only `allowBuilds` entries may run (`@swc/core`, `electron`, `esbuild`, `lefthook`)            | Supply-chain hardening                                                                                                           |
| Fonts              | Self-hosted via Fontsource (Inter, Outfit), no Google Fonts requests                                                                   | Privacy                                                                                                                          |
| Licence check      | `pnpm check:licenses` allows only AGPL-compatible licences; exceptions need a documented decision in `scripts/license-exceptions.json` |                                                                                                                                  |

## Consequences

- `pnpm install` is the only setup step for Node: contributors don't need a Node version manager.
- Two deliberate version holds (TypeScript, ESLint) are encoded in `dependabot.yml` and must be revisited.
- `pnpm check` runs everything CI runs: format, lint, types, architecture, tokens, tests, licences.
