# Feature: Camera

- **Status:** Done (2026-10-30)
- **Brainstorming ID:** — (camera on/off is part of the MVP A/V scope, `mvp-scope.md`)
- **Bounded context(s):** Meetings, realtime gateway
- **Milestone:** M2c, part 2 of 3 (direct call → camera → screen share; ADR-0031)

## Problem / user value

As a team member, I want to switch my camera on in a conversation or call, so that we can see each other when it
helps, without being on camera by default.

## Behaviour

1. **Off by default, opt-in per call.** The camera is always off when a person enters a proximity conversation, a
   room call or a direct call. A "Camera" button switches it on and off while one is in such a call. Leaving the
   conversation or call switches it off again; in the next one it starts off (ADR-0031, decided 2026-10-30).
2. **Who sees the video.** Only the people in the same conversation or call receive the video, exactly like the
   audio: the server grants camera publishing in the same LiveKit room and nowhere else. Everyone on the floor sees
   a camera icon at the avatar of people whose camera is on, but no picture.
3. **Proximity conversations: video bubbles.** Above the avatar of each participant with the camera on, a round
   video bubble appears for the other participants. Its size and opacity follow the distance like the volume:
   full up to 2 tiles, smallest and faintest at 6 tiles (decided 2026-10-30). One's own picture shows as a small
   preview in the toolbar.
4. **Room calls and direct calls: video grid.** A collapsible panel at the top of the world view shows a grid of
   everyone in the call with the camera on, including one's own picture, each with name and muted icon. The world
   stays visible below it; the panel opens on its own when the first camera goes on and can be collapsed.
5. **Camera permission.** The browser asks for the camera the first time it is switched on. If it is denied or
   there is no camera, the button says so plainly and stays off.
6. **Bandwidth.** Simulcast and adaptive stream are on (`audio-video.md`), so small bubbles get small layers.

## Acceptance criteria

- [x] Given two people in a conversation, when one switches the camera on, then the other sees the video above
      their avatar within 1 s, and someone on the floor outside the conversation receives no video but sees the
      camera icon. _(e2e `camera.spec.ts` without the 1 s budget; only members of a LiveKit room receive any of
      its tracks, as tested for audio against a real LiveKit server.)_
- [x] Given a person with the camera on, when they leave the conversation or call, then the camera goes off; in
      the next conversation it is off until switched on again.
- [x] Given a room call or direct call with two cameras on, then the grid panel shows both pictures with names, and
      it can be collapsed and opened again. _(e2e with one camera.)_
- [x] Given a video bubble, when the speaker walks from 2 to 6 tiles away, then the bubble shrinks and fades.
      _(Unit test of the size rule.)_
- [x] Given a modified client that publishes a camera track in a room it doesn't belong to, then it is removed as
      for audio (existing reconciliation).
- [ ] Given the camera permission is denied, then the button shows "No camera" and the person stays in the call
      with audio. _(Implemented; not yet checked, neither automatically nor by hand.)_
- [x] Non-spatial path: the camera works in room calls and direct calls through the grid panel, by keyboard.
- [x] Accessibility: the camera button has `aria-pressed`; videos have the person's name as label; the grid toggle
      has `aria-expanded`.
- [x] i18n: all new strings in EN and DE.

## Permissions

`call.video` (town scope) exists in the catalogue (`permissions.md`). Until M4, everyone in a call may switch
their camera on. No new permissions.

## Domain changes

- **Meetings (in memory):** who has the camera on. Switching on is only possible while in a conversation, room
  call or direct call; when a person's call changes or ends, their camera is switched off. Event:
  `CameraChanged`.
- **Media gateway:** tokens allow publishing the camera besides the microphone.

## API & realtime contracts

- Command: `SetCamera { on }` (Nack `not-in-call` outside a call).
- Event to everyone on the person's floor: `CameraChanged { floorId, personId, on }`; `FloorSnapshot` gains
  `cameraOn: personId[]`.
- Video itself flows through LiveKit only.

## Privacy impact

- Video passes through LiveKit only and is never recorded. Only members of the same LiveKit room receive it; the
  server's tokens, removal and reconciliation enforce that (ADR-0032).
- Outside the call, people only learn _that_ someone's camera is on.
- Nothing about cameras is stored or logged; telemetry may count active cameras only.

## UI / design

- Toolbar: "Camera" toggle next to the microphone (icon **and** text; "No camera" when unavailable), with a small
  self-preview while on.
- World: round video bubbles above avatars (DOM overlay like the name labels), size and opacity by distance; a
  camera icon in the name label for people with the camera on.
- Grid panel at the top of the world view for room calls and direct calls: tiles with name and muted icon,
  collapse toggle.

## Not yet covered by automated tests

- The 1 s budget (M6), a denied camera permission, and a grid with several cameras.

## Open questions

- None at the moment.
