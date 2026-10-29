# ADR-0022: Realtime gateway in-process; LiveKit room mapping

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Presence, meetings and media must be coordinated with low latency. Locked rooms must be acoustically
isolated in a way the server enforces.

## Decision

- The **WebSocket realtime gateway runs inside the server process** as its own module. It talks to
  other modules only through application ports, so it can be extracted later.
- **LiveKit room mapping:**
  - one LiveKit room **per floor** for proximity conversations. The Meetings module grants track subscriptions per proximity group.
  - one LiveKit room **per TeamTown room** for room calls.
  - one LiveKit room **per direct call**.
  - later, one **stage** room per town hall.

Details: [audio-video.md](../audio-video.md).

## Alternatives considered

| Option | Why not |
|--------|---------|
| Separate gateway process | Needs inter-process communication (Redis) without a current need |
| One LiveKit room per proximity conversation | Frequent room switching causes audio gaps when people join and leave |

## Consequences

- Proximity privacy depends on correct server-side subscription grants. This is covered by dedicated tests.
