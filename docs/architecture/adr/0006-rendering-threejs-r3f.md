# ADR-0006: Render the isometric world with Three.js / React Three Fiber

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

TeamTown shows the office in a soft low-poly isometric 3D look. Rendering must run in browsers and
Electron, integrate with a React UI and perform well on office laptops.

## Decision

- **Three.js** via **React Three Fiber** with an **orthographic camera** at an isometric angle.
- Assets as **glTF/GLB** low-poly models made in Blender, using a shared palette texture.
- The renderer only displays state from client stores fed by the realtime client. It contains no business logic.

## Alternatives considered

| Option                | Why not                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| PixiJS (2.5D sprites) | No camera rotation; depth sorting and multi-angle sprites must be built by hand |
| Babylon.js            | Heavier, weaker React integration                                               |
| Godot/Unity WebGL     | Bundle size, UI integration, accessibility                                      |

## Consequences

- Lighting, shadows, depth and zoom come for free.
- A 3D asset pipeline (Blender → glTF) and performance budgets are needed
  (see [world-and-realtime.md](../world-and-realtime.md), [world-art-direction.md](../../design/world-art-direction.md)).
