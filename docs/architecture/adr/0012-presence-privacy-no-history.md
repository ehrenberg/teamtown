# ADR-0012: Live presence without history

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

A visible office can be misused for surveillance. TeamTown targets German companies, where works
councils must approve monitoring-capable software, and GDPR applies.

## Decision

- Others see a person's **live position and status**.
- Presence state is held **in memory only**. It is never persisted, logged or exported.
- No per-person attendance or movement analytics are built.
- Ghost mode and focus mode are always available to everyone.

## Consequences

- After a server restart, everyone reappears at their desk or spawn point. Nothing needs restoring.
- Features that would need history (heatmaps, "last seen in Room X") are excluded by design.
- An architecture test ensures the Presence module has no persistence adapters.
