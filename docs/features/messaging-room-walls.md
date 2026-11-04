# Feature: Room walls

- **Status:** Done (2026-11-02), except a screen-reader check (see below); the command-palette entry followed with [M3e](messaging-search.md)
- **Brainstorming ID:** M4 Room wall (room-linked channel)
- **Bounded context(s):** World, Messaging, REST, web client
- **Milestone:** M3c (ADR-0033)

## Problem / user value

As a team member, I want every room to keep a persistent conversation, so that messages, decisions and shared
links stay connected to that room even when nobody is currently there.

## Behaviour

1. **One wall per room.** Every published room has exactly one **room wall**, represented by a
   `Channel{kind: room}`. Its visible title is the room name, while its identity is the stable pair of `floorId`
   and `roomId`.
2. **Access.** Every authenticated member can read and post on every room wall (P-16). Access never depends on
   entering the room, current occupancy or room-entry history. The existing message, thread, mention, reaction,
   unread and realtime behaviour applies unchanged.
3. **Opening a wall.** Entering a room never replaces an open chat. The current room offers an explicit
   **Open room wall** action. Every room row in the non-spatial room list offers the same action and shows unread
   and mention counters for its wall (P-17).
4. **Lifecycle.** World publishes `RoomCreated`, `RoomRenamed` and `RoomDeleted`. Messaging handles them
   idempotently: create one wall, update its title, or archive it while keeping all messages (P-18, ADR-0018).
   An archived wall remains readable but takes no new messages.
5. **Existing floor plans.** On startup, Messaging reconciles all published rooms with room walls. This creates
   walls for floor plans imported before M3c and repairs a missed at-least-once lifecycle delivery without using
   presence data.
6. **Presentation.** Room walls do not appear under Channels. They are reached from room context and the room
   list. Their chat header says **Room wall** instead of showing a membership count; members cannot rename,
   archive, invite to or leave a room wall directly.

## Acceptance criteria

- [x] Given a published room, when room walls are reconciled or `RoomCreated` is handled repeatedly, then exactly
      one room wall exists for its `floorId` and `roomId`.
- [x] Given an authenticated member who has never entered a room, when they open that room's wall from the room
      list, then they can read its history and post a message.
- [x] Given an open channel or DM, when the member enters a room, then the open conversation remains unchanged.
- [x] Given a member in a room, when they activate **Open room wall**, then that room's wall opens in the chat
      panel.
- [x] Given `RoomRenamed`, when Messaging handles it, then the wall title changes and its history remains.
- [x] Given `RoomDeleted`, when Messaging handles it, then the wall is archived, remains readable and refuses new
      messages.
- [x] Given an unread room-wall message or mention, then the room row shows the existing numeric counter and
      shape-based unread indicator.
- [x] Non-spatial path: every room wall opens from the keyboard-accessible room list. The command-palette entry
      follows when the command palette is implemented.
- [ ] Accessibility: **Open room wall** has the room name in its accessible label; counters include screen-reader
      text; opening and using the chat panel remains keyboard accessible. _(Implemented and keyboard-reviewed;
      not yet checked with a screen reader.)_
- [x] i18n: all new UI and error strings exist in English and German, using German **du**.

## Permissions

No new permission is introduced. Until M4 room policies, every authenticated member receives `channel.read` and
`message.post` behaviour for every room wall (P-16). Existing own-message, thread and reaction rules still apply.
Room-wall lifecycle changes are system actions triggered by World, not user moderation actions.

## Domain changes

- Messaging extends `ChannelKind` with `room`.
- A room wall stores `floorId` and `roomId`; that pair is unique. It has a room title, no creator and no direct
  moderation actions.
- Room-wall read markers use the existing channel membership record. Reconciliation grants access to all existing
  profiles; a new profile is added on its first channel listing. This membership means messaging access only; it
  does not mean that the member entered or occupied the room.
- World lifecycle events carry only stable room identity and the current room name:
  `RoomCreated{floorId, roomId, name}`, `RoomRenamed{floorId, roomId, name}` and
  `RoomDeleted{floorId, roomId}`.
- World records persistent lifecycle events in its transactional outbox; Messaging handlers are idempotent
  (ADR-0018).

## API & realtime contracts

- Existing `GET /api/channels` returns room walls with `kind: room`, `floorId` and `roomId`. The web client places
  them in the room list rather than the Channels section.
- Existing channel message, thread, reaction and read-marker endpoints serve room walls unchanged.
- Existing Messaging realtime events (`ChannelChanged`, `MessagePosted`, `MessageEdited`, `MessageDeleted`,
  `ReadMarkerMoved`, `ReactionChanged`, `ThreadActivity`) update open room walls and their counters.
- World lifecycle events are internal domain events, not client realtime messages.

## Privacy impact

Room-wall channels, messages, reactions, thread follows and read markers are persisted exactly like other channel
content. No avatar position, path, room entry, room exit, occupancy or who-met-whom data is persisted or logged.
Opening and access are independent of presence (ADR-0012).

## UI / design

- The current room and each room-list row offer **Open room wall** / **Raum-Pinnwand öffnen**.
- Unread and mention counters reuse the channel badges: colour plus dot/icon and accessible text.
- The existing chat panel, composer, Markdown, threads, mentions and reactions are reused. No world-only control is
  required, so room walls remain fully usable without the 3D renderer.

## Open questions

None. P-16, P-17 and P-18 were decided by the product owner on 2026-11-02.
