# ADR-0014: Build the real office with an in-app tile-grid editor

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Companies should see a replica of their *real* office, and building it must be self-service for admins.

## Decision

- An **in-app editor** on the isometric **tile grid**: paint floors, draw walls on tile edges, place
  doors, define rooms, place furniture from a catalogue.
- An uploaded floor-plan image can serve as a **tracing layer**.
- Floor plans have draft and published versions.

## Alternatives considered

| Option | Why not |
|--------|---------|
| CAD/DXF/image import with auto-detection | Complex and error-prone; may come later as an assistant |
| External editor (Blender/files) | Not self-service |
| Built by us as a service | Doesn't scale; unsuitable for open source |

## Consequences

- The grid is the shared model for editing, pathfinding and synchronisation.
- A furniture catalogue of low-poly assets is part of the product.
