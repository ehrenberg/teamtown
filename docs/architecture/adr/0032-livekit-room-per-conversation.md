# ADR-0032: One LiveKit room per proximity conversation

- **Status:** Accepted
- **Date:** 2026-10-30
- **Deciders:** Product owner

## Context

ADR-0022 planned one LiveKit room per floor, with the server granting track subscriptions per proximity group.
A spike against LiveKit v1.13 showed that LiveKit has **no server-side per-track grant**: with `canSubscribe: true`
every client can subscribe to every track in the room, with `canSubscribe: false` it receives nothing, not even
tracks the server subscribes it to. Fine-grained subscription permissions exist only as a signal from the
**publishing client**. Only server-side enforcement meets the privacy promise "a modified client can't listen in".

## Decision

- Every proximity conversation gets its own LiveKit room `conversation:{conversationId}`. This supersedes the
  proximity part of ADR-0022 (one room per floor); room calls, direct calls and the in-process gateway stay as decided.
- The server issues a LiveKit token **only to the participants** of a conversation, with a short lifetime (30 s, the
  same as the grace period of locked conversations). When someone leaves, the server removes them from the
  LiveKit room, and it reconciles the room's participant list with the conversation, removing anyone else.
- Conversation identities are kept stable: when conversations merge, the larger one keeps its room; when one
  splits, the larger part keeps it. Only the others switch rooms.
- Clients switch **make-before-break**: connect to the new room and publish there, then leave the old one.

## Alternatives considered

| Option                                                         | Why not                                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| One room per floor, publisher-side permissions                 | Tested and works against modified listeners, but relies on the speaker's own client to protect them |
| One room per floor, server-side subscription grants (ADR-0022) | Not supported by LiveKit (spike)                                                                    |

## Consequences

- Privacy is enforced by the server alone (tokens, removal, reconciliation), covered by an integration test against
  a real LiveKit server with a modified client.
- Joining or leaving a conversation means a room switch; the client must hide it (make-before-break). Starting a
  conversation should still take < 1 s (MVP acceptance, proposal).
- More, short-lived LiveKit rooms; LiveKit handles this well, but it is part of the load test (M6).
- Dev stack: LiveKit runs with `--node-ip 127.0.0.1` so browsers on the host can reach its media ports.
