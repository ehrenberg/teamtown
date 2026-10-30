# Feature: Room calls, door modes and knock

- **Status:** Done (2026-10-30)
- **Brainstorming ID:** C3 (room meetings), C4 (knock knock), S1 (door states as availability)
- **Bounded context(s):** Meetings, Presence, World, realtime gateway
- **Milestone:** M2b (ADR-0031)

## Problem / user value

As a team member, I want to walk into a meeting room and be in its call at once, without links or lobbies, so
that meetings feel like the real office. As someone in a meeting, I want to close the door or let people knock,
so that we decide who joins.

## Behaviour

1. **Room call.** Every room with `audioIsolated` has a room call (LiveKit room `room:{floorId}:{roomId}`, because room IDs are unique per
   floor only). Entering the
   room joins the call: the server sends the occupant a short-lived token, the client publishes its microphone
   and hears everyone in the room at full volume (no distance falloff, no panning). Leaving the room leaves the
   call at once. Proximity conversations never reach into or out of an isolated room (M2a). Rooms without
   `audioIsolated` have no room call; proximity applies inside them.
2. **Enforcement.** As in M2a, only occupants get a token. The server removes whoever leaves the room from the
   LiveKit room and reconciles its participants, removing anyone who doesn't belong.
3. **Door modes.** Every room shows its door mode at its doors: `open` (walk in), `knock` (ask to enter) or
   `locked` (nobody else enters, knocking included). The door mode is enforced by the server when paths are
   computed: a path may cross into a `knock` or `locked` room only with an entry pass; a `MoveTo` into such a room
   without one is rejected with `door-closed`. Leaving a room is always possible. If the door mode changes while someone is walking towards it, their path ends in front of the door.
4. **Who changes the door mode.** Until M4, any occupant of a room may switch its door mode (ADR-0031). This works
   in every room that can only be entered through doors (enclosed) and has no spawn point; all other rooms stay
   `open` (decided 2026-10-30). The last change wins.
5. **Reset.** When the last occupant leaves, the room goes back to the door mode from its floor plan.
6. **Empty rooms.** A `knock` room with nobody inside can be entered freely (nobody could answer a knock). A
   `locked` room is never empty, because it resets when the last person leaves.
7. **Knock.** In front of a `knock` room (or from the rooms list), a person can knock. Everyone inside hears a
   knock sound and sees the request with the requester's name. Any one occupant admits or declines; the first
   answer wins and the others see it. Without an answer, the request expires after **60 seconds**. The requester
   can cancel it. A person has at most one open knock at a time.
8. **Admission.** An admitted person gets an **entry pass** for that room, valid for **30 seconds**, and their
   avatar walks in through the door automatically (server path to a free tile inside). The pass is used up on
   entering. If the requester can't be reached any more (offline, other floor), the pass simply expires.
9. **Declined or expired.** The requester sees a plain message ("Nobody answered" / "Not right now"). They may
   knock again.
10. **Grace period.** Someone who leaves a `knock` or `locked` room and returns within **30 seconds** walks back
    in without knocking (same grace period as a locked conversation, ADR-0031). After that they are a newcomer.
11. **Visibility.** Avatars and names inside a room stay visible to everyone on the floor in every door mode,
    like a glass-walled office. Only entry and sound are restricted.
12. **Shut in.** Whoever is behind a closed room (no spawn point reachable without crossing it) may cross it to
    get out, but not stop inside it (decided 2026-10-30).
13. **Spawn safety.** Rooms that contain a spawn point always stay `open`; their door mode can't be switched, so
    nobody joining the floor is placed inside a closed room or locked out of the floor.

## Acceptance criteria

- [x] Given a person walks into an `audioIsolated` room with two others inside, then within 1 s they hear both at
      full volume, and nobody outside the room hears any of them. _(Room-call membership is unit-tested; hearing
      each other is verified in e2e `room-calls-and-knock.spec.ts` without the 1 s budget, which is measured in M6.)_
- [x] Given an occupant of a room call walks out, then they are removed from the room's LiveKit room at once and
      no longer receive its audio.
- [x] Given a modified client that joins `room:{floorId}:{roomId}` without being inside (or stays after leaving), then the
      server removes it and it receives no audio (privacy test against a real LiveKit server).
- [x] Given a `locked` room, when someone outside sends `MoveTo` to a tile inside, then the command is rejected
      with `door-closed` and they never enter; if the mode changes while they walk towards it, their path ends in
      front of the door.
- [x] Given a `knock` room with one occupant, when a person knocks, then the occupant hears a knock sound and sees
      the request; when the occupant admits, then the requester's avatar walks in within the 30 s pass. _(Verified in
      e2e `room-calls-and-knock.spec.ts`; the knock sound itself is not checked automatically.)_
- [x] Given a knock request without an answer, then it expires after 60 s and the requester is told plainly.
- [x] Given two occupants, when one admits and the other declines at the same time, then exactly one answer counts
      and both see the result.
- [x] Given a person leaves a `locked` room and returns within 30 s, then they walk back in; after more than 30 s
      they can't.
- [x] Given the last occupant leaves a room whose door mode was changed, then the room shows its floor-plan door
      mode again.
- [x] Given an empty `knock` room, then anyone can walk in without knocking.
- [x] Non-spatial path: a "Rooms on this floor" list shows each room's name, door mode (icon **and** label) and
      occupants, with the actions "Go there", "Knock" and "Stop knocking"; occupants change the door mode and answer knocks
      in the toolbar and the knock tray, both reachable by keyboard.
- [x] Accessibility: door mode switch, knock, admit and decline are buttons with labels and reachable by keyboard;
      incoming knocks and their outcome are announced politely (`aria-live`); the knock sound has a visible
      counterpart. _(Native buttons with accessible names, used by role and name in the e2e test; reviewed with
      `/ui-review`. The announcements are not yet checked with a screen reader.)_
- [x] i18n: all new strings in EN and DE.

## Permissions

The catalogue has `room.enter`, `room.admit` (answer knocks) and `room.lock` (change door mode)
(`permissions.md`). Roles arrive in M4; until then every authenticated person may enter, and every **occupant**
may admit and change the door mode (ADR-0031). As in M2a, the use cases check occupancy directly; the
`AccessPolicy` port arrives with M4 and then replaces these checks. No new permissions.

## Domain changes

- **world-core (framework-free, test-driven):** `RoomMap` (which room a tile belongs to, which rooms are
  enclosed, which may change their door mode) and an optional step guard for pathfinding and reachability.
- **World:** floor-plan invariant: only rooms whose door mode is adjustable may have a door mode other than `open`.
- **Presence:** `FloorInstance` derives each avatar's room from its position (no room events: Meetings reads
  occupancy through Presence's public API on its tick). `RoomDoors` holds the **live door mode** per room (in memory, reset when the room empties), entry passes and grace
  periods, and blocks door crossings without a pass. Presence owns the live door mode because it enforces paths
  and knows occupancy; Meetings grants entry passes through Presence's public API (decided 2026-10-30).
- **Meetings:** `Knocks` (open `KnockRequest`s: `knockId`, `floorId`, `roomId`, `requester`, `expiresAt`) and
  `FloorRoomCalls` (`roomId`, `participants[]`), both in memory. Events: `KnockRequested`, `KnockAnswered`
  (outcome `admitted | declined | expired | cancelled`), `RoomCallChanged`. The `MediaGateway` port from M2a issues
  room-call tokens and reconciles `room:{floorId}:{roomId}`. Knocks that became pointless (requester left the
  floor, room open or empty) are cancelled.

## API & realtime contracts

- Commands: `SetDoorMode { roomId, doorMode }`, `KnockOnRoom { roomId }`, `CancelKnock { knockId }`,
  `AnswerKnock { knockId, admit: boolean }`, `RequestRoomCallToken { roomId }` (reconnect).
- Events to everyone on the floor: `DoorModeChanged { floorId, roomId, doorMode }`,
  `RoomCallChanged { floorId, roomCall: { roomId, participants } }`. `FloorSnapshot` gains `doorModes` and
  `roomCalls`. Clients derive an avatar's room from its position and the floor plan.
- Events to the occupants of the room and the requester:
  `KnockRequested { knockId, floorId, roomId, requester, expiresAt }`,
  `KnockAnswered { knockId, roomId, outcome }` (`admitted`, `declined`, `expired`, `cancelled`).
- Event to an occupant only: `RoomCallAccessGranted { roomId, url, token }`.
- Nack codes: `door-closed`, `room-not-found`, `not-in-room`, `knock-not-found`, `knock-pending`,
  `door-mode-fixed` (room that can't close), `knock-not-needed` (room open, empty or one's own).
- Documented in `docs/api/asyncapi.yaml` (generated).

## Privacy impact

- Room occupancy, door modes, entry passes, grace periods and knocks exist **only in memory** and in transit
  (ADR-0012). Who entered which room, who knocked and who admitted whom is never persisted or logged; telemetry
  carries only counts (`teamtown.meetings.room_calls`, `teamtown.meetings.knocks`,
  `teamtown.meetings.conversations`), never people or rooms (ADR-0019, ADR-0030).
- Audio passes through LiveKit only; nothing is recorded. Logged meetings are M2d and opt-in (ADR-0026).
- Room-call privacy is enforced by the server (tokens, removal, reconciliation), not by the client.
- Decided: names and avatars inside rooms stay visible in every door mode. The realtime skill's example "no names
  of people inside a locked room" is updated accordingly.

## UI / design

- World: one door sign per room that can close, showing the door mode with a colour, an icon **and** text (open
  door, hand, padlock); closed doors (`knock`, `locked`) get a door leaf. The sign's icon knocks softly while a
  knock is open (only for the people who see the knock).
- Office toolbar inside such a room: door mode switch (three options). Sidebar: knock tray with "Let in" /
  "Not now", rooms list below "People on this floor".
- Walking into a closed door shows a plain notice, with "Knock" where knocking is possible.
- Knock sound: two short, soft synthesised knocks; the knock tray is its visible counterpart.
- Reduced motion: no knock animation, the door sign changes only.

## Not yet covered by automated tests

- The 1 s budget for hearing each other (M6), the knock sound and the screen-reader announcements.

## Open questions

- None at the moment.
