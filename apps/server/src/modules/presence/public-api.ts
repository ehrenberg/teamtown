// The only entry point other modules may import from the Presence context.
export { JoinFloor, type JoinFloorError } from './application/join-floor.ts';
export { LeavePresence } from './application/leave-presence.ts';
export { MoveTo } from './application/move-to.ts';
export { PresenceEventStream, type PresenceEventListener } from './application/presence-event-stream.ts';
export { PresenceQueries, type LivePosition } from './application/presence-queries.ts';
export type { AvatarState, MoveError, Occupant, PresenceEvent } from './domain/floor-instance.ts';
export { PresenceModule } from './presence.module.ts';
