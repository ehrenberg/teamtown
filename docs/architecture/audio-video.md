# Audio & Video

Decided: **LiveKit** as WebRTC SFU, including its built-in TURN ([ADR-0008](adr/0008-audio-video-livekit.md)).
TeamTown never handles media streams itself. It decides **who may hear and see whom**, and LiveKit
enforces it. The mapping below is decided ([ADR-0022](adr/0022-realtime-and-media-topology.md)).

## 1. Principle: the server controls subscriptions

LiveKit lets the server set per-participant **track subscription permissions**. Clients cannot
subscribe to tracks they were not granted, even with a modified client. That is the backbone of privacy
for locked rooms and private conversations.

## 2. Mapping TeamTown concepts to LiveKit rooms

| TeamTown concept                 | LiveKit room                                            | Who can hear whom                                                                                                                   |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Open floor space** (proximity) | One LiveKit room per **floor**: `floor:{floorId}`       | The Meetings module computes proximity groups (distance + line of sight through walls) and grants subscriptions only within a group |
| **Room call** (meeting room)     | One LiveKit room per **TeamTown room**: `room:{roomId}` | Everyone in the room. Entering or leaving the room = joining or leaving the LiveKit room.                                           |
| **Direct call**                  | `direct:{callId}`                                       | Caller and callee                                                                                                                   |
| **Town hall** (later)            | `stage:{roomId}`                                        | Speakers publish, audience subscribes only                                                                                          |

Why separate LiveKit rooms for meeting rooms: clean isolation, independent recording later, and
participants in a meeting never accidentally hear the floor.

## 3. Spatial audio

- **Server side:** decides _whether_ a track is audible (group membership, walls, locks).
- **Client side:** decides _how loud_. Volume follows the distance with a smooth falloff
  (proposal: full volume ≤ 2 tiles, silence at 6 tiles). Optional stereo panning via WebAudio `PannerNode`.
- **Hysteresis:** a conversation forms at distance ≤ 4 tiles and dissolves at > 6 tiles, so audio doesn't flicker at the edge.

## 4. Media defaults (proposal unless marked decided)

| Setting                                 | Default                                                                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Microphone when entering a conversation | Per-person setting, default **on** _(decided)_                                                                                                                                                   |
| Camera                                  | **off**, opt-in per conversation                                                                                                                                                                 |
| Video layout                            | Small video bubbles above avatars in proximity; a grid view in room calls                                                                                                                        |
| Screen share                            | Room calls and direct calls; shows on the room's wall screen in the world                                                                                                                        |
| Simulcast / adaptive stream             | On (LiveKit), so bandwidth scales with what is visible                                                                                                                                           |
| Logged meetings                         | Opt-in by the room host; metadata only (title, participants, times); each participant consents explicitly by clicking "Join"; retention configurable, default 90 days _(decided, ADR-0026/0027)_ |
| Recording                               | Not in the MVP. If added: explicit consent of all participants plus a visible indicator                                                                                                          |

## 5. Desktop specifics (Electron)

- A screen and window picker via `desktopCapturer` with our own picker UI.
- Global shortcut for push-to-talk and mute (proposal).
- On macOS, the camera, microphone and screen-recording permissions are requested with explanatory dialogs.
