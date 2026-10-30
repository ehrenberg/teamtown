// The only entry point other modules may import from the Presence context.
export { AdmitToRoom } from './application/admit-to-room.ts';
export { JoinFloor, type JoinFloorError } from './application/join-floor.ts';
export { LeavePresence } from './application/leave-presence.ts';
export { MoveTo } from './application/move-to.ts';
export { PresenceEventStream, type PresenceEventListener } from './application/presence-event-stream.ts';
export { PresenceQueries, type LiveDoorMode, type LivePosition } from './application/presence-queries.ts';
export { SetDoorMode, type SetDoorModeError } from './application/set-door-mode.ts';
export type { AdmitError, AvatarState, MoveError, Occupant, PresenceEvent } from './domain/floor-instance.ts';
export type { DoorMode } from './domain/room-doors.ts';
export { PresenceModule } from './presence.module.ts';
