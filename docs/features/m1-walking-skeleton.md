# Feature: Walking skeleton (log in, see the office, walk, see others)

- **Status:** In progress
- **Brainstorming IDs:** S2 (click-to-walk + keyboard), S5 (floors), P1 (status, basic)
- **Bounded contexts:** Identity, People, World, Presence (+ realtime gateway)
- **Milestone:** M1

## Problem / user value

As a team member, I want to open TeamTown, log in once and see my colleagues walking around our
office, so that I can feel who is around.

## Behaviour

1. **Login.** The web client redirects to Keycloak (code flow + PKCE). The desktop app opens the system
   browser and receives the result via `teamtown://auth/callback`. On the first login, a **person** is
   created from the token (display name, a personal avatar colour derived from the person ID).
2. **Office.** After login, the person appears at a **spawn point** of the ground floor. The floor plan
   (tiles, walls, doors, rooms, furniture) is loaded via REST and rendered isometrically.
3. **Walking.** Clicking a tile sends `MoveTo`. The server computes the path (A\*), validates it and
   broadcasts `AvatarPathStarted` to everyone on the floor. Keyboard (WASD/arrows) moves one tile at a
   time, with immediate local prediction that is reconciled with the server path.
4. **Others.** Everyone on the same floor sees all avatars of that floor live. Leaving (closing the tab,
   disconnecting) removes the avatar for others.
5. **Floors.** A floor switcher (ground floor / upper floor) moves the person to the spawn point of the
   other floor.

## Acceptance criteria

- [ ] Given two logged-in people on the same floor, when one clicks a reachable tile, then the other sees the avatar walk there within 150 ms (local network). _(Walking is visible to others: e2e `walking-skeleton.spec.ts`; the 150 ms budget is not measured yet.)_
- [x] Given a wall between two tiles, when someone clicks behind it, then the avatar walks around it (never through).
- [x] Given an unreachable tile, then nothing moves and the client shows no error noise (Nack `unreachable`).
- [x] Given a person switches floors, then they disappear from the old floor and appear on the new one for everyone.
- [x] Non-spatial path: a "People on this floor" list shows everyone by name, keyboard-accessible.
- [x] Keyboard: the avatar can be moved with WASD/arrow keys; focus is visible.
- [x] i18n: all new UI strings exist in EN and DE.

## Permissions

M1 has no roles yet (M4). Every authenticated person may view all floors and walk on walkable tiles.
Door modes are shown but not enforced yet.

## Domain changes

- World: `FloorPlan` aggregate (published), seeded from JSON.
- People: `Person` aggregate (`oidcSubject`, `displayName`, `avatarColor`).
- Presence: in-memory `FloorInstance`, `AvatarState`, path timing.

## API & realtime contracts

- REST: `GET /api/me`, `GET /api/floors`, `GET /api/floors/:floorId/plan`
- Commands: `Authenticate`, `JoinFloor`, `MoveTo`, `Ping`
- Events: `Authenticated`, `FloorSnapshot`, `AvatarJoined`, `AvatarLeft`, `AvatarPathStarted`, `Pong`, `Ack`, `Nack`

## Privacy impact

Positions and paths exist only in memory (Presence) and in transit. They are not persisted or logged.
The person record stores only the OIDC subject, display name and avatar colour.

## Open questions

- None at the moment.
