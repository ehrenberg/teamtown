# ADR-0008: Audio, video and screen sharing via LiveKit

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Proximity audio, room calls and screen sharing require scalable WebRTC infrastructure. The privacy of
locked rooms must be enforceable on the server.

## Decision

Use the open-source **LiveKit** server, self-hosted in the Compose stack with its built-in TURN.
The TeamTown server mints access tokens and controls track subscription permissions.
The mapping of concepts to LiveKit rooms is described in [audio-video.md](../audio-video.md).

## Alternatives considered

| Option | Why not |
|--------|---------|
| mediasoup | Signalling, scaling and recording would all need to be built |
| Managed providers (Daily, Agora, Dyte) | Vendor lock-in, per-minute cost, data residency |
| Jitsi | Less flexible for fine-grained proximity audio |

## Consequences

- Proven media quality (simulcast, adaptive streaming).
- The instance needs open UDP ports, which rules out shared hosting (see ADR-0013).
- LiveKit is Apache-2.0 licensed, which is compatible with AGPL.
