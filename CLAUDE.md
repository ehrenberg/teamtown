# CLAUDE.md: TeamTown

TeamTown is an open-source (AGPL-3.0), self-hostable communication platform that replaces Teams/Slack
with a **soft low-poly isometric 3D replica of the real office**: avatars walk around, proximity audio,
room meetings (open/knock/locked), channels and DMs with scoped roles.

**Status: M0 Foundation done** (monorepo, tooling, CI, hello apps, dev stack). Feature work starts with M1.
`docs/` is the source of truth for decisions.

## Golden rules

1. **Never make product, architecture, tech or design decisions on your own.** Decided items are ADRs
   (`docs/architecture/adr/`). Everything undecided is in `docs/product/open-questions.md`. If a task
   depends on an open question, **ask the product owner** (offer options + a recommendation). Mark
   anything you propose as "proposal" in docs.
2. **Privacy is non-negotiable:** presence data (positions, paths, room entries, who-met-whom) is
   **never persisted or logged** (ADR-0012). Reject designs that would need movement history.
3. **Spatial is optional:** every feature needs a non-spatial path (list mode, command palette, keyboard).
4. **Respect module boundaries** (see below). When in doubt, use a domain event instead of a direct call.
5. Docs, code, comments and commits are in **English**. The UI is **English + German** (i18n, no hard-coded strings).
   The product owner converses in German.

## Where things are

| Need                                     | Location                                       |
| ---------------------------------------- | ---------------------------------------------- |
| Docs index                               | `docs/README.md`                               |
| Vision, ideas, MVP, roadmap              | `docs/product/`                                |
| Pending decisions                        | `docs/product/open-questions.md`               |
| Architecture, ADRs                       | `docs/architecture/`, `docs/architecture/adr/` |
| Glossary (ubiquitous language)           | `docs/architecture/domain-model.md` §1         |
| Coding rules, structure, tests, workflow | `docs/engineering/`                            |
| Brand, design system, world art          | `docs/design/`, assets in `design/`            |
| Design tokens (single source)            | `design/tokens/tokens.json`                    |

## Decided stack (see ADRs)

- **Backend:** NestJS modular monolith (DDD + hexagonal) · PostgreSQL + MikroORM · transactional outbox ·
  in-process WebSocket gateway (MessagePack, Zod contracts) · PostgreSQL full-text search · no Redis in the MVP
- **Identity & access:** Keycloak (OIDC; desktop via system browser + `teamtown://` deep link) · scoped RBAC ·
  admins can't read private content · meeting logs are opt-in only
- **Media:** LiveKit (one room per floor for proximity, per meeting room, per direct call)
- **Frontend:** React + React Three Fiber (orthographic iso camera) · Zustand (live state) + TanStack Query (server state) ·
  i18next (EN + DE with "du") · Radix + Tailwind · Lucide icons · Electron desktop (unsigned builds at first)
- **Tooling:** pnpm + Turborepo · dependency-cruiser · Vitest · Testcontainers · Playwright · k6 · Postman CLI (`postman/`)
- **Ops:** Docker Compose with Caddy, file volume (S3 optional), and an always-on observability stack
  (OTel, Prometheus, Loki, Tempo, Grafana) on a netcup VPS (`demo.` / `auth.teamtown.bastianswelt.de`).
  The owner's PHP webhosting serves **static files only** (Astro + Starlight site at `teamtown.bastianswelt.de`).
- **Project:** AGPL-3.0 · GitHub + Actions · DCO sign-off on every commit (`git commit -s`) · no telemetry · Git LFS for `.blend`/`.glb`

## Commands

| Task                                                          | Command                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Install (also downloads Node 24 for this project)             | `pnpm install`, then once `pnpm setup:browsers` (Chromium for website diagrams)              |
| Backing services (Postgres, Keycloak, LiveKit, observability) | `pnpm stack:up` / `pnpm stack:down`                                                          |
| Server + web client in dev mode                               | `pnpm dev` (web on :5173, API on :3000)                                                      |
| Desktop shell / website                                       | `pnpm dev:desktop` / `pnpm dev:website`                                                      |
| Everything CI checks                                          | `pnpm check`                                                                                 |
| Single checks                                                 | `pnpm lint`, `pnpm typecheck`, `pnpm arch`, `pnpm test`, `pnpm build`, `pnpm check:licenses` |
| Tests of one project                                          | `pnpm vitest run --project @teamtown/<name>`                                                 |
| End-to-end and REST contract tests (need stack + `pnpm dev`)  | `pnpm e2e` (Playwright), `pnpm api:test` (Postman CLI, `postman/`)                           |
| Regenerate Tailwind theme after editing tokens                | `pnpm tokens`                                                                                |

Tooling facts (ADR-0028): pnpm 12, Node 24 via `devEngines`, TypeScript 6.0 (not 7), ESLint 9 (not 10),
internal packages ship TS source, relative imports use the `.ts` extension, commits need `git commit -s`.
pnpm only runs dependency install scripts listed under `allowBuilds` in `pnpm-workspace.yaml`.

## Architecture rules (enforced by `pnpm arch`)

```
apps/server/src/modules/<context>/{domain,application,infrastructure,interface}/ + public-api.ts
```

- `domain/`: pure TS. No NestJS, MikroORM or other module imports. Rich aggregates, value objects,
  typed IDs, `Result` for expected failures, an injected `Clock`.
- `application/`: one use case per file. Checks permissions via the `AccessPolicy` port, depends only on ports.
- `infrastructure/`: adapters (MikroORM `EntitySchema` mappings; domain classes stay undecorated).
- `interface/`: controllers and realtime handlers. Validate with Zod from `packages/contracts`, map, call the use case. Nothing else.
- Cross-module access only via `public-api.ts` or domain events. Never touch another module's tables.
- The Presence module has **no persistence adapter**.
- The renderer (`apps/web/src/world/`) displays store state only. No business logic, no socket calls.
- Shared framework-free logic (grid, iso projection, A*) goes in `packages/world-core`.

## Conventions

- Conventional Commits with the context as scope: `feat(meetings): add knock requests`.
- Tests: domain and world-core are test-driven; every bug fix gets a regression test (`docs/engineering/testing-strategy.md`).
- UI: use design tokens only (no raw hex), keyboard-accessible, EN + DE strings, status = colour **and** shape.
- Voice: warm and clear, lightly playful; errors are always plain (`docs/design/brand-guide.md` §6).
- New dependencies must be AGPL-compatible, with the reason stated in the PR.

## Project skills

- `/adr`: record a new architecture decision (only after the owner decided)
- `/feature-spec`: turn a brainstorming idea into a feature spec
- `/new-module`: scaffold a bounded-context module in the server
- `/realtime-message`: add a realtime command or event, contract-first
- `/ui-review`: review UI work against brand, tokens, a11y, i18n and the list-mode principle
