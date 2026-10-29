---
name: new-module
description: Scaffold a new bounded-context module in apps/server following TeamTown's hexagonal/DDD layout (domain, application, infrastructure, interface, public-api). Use when starting implementation of a context like messaging, world, presence, meetings or access.
---

# Scaffold a bounded-context module

Prerequisite: the context exists in `docs/architecture/domain-model.md`. A **new** context (not listed
there) is an architecture change, so ask the product owner and record an ADR first (`/adr`).

## Target layout

```
apps/server/src/modules/<context>/
├── domain/
│   ├── <aggregate>.ts            aggregate root: private constructor, static create()/rehydrate(), behaviour methods
│   ├── <value-object>.ts         immutable, validated in a factory returning Result
│   ├── <context>-ids.ts          typed IDs (branded types from packages/kernel)
│   ├── events.ts                 domain events (past tense) + union type
│   └── errors.ts                 domain error codes (string literal union)
├── application/
│   ├── ports/                    repository + external service interfaces
│   ├── commands/<verb-noun>.command.ts   one use case per file
│   └── queries/<noun>.query.ts
├── infrastructure/
│   └── persistence/              MikroORM EntitySchema mappings + repository adapters
├── interface/
│   ├── http/<context>.controller.ts
│   └── realtime/<context>.handlers.ts   (only if needed)
├── <context>.module.ts           NestJS wiring
└── public-api.ts                 the ONLY file other modules may import
```

## Rules to apply while scaffolding

- `domain/` imports nothing but `packages/kernel`. No NestJS decorators, no MikroORM.
- Use cases: load → `AccessPolicy.can(...)` → domain behaviour → save → publish recorded events.
- Every aggregate gets a test file next to it (`*.spec.ts`) with at least one invariant test. Write the
  tests first for new behaviour.
- Database: the module owns its own PostgreSQL schema (`<context>`). No foreign keys to other modules.
- **Presence** (and anything in-memory by design) gets **no** persistence adapter (ADR-0012).
- Register the module's boundary in the architecture-test configuration.
- Export from `public-api.ts`: the facade interface, event types and ID types. Never export entities or repositories.

## After scaffolding

- Add the module's events to the catalogue in `docs/architecture/domain-model.md` §5 if new.
- Run lint, typecheck and tests. Fix boundary violations rather than suppressing them.
