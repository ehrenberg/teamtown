# ADR-0007: Realtime over WebSocket with MessagePack and contract-first schemas

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Presence, movement, knocks and live notifications need low-latency bidirectional communication.

## Decision

- One native **WebSocket** connection per client with **MessagePack** encoding.
- Message envelope `{ t, id?, p }`. Commands go client → server, events go server → client.
- Schemas are defined with **Zod** in `packages/contracts` (single source of truth) and documented as **AsyncAPI**.
- Movement is synchronised as **paths** (intent + path + start time), not as streamed positions.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Socket.IO | Protocol overhead, custom client requirement |
| Colyseus | A separate framework paradigm next to NestJS |

## Consequences

- Full control and low overhead. Reconnect, heartbeat and backpressure are our responsibility.
- Shared schemas eliminate client/server drift.
