# Audio & Video

Decided: **LiveKit** as WebRTC SFU, including its built-in TURN ([ADR-0008](adr/0008-audio-video-livekit.md)).
TeamTown never handles media streams itself. It decides **who may hear and see whom**, and LiveKit
enforces it. The mapping below is decided ([ADR-0022](adr/0022-realtime-and-media-topology.md)).

## 1. Principle: the server controls who is in which room

LiveKit can't grant subscriptions per track from the server (spike, ADR-0032). TeamTown therefore decides who
hears whom by **room membership**: the server issues LiveKit tokens only to the people who belong in a LiveKit
room, removes people who leave, and reconciles each room's participants. A modified client can't join a room
it has no token for.

## 2. Mapping TeamTown concepts to LiveKit rooms

| TeamTown concept             | LiveKit room                                                                      | Who can hear whom                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Proximity conversation**   | One LiveKit room per **conversation**: `conversation:{conversationId}` (ADR-0032) | The Meetings module computes conversations (distance + walls) and issues tokens only to their participants |
| **Room call** (meeting room) | One LiveKit room per **TeamTown room**: `room:{roomId}`                           | Everyone in the room. Entering or leaving the room = joining or leaving the LiveKit room.                  |
| **Direct call**              | `direct:{callId}`                                                                 | Caller and callee                                                                                          |
| **Town hall** (later)        | `stage:{roomId}`                                                                  | Speakers publish, audience subscribes only                                                                 |

Why separate LiveKit rooms for meeting rooms: clean isolation, independent recording later, and
participants in a meeting never accidentally hear the floor.

## 3. Spatial audio _(decided, ADR-0031)_

- **Server side:** decides _whether_ someone is audible (conversation membership, walls, locks) via LiveKit room membership.
- **Groups:** a conversation forms at a distance ≤ 4 tiles and dissolves at > 6 tiles (hysteresis, so audio
  doesn't flicker at the edge). Groups are transitive: if A is near B and B near C, all three hear each other.
  Every wall blocks sound, glass included; doors are openings. People in a conversation can lock it.
- **Client side:** decides _how loud_. Full volume ≤ 2 tiles, silence at 6 tiles with a smooth falloff,
  plus stereo panning via WebAudio `PannerNode` by the speaker's position on screen.
- **Isolated rooms:** rooms with `audioIsolated` have their own room call; proximity does not reach into them.

## 4. Media defaults (decided unless marked proposal)

| Setting                                 | Default                                                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Microphone when entering a conversation | Per-person setting, default **on**; permission asked when entering the office, with an audio check (ADR-0031)                                                                                    |
| Camera                                  | **off**, opt-in per conversation (ADR-0031)                                                                                                                                                      |
| Video layout                            | Small video bubbles above avatars in proximity; a grid view in room calls                                                                                                                        |
| Screen share                            | Room calls and direct calls; shows on the room's wall screen in the world                                                                                                                        |
| Simulcast / adaptive stream             | On (LiveKit), so bandwidth scales with what is visible                                                                                                                                           |
| Logged meetings                         | Opt-in by the room host; metadata only (title, participants, times); each participant consents explicitly by clicking "Join"; retention configurable, default 90 days _(decided, ADR-0026/0027)_ |
| Recording                               | Not in the MVP. If added: explicit consent of all participants plus a visible indicator                                                                                                          |

## 5. Desktop specifics (Electron)

- A screen and window picker via `desktopCapturer` with our own picker UI.
- Global shortcut for push-to-talk and mute (proposal).
- On macOS, the camera, microphone and screen-recording permissions are requested with explanatory dialogs.
