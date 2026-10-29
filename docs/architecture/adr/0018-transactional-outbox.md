# ADR-0018: Transactional outbox for domain events

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Modules react to each other's domain events (e.g. `RoomCreated` → create a room wall channel). If the
process crashes between the database commit and the event dispatch, events are lost and modules drift
apart.

## Decision

- Persistent modules write recorded domain events into an **outbox table** within the **same transaction**
  as the aggregate change (each module has its own outbox table in its own schema).
- An **outbox relay** dispatches events to the in-process event bus after commit and marks them as
  processed. Handlers are **idempotent** (at-least-once delivery).
- **Presence and the ephemeral Meetings state do not use the outbox.** Their events are dispatched in
  memory only, because nothing about presence may be persisted (ADR-0012).

## Alternatives considered

| Option                   | Why not                     |
| ------------------------ | --------------------------- |
| In-process dispatch only | Events can be lost on crash |

## Consequences

- Event handlers must tolerate duplicates (use event IDs).
- Processed outbox rows are cleaned up after a retention period.
- The outbox is the natural seam for a message broker if modules are ever extracted.
