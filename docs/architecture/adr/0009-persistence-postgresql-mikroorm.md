# ADR-0009: PostgreSQL with MikroORM

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Persistent data includes floor plans (structured, JSON-heavy), messages (full-text search), roles and
assignments. The domain model must stay free of persistence concerns.

## Decision

- **PostgreSQL** as the only database. Keycloak uses its own database on the same server.
- **MikroORM** (data mapper, unit of work, identity map). Mappings are defined _outside_ domain classes
  (`EntitySchema`), so domain classes stay framework-free.
- Each bounded context owns its tables (one PostgreSQL schema per module). There are no cross-module
  joins or foreign keys.

## Alternatives considered

| Option        | Why not                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| MySQL/MariaDB | Weaker JSON and full-text features                                           |
| Prisma        | Generated types are coupled to the schema, so DDD needs extra mapping layers |
| Drizzle       | More hand-written mapping code                                               |
| TypeORM       | Inconsistent maintenance, typing issues                                      |

## Consequences

- JSONB for floor-plan details, PostgreSQL full-text search for messages in the MVP.
- Module-owned schemas keep a later extraction possible.
