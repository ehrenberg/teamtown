# Feature: Proximity conversations (walk up and talk)

- **Status:** In progress
- **Brainstorming ID:** C1 (proximity audio with walls), C2 (conversation bubble)
- **Bounded context(s):** Meetings (new), Presence, World, realtime gateway
- **Milestone:** M2a (ADR-0031)

## Problem / user value

As a team member, I want to walk up to colleagues and simply start talking, like in the real office, so that a
quick question doesn't need a scheduled call. As someone in a conversation, I want to make it private, so that
passers-by can't listen in.

## Behaviour

1. **Audio check.** After login and before the office, a short audio check asks for the microphone permission and
   shows a level meter and a speaker test. "Join without microphone" is always possible; you can still listen.
   The microphone default is a per-person setting, initially on (ADR-0031).
2. **Media connection.** When a conversation forms, the server sends each participant a short-lived token for the
   LiveKit room `conversation:{conversationId}` (ADR-0032). The client joins, publishes its microphone and hears
   the others. Outside a conversation, no microphone is published.
3. **Conversations.** The server (Meetings) computes conversations on each floor from the live avatar positions:
   two people are _connected_ when their distance is ≤ 4 tiles and no wall lies between them (every wall blocks,
   glass included; doors are openings). A connection persists until the distance exceeds 6 tiles or a wall comes
   between them (hysteresis). A **conversation** is a connected component of at least two people (transitive:
   A–B and B–C means A, B and C hear each other). People inside an `audioIsolated` room are never part of a
   floor conversation (their room call follows in M2b).
4. **Enforcement.** Only participants get a token. Whoever leaves is removed from the LiveKit room at once; the
   server reconciles the room's participants and removes anyone who doesn't belong. When conversations merge or
   split, the larger part keeps its room and the others switch make-before-break, without an audible gap.
5. **Volume and direction.** The client sets the volume by distance (full ≤ 2 tiles, silent at 6 tiles, smooth
   falloff) and pans the voice left/right by the speaker's position on screen (WebAudio `PannerNode`).
6. **Bubble.** Everyone on the floor sees a soft bubble around each conversation. A speaking indicator shows who is
   talking; a muted icon shows who has the microphone off.
7. **Lock.** Any participant can lock or unlock the conversation. A locked conversation does not take in new
   people: someone who comes near sees the bubble with a lock and hears nothing, and the participants don't hear
   them either. Participants can still leave. Someone who left comes back in automatically if they return within
   **30 seconds** (grace period); later they are a newcomer. A locked conversation with fewer than two
   participants ends.
8. **Talk to.** In the "People on this floor" list, "Talk to" walks your avatar to a free tile next to that person
   (server path); the conversation then forms as usual. This is the non-spatial path.
9. **Mute.** Microphone on/off via a button in the office toolbar and the keyboard shortcut `M`.
10. **Reconnect.** After a dropped connection, the client asks for a fresh token for its current conversation.

## Acceptance criteria

- [ ] Given two people on the open floor 3 tiles apart without a wall between them, then they hear each other within 1 s, and everyone on the floor sees one bubble around them. _(Verified in e2e `proximity-conversations.spec.ts` without the 1 s budget: software-rendered test browsers make the local LiveKit answer slowly.)_
- [x] Given A near B and B near C (A and C 7 tiles apart), then A, B and C are one conversation and hear each other.
- [x] Given two people 3 tiles apart with a wall (solid or glass) between them, then they are not in a conversation and do not receive each other's audio.
- [x] Given a conversation, when one participant walks to 5 tiles, then it continues; at more than 6 tiles, the participant leaves and is removed from the conversation's LiveKit room.
- [x] Given a locked conversation, when a participant leaves and returns within 30 s, then they hear the others again; after more than 30 s they don't.
- [x] Given a locked conversation, when a third person comes within 2 tiles, then that person receives no audio from it and the participants receive none from them; the bubble shows a lock to everyone.
- [x] Given a modified client that joins a conversation room without belonging to it (or stays after leaving), then the server removes it and it receives no audio (privacy test against a real LiveKit server).
- [x] Given a person in an `audioIsolated` room, then nobody outside hears them, however close.
- [ ] Given the audio check, when the person chooses "Join without microphone", then they enter the office, can listen, and can switch the microphone on later.
- [x] Non-spatial path: the "People on this floor" list groups people by conversation, shows the lock, the speaking and the muted state; the "Talk to" action walks you next to that person.
- [ ] Keyboard and screen reader: microphone toggle via button and `M`; lock via button with a label; joining and leaving a conversation is announced politely (`aria-live`).
- [x] i18n: all new strings in EN and DE.

## Permissions

`call.speak` (town scope) exists in the catalogue (`permissions.md`). Roles arrive in M4; until then every
authenticated person may speak and listen, as in M1. Locking a conversation needs no permission: any participant
may lock or unlock it. No new permissions.

## Domain changes

- **World:** `Room` gets `audioIsolated: boolean`; the floor-plan format (contract and seeds) gets the field.
  Seeds: meeting and focus rooms are isolated.
- **world-core (framework-free, test-driven):** line of sight between tiles over wall edges; conversation grouping
  with hysteresis (connections, connected components).
- **Meetings (new module, in-memory):** `FloorConversations` per floor holds connections and `Conversation`
  (`conversationId`, `participants[]`, `locked`). Recomputed from Presence positions on movement and on a short
  tick while someone walks. Events: `ConversationFormed`, `ConversationChanged`, `ConversationDissolved`.
- **Meetings → LiveKit:** a `MediaGateway` port (adapter: `livekit-server-sdk`) issues tokens, removes participants
  and lists a room's participants for reconciliation. Presence data never leaves memory.

## API & realtime contracts

- Event to a participant only: `ConversationAccessGranted { conversationId, url, token }`; command
  `RequestConversationToken { conversationId }` (reconnect) answered the same way.
- Commands: `LockConversation { conversationId }`, `UnlockConversation { conversationId }`.
- Events (to everyone on the floor): `ConversationFormed`, `ConversationChanged`, `ConversationDissolved` with
  `{ conversationId, participants: personId[], locked }`. `FloorSnapshot` gains the current conversations.
- Nack codes: `not-in-conversation`, `conversation-not-found`.
- Contract: floor plan `rooms[].audioIsolated: boolean`.

## Privacy impact

- Positions, connections and conversations exist **only in memory** and in transit (ADR-0012). Who talked with
  whom is never persisted or logged; telemetry carries only counts (e.g. number of active conversations), never
  participants (ADR-0019, ADR-0030).
- Audio streams pass through LiveKit only; nothing is recorded.
- Privacy of conversations is enforced by the server (tokens, removal, reconciliation), not by the client.

## UI / design

- Audio check screen between login and the office (level meter, speaker test, "Join without microphone").
- Office toolbar: microphone toggle, later camera (M2c).
- World: soft bubble around conversations (accent colour from the tokens, low opacity), lock icon, speaking ring
  and muted icon at the avatar's name label. Status = colour **and** shape.
- Reduced motion: no pulsing speaking ring, a static indicator instead.

## Not yet covered by automated tests

- The 1 s budget for hearing each other (to be measured on real hardware or in the load test, M6).
- "Join without microphone", the `M` shortcut and the screen reader announcements are implemented but only checked
  by hand.

## Open questions

- None at the moment.
