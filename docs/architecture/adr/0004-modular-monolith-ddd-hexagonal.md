# ADR-0004: Modular monolith with DDD and hexagonal architecture

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

The domain has several distinct areas (world, presence, meetings, messaging, access). The product is
self-hosted, so operational simplicity matters. Maintainability for many contributors is a top quality goal.

## Decision

- The backend is **one deployable** (NestJS) organised into **bounded-context modules**.
- Each module follows **hexagonal architecture**: `domain` (pure TypeScript, no framework) →
  `application` (use cases, ports) → `infrastructure` (driven adapters: DB, LiveKit, …) and
  `interface` (driving adapters: REST controllers, realtime handlers).
- Modules communicate only through their **public API** (`public-api.ts`) or **domain events**.
- Boundaries are enforced by lint rules and architecture tests in CI.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Microservices | Operational overhead and distributed consistency; makes self-hosting harder |
| Layered monolith without contexts | Erodes into a big ball of mud as contributors grow |

## Consequences

- Simple deployment and local development.
- Discipline is required; architecture rules are automated.
- Modules (e.g. the realtime gateway) can be extracted later because they communicate via ports and events.
