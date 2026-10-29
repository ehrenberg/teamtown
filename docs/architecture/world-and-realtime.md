# World & Realtime

How the isometric office is modelled, rendered and synchronised between clients.
Decided foundations: Three.js / React Three Fiber ([ADR-0006](adr/0006-rendering-threejs-r3f.md)),
WebSocket + MessagePack ([ADR-0007](adr/0007-realtime-websocket-messagepack.md)),
tile-grid editor ([ADR-0014](adr/0014-office-editor-tile-grid.md)).
Details marked **(proposal)** are open for discussion.

## 1. World model: tiles as the single source of truth

The office is a **2D tile grid with height information**, rendered in 3D. The grid makes three hard
problems easy:

| Problem | Solved by the grid |
|---------|--------------------|
| Editing a real floor plan | Draw walls and rooms on tile edges, snap furniture to tiles |
| Pathfinding & collision | A* on walkable tiles; walls are blocked edges between tiles |
| Synchronisation | Positions are small integers (tile coordinates) plus a path, not floats streamed at 60 Hz |

- **Tile size (proposal):** 1 tile = 0.5 m × 0.5 m in real-world scale. A 30 × 20 m office is a 60 × 40 grid.
- **Walls** live on **tile edges**, not on tiles. That gives thin walls and real room shapes.
- **Furniture** has a footprint in tiles, a rotation (0/90/180/270) and a walkability flag (a chair is walkable, a desk is not).

## 2. Rendering (client)

- **Camera:** `OrthographicCamera` at the classic isometric angle (pitch ≈ 35.264°, yaw 45°).
  Zoom levels are fixed (proposal: 3 steps). Rotation snaps in 90° steps (proposal).
- **Wall cut-away:** walls between the camera and the player are rendered low (like The Sims), so rooms are never hidden.
- **Assets:** low-poly glTF models (Blender), with a shared material palette/texture atlas and **instanced meshes** for repeated furniture.
- **Avatars:** a modular low-poly figure (body, hair, outfit, accessory parts) with a few skeletal animations
  (idle, walk, sit, wave). The name plate and status are HTML overlays (accessible, crisp text).
- **Separation:** rendering lives in `apps/web/src/world/`. Pure grid maths, pathfinding and iso projection
  live in the framework-free package `packages/world-core` and are shared with the server.

### Performance budget (proposal)

| Item | Budget |
|------|--------|
| Draw calls per frame | < 150 (instancing, merged static geometry per floor) |
| Triangles per avatar | ≤ 1,500 |
| Triangles per floor (static) | ≤ 150k |
| Texture memory | ≤ 64 MB |
| Target | 60 fps with 50 avatars on an integrated GPU; performance mode 30 fps |

## 3. Movement synchronisation: paths, not positions

Instead of streaming positions at a fixed tick rate, TeamTown synchronises **movement intents and
paths**. An office avatar mostly walks from A to B and then stands still, so this is far more efficient.

```
Client  ── MoveTo{target: {x,y}} ─────────────▶ Server (Presence)
                                                 1. A* on walkability grid
                                                 2. Check room entries on the path (Access + door mode)
                                                 3. Store path, t0 = server time
Clients ◀─ AvatarPathStarted{personId, path[], speed, t0} ── (all clients on this floor)
Clients    interpolate deterministically: position(t) = f(path, speed, t − t0)
```

- **WASD / continuous input:** The client sends direction changes (`MoveDirection{dir}` / `Stop`).
  The server extends the path tile by tile. The own avatar uses **client-side prediction** and
  reconciles with the server path.
- **Interruptions:** A new `MoveTo` replaces the path. Other clients receive a new `AvatarPathStarted`.
- **Clock sync:** Clients estimate the server time offset (ping/pong handshake), so `t0` is meaningful.
- **Server-authoritative:** The server alone decides where an avatar may be. A modified client can't
  walk through locked doors.

## 4. Interest management

- Clients subscribe to **one floor** at a time and receive the events for that floor only.
  Multiple floors are part of the MVP: switching floors means unsubscribing, subscribing to the new floor and receiving its snapshot.
- At 50–500 people per instance, all avatars of a floor are sent to every client on that floor. No spatial
  partitioning within a floor is needed for the MVP (proposal; revisit above ~200 avatars per floor).
- On (re)connect the client receives a **floor snapshot** (all `AvatarState`s), then deltas.

## 5. Realtime protocol

- Transport: one **WebSocket** per client (`wss://…/realtime`), authenticated with the OIDC access token during the handshake.
- Encoding: **MessagePack**. Every message is an envelope `{ t: <type>, id?: <correlation>, p: <payload> }`.
- Schemas: **Zod** in `packages/contracts/realtime`, the single source for types on both sides and for the
  **AsyncAPI** document (`docs/api/asyncapi.yaml`, generated).
- Direction naming: client → server messages are **commands** (`MoveTo`, `SetStatus`, `KnockOnRoom`).
  Server → client messages are **events** (`AvatarPathStarted`, `KnockRequested`).
- Command acknowledgement: commands carrying an `id` receive `Ack{id}` or `Nack{id, code}`.
- Versioning: the protocol version is negotiated in the handshake. Breaking changes require a new version.
- Message channels: realtime carries **presence, meetings and live notifications**. Messaging uses
  REST for writes and the WebSocket for push of new messages.

## 6. Office editor

- An admin-only mode in the same client (permission `world.edit`).
- Edits a **draft** `FloorPlan`; **publish** creates a new immutable version. Online clients receive
  `FloorPlanPublished` and hot-swap the floor. Avatars on now-blocked tiles are moved to the nearest walkable tile.
- Tools (proposal): floor paint, wall draw (edge snapping), door place, room area paint and name,
  furniture place/rotate, tracing image (upload, scale, opacity).
- Editor commands are classic REST commands on the World module, validated by `FloorPlan` invariants.
