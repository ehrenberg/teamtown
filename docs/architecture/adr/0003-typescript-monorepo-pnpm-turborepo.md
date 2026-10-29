# ADR-0003: TypeScript monorepo with pnpm and Turborepo

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Client (web and desktop) and server share types, realtime contracts and world maths (grid, pathfinding).
Contributors should find everything in one place.

## Decision

- **TypeScript** (strict mode) for all apps and packages; backend on **NestJS**.
- **pnpm workspaces** for dependencies, **Turborepo** for task orchestration and caching.
- Layout: `apps/*` (deployables) and `packages/*` (shared libraries), see
  [project-structure.md](../../engineering/project-structure.md).

## Alternatives considered

| Option | Why not |
|--------|---------|
| Nx | More opinionated, steeper learning curve |
| Plain pnpm workspaces | No task caching or orchestration |
| Go / .NET / PHP backend | No type sharing with the frontend; PHP is weak for persistent WebSockets |

## Consequences

- Module boundaries are enforced with ESLint rules instead of Nx tags.
- CI builds and tests only affected packages (Turborepo filtering).
