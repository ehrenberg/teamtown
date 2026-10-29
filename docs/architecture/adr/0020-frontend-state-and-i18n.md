# ADR-0020: Frontend state with Zustand + TanStack Query; i18n with i18next

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

The web client has two kinds of state: high-frequency **realtime state** (avatars, paths, conversations),
read by the R3F render loop outside React's render cycle, and **server state** from REST (channels,
messages, roles). The UI must be localised in English and German (ADR-0016).

## Decision

- **Zustand** for realtime and UI state. Stores are fed by the realtime client. R3F components read them
  through selectors or `getState()` in the frame loop, without re-rendering React.
- **TanStack Query** for REST server state (caching, pagination, optimistic updates). Realtime events
  invalidate or patch query caches.
- **i18next** with **react-i18next** in the client. Catalogues live in `packages/i18n` (EN base, DE).
  German uses the informal **"du"**. The server uses error codes only.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Redux Toolkit + RTK Query | More boilerplate |
| Jotai | Atomic model less intuitive for many contributors |
| Lingui / FormatJS | Smaller ecosystem / more verbose |

## Consequences

- Clear rule: *server data → TanStack Query, live world → Zustand*. No duplicate sources of truth.
