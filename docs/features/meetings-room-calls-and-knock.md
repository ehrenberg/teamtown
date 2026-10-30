# Feature: Room calls, door modes and knock

- **Status:** Draft
- **Brainstorming ID:** C3 (room meetings), C4 (knock knock), S1 (door states as availability)
- **Bounded context(s):** Meetings, Presence, World, realtime gateway
- **Milestone:** M2b (ADR-0031)

## Problem / user value

As a team member, I want to walk into a meeting room and be in its call at once, without links or lobbies, so
that meetings feel like the real office. As someone in a meeting, I want to close the door or let people knock,
so that we decide who joins.

## Behaviour

1. **Room call.** Every room with `audioIsolated` has a room call (LiveKit room `room:{roomId}`). Entering the
   room joins the call: the server sends the occupant a short-lived token, the client publishes its microphone
   and hears everyone in the room at full volume (no distance falloff, no panning). Leaving the room leaves the
   call at once. Proximity conversations never reach into or out of an isolated room (M2a). Rooms without
   `audioIsolated` have no room call; proximity applies inside them.
2. **Enforcement.** As in M2a, only occupants get a token. The server removes whoever leaves the room from the
   LiveKit room and reconciles its participants, removing anyone who doesn't belong.
3. **Door modes.** Every room shows its door mode at its doors: `open` (walk in), `knock` (ask to enter) or
   `locked` (nobody else enters, knocking included). The door mode is enforced by the server when paths are
   computed: a path may cross into a `knock` or `locked` room only with an entry pass; a `MoveTo` into such a room
   without one is rejected with `door-closed`. Leaving a room is always
   possible. If the door mode changes while someone is walking towards it, their path ends in front of the door.
4. **Who changes the door mode.** Until M4, any occupant of a room may switch its door mode (ADR-0031). This works
   in every room that has at least one door. The last change wins.
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
12. **Spawn safety.** _(Proposal)_ Rooms that contain a spawn point can't be switched away from `open`, so nobody
    joining the floor is placed inside a closed room or locked out of the floor.

## Acceptance criteria

- [ ] Given a person walks into an `audioIsolated` room with two others inside, then within 1 s they hear both at
      full volume, and nobody outside the room hears any of them.
- [ ] Given an occupant of a room call walks out, then they are removed from the room's LiveKit room at once and
      no longer receive its audio.
- [ ] Given a modified client that joins `room:{roomId}` without being inside (or stays after leaving), then the
      server removes it and it receives no audio (privacy test against a real LiveKit server).
- [ ] Given a `locked` room, when someone outside sends `MoveTo` to a tile inside, then the command is rejected
      with `door-closed` and they never enter; if the mode changes while they walk towards it, their path ends in
      front of the door.
- [ ] Given a `knock` room with one occupant, when a person knocks, then the occupant hears a knock sound and sees
      the request; when the occupant admits, then the requester's avatar walks in within the 30 s pass.
- [ ] Given a knock request without an answer, then it expires after 60 s and the requester is told plainly.
- [ ] Given two occupants, when one admits and the other declines at the same time, then exactly one answer counts
      and both see the result.
- [ ] Given a person leaves a `locked` room and returns within 30 s, then they walk back in; after more than 30 s
      they can't.
- [ ] Given the last occupant leaves a room whose door mode was changed, then the room shows its floor-plan door
      mode again.
- [ ] Given an empty `knock` room, then anyone can walk in without knocking.
- [ ] Non-spatial path: a "Rooms on this floor" list shows each room's name, door mode (icon **and** label) and
      occupants, with the actions "Go there", "Knock" and "Cancel knock"; occupants can change the door mode and
      answer knocks from the list.
- [ ] Accessibility: door mode switch, knock, admit and decline are buttons with labels and reachable by keyboard;
      incoming knocks and their outcome are announced politely (`aria-live`); the knock sound has a visible
      counterpart.
- [ ] i18n: all new strings in EN and DE.

## Permissions

The catalogue has `room.enter`, `room.admit` (answer knocks) and `room.lock` (change door mode)
(`permissions.md`). Roles arrive in M4; until then every authenticated person may enter, and every **occupant**
may admit and change the door mode (ADR-0031). The use cases check these through the `AccessPolicy` port so that
M4 only swaps the policy. No new permissions.

## Domain changes

- **world-core (framework-free, test-driven):** which room a door leads into (the room whose area contains
  exactly one of the two tiles next to the door); pathfinding with a predicate for blocked door crossings.
- **Presence:** `FloorInstance` tracks each avatar's `roomId` and emits `AvatarEnteredRoom` / `AvatarLeftRoom`.
  It holds the **live door mode** per room (in memory, reset when the room empties), entry passes and grace
  periods, and blocks door crossings without a pass. _(Proposal: Presence owns the live door mode because it
  enforces paths and knows occupancy; Meetings grants passes through Presence's public API.)_
- **Meetings:** `KnockRequest` (`knockId`, `roomId`, `requester`, `state: pending | admitted | declined | expired |
cancelled`, `expiresAt`) and `RoomCall` (`roomId`, `participants[]`), both in memory. Events:
  `KnockRequested`, `KnockAnswered`, `RoomCallJoined`, `RoomCallLeft`. The `MediaGateway` port from M2a issues
  room-call tokens and reconciles `room:{roomId}`.
- **World:** no change; the floor-plan `doorMode` becomes the default the live door mode resets to.

## API & realtime contracts

- Commands: `SetDoorMode { roomId, doorMode }`, `KnockOnRoom { roomId }`, `CancelKnock { knockId }`,
  `AnswerKnock { knockId, admit: boolean }`, `RequestRoomCallToken { roomId }` (reconnect).
- Events to everyone on the floor: `DoorModeChanged { floorId, roomId, doorMode }`. `FloorSnapshot` gains the live
  door modes; `AvatarState` gains `roomId`.
- Events to the occupants of the room: `KnockRequested { knockId, roomId, requester: personId, expiresAt }`,
  `KnockAnswered { knockId, outcome }` (`admitted`, `declined`, `expired`, `cancelled`).
- Events to the requester only: `KnockAnswered { knockId, outcome }`.
- Event to an occupant only: `RoomCallAccessGranted { roomId, url, token }`.
- Nack codes: `door-closed`, `room-not-found`, `not-in-room`, `knock-not-found`, `knock-pending`.

## Privacy impact

- Room occupancy, door modes, entry passes, grace periods and knocks exist **only in memory** and in transit
  (ADR-0012). Who entered which room, who knocked and who admitted whom is never persisted or logged; telemetry
  carries only counts (active room calls, open knocks), never people or rooms (ADR-0019, ADR-0030).
- Audio passes through LiveKit only; nothing is recorded. Logged meetings are M2d and opt-in (ADR-0026).
- Room-call privacy is enforced by the server (tokens, removal, reconciliation), not by the client.
- Decided: names and avatars inside rooms stay visible in every door mode. The realtime skill's example "no names
  of people inside a locked room" is updated accordingly.

## UI / design

- World: a door sign per room door showing the door mode with a colour **and** a shape (open door, hand knocking,
  padlock); a closed door blocks visually for `knock` and `locked`. A soft knock animation on the door.
- Office toolbar inside a room: door mode switch (three options), and a knock tray with admit / decline.
- Knock sound: short, soft, respects the system volume; a visible toast always accompanies it.
- Rooms list next to "People on this floor".
- Reduced motion: no knock animation, the door sign changes only.

## Open questions

- Should rooms with a spawn point be excluded from door mode changes (behaviour 12, proposal)?
- Should the grace period also apply to `knock` rooms, as written in behaviour 10, or only to `locked` rooms?
