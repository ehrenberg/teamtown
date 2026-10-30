import { Module } from '@nestjs/common';
import type { Clock } from '@teamtown/kernel';
import { CLOCK } from '../../platform/config/config.module.ts';
import { FloorQueries, WorldModule } from '../world/public-api.ts';
import { AdmitToRoom } from './application/admit-to-room.ts';
import { FloorRegistry } from './application/floor-registry.ts';
import { JoinFloor } from './application/join-floor.ts';
import { LeavePresence } from './application/leave-presence.ts';
import { MoveTo } from './application/move-to.ts';
import { FLOOR_SOURCE, type FloorSource } from './application/ports/floor-source.port.ts';
import { PresenceEventStream } from './application/presence-event-stream.ts';
import { PresenceQueries } from './application/presence-queries.ts';
import { SetRoomConsentRequired, WalkOutOfRoom } from './application/room-consent.ts';
import { SetDoorMode } from './application/set-door-mode.ts';
import { UpdateRooms } from './application/update-rooms.ts';
import { RoomTicker } from './infrastructure/room-ticker.ts';
import { WorldFloorSource } from './infrastructure/world-floor-source.ts';

/** Live presence. Deliberately has no persistence adapter (ADR-0012, enforced by `pnpm arch`). */
@Module({
  imports: [WorldModule],
  providers: [
    {
      provide: FLOOR_SOURCE,
      useFactory: (floors: FloorQueries) => new WorldFloorSource(floors),
      inject: [FloorQueries],
    },
    { provide: FloorRegistry, useFactory: (source: FloorSource) => new FloorRegistry(source), inject: [FLOOR_SOURCE] },
    { provide: PresenceEventStream, useValue: new PresenceEventStream() },
    {
      provide: JoinFloor,
      useFactory: (registry: FloorRegistry, events: PresenceEventStream, clock: Clock) =>
        new JoinFloor(registry, events, clock),
      inject: [FloorRegistry, PresenceEventStream, CLOCK],
    },
    {
      provide: MoveTo,
      useFactory: (registry: FloorRegistry, events: PresenceEventStream, clock: Clock) =>
        new MoveTo(registry, events, clock),
      inject: [FloorRegistry, PresenceEventStream, CLOCK],
    },
    {
      provide: LeavePresence,
      useFactory: (registry: FloorRegistry, events: PresenceEventStream) => new LeavePresence(registry, events),
      inject: [FloorRegistry, PresenceEventStream],
    },
    {
      provide: SetDoorMode,
      useFactory: (registry: FloorRegistry, events: PresenceEventStream, clock: Clock) =>
        new SetDoorMode(registry, events, clock),
      inject: [FloorRegistry, PresenceEventStream, CLOCK],
    },
    {
      provide: AdmitToRoom,
      useFactory: (registry: FloorRegistry, events: PresenceEventStream, clock: Clock) =>
        new AdmitToRoom(registry, events, clock),
      inject: [FloorRegistry, PresenceEventStream, CLOCK],
    },
    {
      provide: UpdateRooms,
      useFactory: (registry: FloorRegistry, events: PresenceEventStream, clock: Clock) =>
        new UpdateRooms(registry, events, clock),
      inject: [FloorRegistry, PresenceEventStream, CLOCK],
    },
    {
      provide: SetRoomConsentRequired,
      useFactory: (registry: FloorRegistry, events: PresenceEventStream, clock: Clock) =>
        new SetRoomConsentRequired(registry, events, clock),
      inject: [FloorRegistry, PresenceEventStream, CLOCK],
    },
    {
      provide: WalkOutOfRoom,
      useFactory: (registry: FloorRegistry, events: PresenceEventStream, clock: Clock) =>
        new WalkOutOfRoom(registry, events, clock),
      inject: [FloorRegistry, PresenceEventStream, CLOCK],
    },
    { provide: RoomTicker, useFactory: (update: UpdateRooms) => new RoomTicker(update), inject: [UpdateRooms] },
    {
      provide: PresenceQueries,
      useFactory: (registry: FloorRegistry, clock: Clock) => new PresenceQueries(registry, clock),
      inject: [FloorRegistry, CLOCK],
    },
  ],
  exports: [
    JoinFloor,
    MoveTo,
    LeavePresence,
    SetDoorMode,
    AdmitToRoom,
    SetRoomConsentRequired,
    WalkOutOfRoom,
    PresenceEventStream,
    PresenceQueries,
  ],
})
export class PresenceModule {}
