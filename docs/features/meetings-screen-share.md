# Feature: Screen share

- **Status:** Done (2026-10-30)
- **Brainstorming ID:** C5 (screen on the wall)
- **Bounded context(s):** Meetings, realtime gateway
- **Milestone:** M2c, part 3 of 3 (direct call → camera → screen share; ADR-0031)

## Problem / user value

As a team member in a meeting or call, I want to show my screen, so that we can look at the same thing. As
someone in a meeting room, I want to see it on the room's wall screen, like in the real office.

## Behaviour

1. **Where.** Screen sharing works in room calls and direct calls, not in proximity conversations (ADR-0031). The
   "Share screen" button appears only there.
2. **One at a time.** Each call has at most one screen share. Whoever starts sharing takes over: the previous
   sharer's share stops, and they are told plainly (decided 2026-10-30).
3. **Who sees it.** Only the people in the same call receive the shared screen, exactly like audio and video.
   Everyone else sees nothing of it.
4. **Video panel.** The share appears as a large tile at the top of the collapsible video panel (above the camera
   tiles), with the sharer's name and a "Full screen" button. This works in every room call and in direct calls
   (decided 2026-10-30).
5. **Wall screen (C5).** If the room of a room call has a wall screen (`tv-wall`), the people in the call also see
   the share live on it in the world. Clicking the wall screen opens the share in full screen. Others on the
   floor see a dark screen.
6. **Stopping.** The sharer stops with the same button, or with the browser's own "Stop sharing". Leaving the call
   stops the share.
7. **Browser picker.** The browser asks which screen, window or tab to share. The desktop app's own picker
   (`desktopCapturer`) comes later, with the desktop polish in M6 (decided 2026-10-30).
8. **Screen audio** is not shared (video only).

## Acceptance criteria

- [x] Given a room call of two, when one shares the screen, then the other sees it in the video panel within 1 s,
      and nobody outside the call receives it. _(e2e `screen-share.spec.ts` without the 1 s budget; only members of
      a LiveKit room receive its tracks.)_
- [x] Given someone sharing, when another participant starts sharing, then the first share stops and its sharer
      is told.
- [x] Given a person sharing, when they leave the call, then the share stops for everyone. _(Unit tests.)_
- [x] Given a proximity conversation, then there is no "Share screen" button and the server refuses a share.
- [x] Given a room call in a room with a wall screen, then participants see the share on the wall screen; clicking
      it opens full screen. _(The picture on the wall is checked by screenshot; the click is checked by hand only.)_
- [x] Non-spatial path: the share is visible in the video panel with a "Full screen" button, by keyboard.
- [x] Accessibility: the share button has `aria-pressed`; the shared screen has a label with the sharer's name;
      starting and stopping a share is announced politely. _(Not yet checked with a screen reader.)_
- [x] i18n: all new strings in EN and DE.

## Permissions

`call.screenshare` (town scope) exists in the catalogue (`permissions.md`). Until M4, everyone in a room call or
direct call may share. No new permissions.

## Domain changes

- **Meetings (in memory):** the screen sharer per call (room call or direct call). Starting a share replaces the
  previous sharer; leaving the call ends the share. Event: `ScreenShareChanged`.
- **Media gateway:** tokens allow publishing a screen share besides microphone and camera.

## API & realtime contracts

- Commands: `StartScreenShare {}`, `StopScreenShare {}` (Nack `screen-share-not-here` outside room and direct
  calls).
- Event to the participants of the call: `ScreenShareChanged { sharer: personId | null }`.
- The shared screen itself flows through LiveKit only.

## Privacy impact

- The shared screen passes through LiveKit only and is never recorded. Only members of the call's LiveKit room
  receive it (ADR-0032); the wall screen shows it only to them.
- Nothing about screen shares is stored or logged; telemetry may count active shares only.

## UI / design

- Toolbar (room and direct calls): "Share screen" toggle (icon **and** text).
- Video panel: a large share tile above the camera tiles, with the sharer's name and "Full screen".
- World: the `tv-wall` in the call's room shows the share as a live picture for participants; a pointer cursor and
  a click open full screen.

## Not yet covered by automated tests

- The 1 s budget (M6), the click on the wall screen and full screen, and screen-reader announcements.
- In one of five e2e runs, the first "Share screen" did not start; the cause is not found yet.

## Open questions

- None at the moment.
