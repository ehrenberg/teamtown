import { Module } from '@nestjs/common';
import type { Clock, IdGenerator } from '@teamtown/kernel';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.ts';
import { CLOCK, ID_GENERATOR } from '../../platform/config/config.module.ts';
import { AdmitToRoom, PresenceModule, PresenceQueries } from '../presence/public-api.ts';
import { FloorQueries, WorldModule } from '../world/public-api.ts';
import { AnswerCall } from './application/answer-call.ts';
import { AnswerKnock } from './application/answer-knock.ts';
import { CancelKnock } from './application/cancel-knock.ts';
import { ConversationMedia } from './application/conversation-media.ts';
import { ConversationQueries } from './application/conversation-queries.ts';
import { ConversationRegistry } from './application/conversation-registry.ts';
import { DirectCallMedia } from './application/direct-call-media.ts';
import { ExpireKnocks } from './application/expire-knocks.ts';
import { InviteToCall } from './application/invite-to-call.ts';
import { KnockOnRoom } from './application/knock-on-room.ts';
import { LeaveCall } from './application/leave-call.ts';
import { MeetingsEventStream } from './application/meetings-event-stream.ts';
import { FLOOR_ACOUSTICS_SOURCE, type FloorAcousticsSource } from './application/ports/floor-acoustics.port.ts';
import { LIVE_PRESENCE, type LivePresence } from './application/ports/live-presence.port.ts';
import { MEDIA_GATEWAY, type MediaGateway } from './application/ports/media-gateway.port.ts';
import { ReconcileMediaRooms } from './application/reconcile-media-rooms.ts';
import { ROOM_ADMISSION, type RoomAdmission } from './application/ports/room-admission.port.ts';
import { RequestConversationToken } from './application/request-conversation-token.ts';
import { RequestDirectCallToken } from './application/request-direct-call-token.ts';
import { RequestRoomCallToken } from './application/request-room-call-token.ts';
import { StartCall } from './application/start-call.ts';
import { SetConversationLock } from './application/set-conversation-lock.ts';
import { UpdateConversations } from './application/update-conversations.ts';
import { UpdateDirectCalls } from './application/update-direct-calls.ts';
import { DirectCalls } from './domain/direct-calls.ts';
import { Knocks } from './domain/knocks.ts';
import { LiveKitMediaGateway } from './infrastructure/livekit-media-gateway.ts';
import { MeetingsTelemetry } from './infrastructure/meetings-telemetry.ts';
import { PresenceLivePositions } from './infrastructure/presence-live-positions.ts';
import { ProximityTicker } from './infrastructure/proximity-ticker.ts';
import { WorldFloorAcoustics } from './infrastructure/world-floor-acoustics.ts';

const mediaGateway = (config: AppConfig): MediaGateway | null => {
  const { LIVEKIT_URL, LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = config;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return null;
  return new LiveKitMediaGateway({
    clientUrl: LIVEKIT_URL,
    apiUrl: LIVEKIT_API_URL ?? LIVEKIT_URL.replace(/^ws/, 'http'),
    apiKey: LIVEKIT_API_KEY,
    apiSecret: LIVEKIT_API_SECRET,
  });
};

/** In memory only: who talks with whom is never persisted (ADR-0012). */
@Module({
  imports: [WorldModule, PresenceModule],
  providers: [
    { provide: MeetingsEventStream, useValue: new MeetingsEventStream() },
    { provide: MEDIA_GATEWAY, useFactory: mediaGateway, inject: [APP_CONFIG] },
    {
      provide: FLOOR_ACOUSTICS_SOURCE,
      useFactory: (floors: FloorQueries) => new WorldFloorAcoustics(floors),
      inject: [FloorQueries],
    },
    {
      provide: PresenceLivePositions,
      useFactory: (presence: PresenceQueries, admit: AdmitToRoom) => new PresenceLivePositions(presence, admit),
      inject: [PresenceQueries, AdmitToRoom],
    },
    { provide: LIVE_PRESENCE, useExisting: PresenceLivePositions },
    { provide: ROOM_ADMISSION, useExisting: PresenceLivePositions },
    {
      provide: DirectCalls,
      useFactory: (ids: IdGenerator) => new DirectCalls(() => ids.next()),
      inject: [ID_GENERATOR],
    },
    {
      provide: DirectCallMedia,
      useFactory: (gateway: MediaGateway | null, events: MeetingsEventStream) => new DirectCallMedia(gateway, events),
      inject: [MEDIA_GATEWAY, MeetingsEventStream],
    },
    {
      provide: StartCall,
      useFactory: (
        presence: LivePresence,
        calls: DirectCalls,
        media: DirectCallMedia,
        events: MeetingsEventStream,
        clock: Clock,
      ) => new StartCall(presence, calls, media, events, clock),
      inject: [LIVE_PRESENCE, DirectCalls, DirectCallMedia, MeetingsEventStream, CLOCK],
    },
    {
      provide: InviteToCall,
      useFactory: (
        presence: LivePresence,
        calls: DirectCalls,
        media: DirectCallMedia,
        events: MeetingsEventStream,
        clock: Clock,
      ) => new InviteToCall(presence, calls, media, events, clock),
      inject: [LIVE_PRESENCE, DirectCalls, DirectCallMedia, MeetingsEventStream, CLOCK],
    },
    {
      provide: AnswerCall,
      useFactory: (calls: DirectCalls, media: DirectCallMedia, events: MeetingsEventStream) =>
        new AnswerCall(calls, media, events),
      inject: [DirectCalls, DirectCallMedia, MeetingsEventStream],
    },
    {
      provide: LeaveCall,
      useFactory: (calls: DirectCalls, media: DirectCallMedia, events: MeetingsEventStream) =>
        new LeaveCall(calls, media, events),
      inject: [DirectCalls, DirectCallMedia, MeetingsEventStream],
    },
    {
      provide: UpdateDirectCalls,
      useFactory: (
        presence: LivePresence,
        calls: DirectCalls,
        media: DirectCallMedia,
        events: MeetingsEventStream,
        clock: Clock,
      ) => new UpdateDirectCalls(presence, calls, media, events, clock),
      inject: [LIVE_PRESENCE, DirectCalls, DirectCallMedia, MeetingsEventStream, CLOCK],
    },
    {
      provide: RequestDirectCallToken,
      useFactory: (calls: DirectCalls, media: DirectCallMedia) => new RequestDirectCallToken(calls, media),
      inject: [DirectCalls, DirectCallMedia],
    },
    { provide: Knocks, useFactory: (ids: IdGenerator) => new Knocks(() => ids.next()), inject: [ID_GENERATOR] },
    {
      provide: MeetingsTelemetry,
      useFactory: (registry: ConversationRegistry, knocks: Knocks) => new MeetingsTelemetry(registry, knocks),
      inject: [ConversationRegistry, Knocks],
    },
    {
      provide: KnockOnRoom,
      useFactory: (presence: LivePresence, knocks: Knocks, events: MeetingsEventStream, clock: Clock) =>
        new KnockOnRoom(presence, knocks, events, clock),
      inject: [LIVE_PRESENCE, Knocks, MeetingsEventStream, CLOCK],
    },
    {
      provide: AnswerKnock,
      useFactory: (presence: LivePresence, admission: RoomAdmission, knocks: Knocks, events: MeetingsEventStream) =>
        new AnswerKnock(presence, admission, knocks, events),
      inject: [LIVE_PRESENCE, ROOM_ADMISSION, Knocks, MeetingsEventStream],
    },
    {
      provide: CancelKnock,
      useFactory: (presence: LivePresence, knocks: Knocks, events: MeetingsEventStream) =>
        new CancelKnock(presence, knocks, events),
      inject: [LIVE_PRESENCE, Knocks, MeetingsEventStream],
    },
    {
      provide: ExpireKnocks,
      useFactory: (presence: LivePresence, knocks: Knocks, events: MeetingsEventStream, clock: Clock) =>
        new ExpireKnocks(presence, knocks, events, clock),
      inject: [LIVE_PRESENCE, Knocks, MeetingsEventStream, CLOCK],
    },
    {
      provide: RequestRoomCallToken,
      useFactory: (presence: LivePresence, registry: ConversationRegistry, media: ConversationMedia) =>
        new RequestRoomCallToken(presence, registry, media),
      inject: [LIVE_PRESENCE, ConversationRegistry, ConversationMedia],
    },
    {
      provide: ConversationRegistry,
      useFactory: (source: FloorAcousticsSource, ids: IdGenerator) => new ConversationRegistry(source, ids),
      inject: [FLOOR_ACOUSTICS_SOURCE, ID_GENERATOR],
    },
    {
      provide: ConversationMedia,
      useFactory: (gateway: MediaGateway | null, events: MeetingsEventStream) => new ConversationMedia(gateway, events),
      inject: [MEDIA_GATEWAY, MeetingsEventStream],
    },
    {
      provide: UpdateConversations,
      useFactory: (
        presence: LivePresence,
        registry: ConversationRegistry,
        media: ConversationMedia,
        events: MeetingsEventStream,
        clock: Clock,
        calls: DirectCalls,
      ) => new UpdateConversations(presence, registry, media, events, clock, calls),
      inject: [LIVE_PRESENCE, ConversationRegistry, ConversationMedia, MeetingsEventStream, CLOCK, DirectCalls],
    },
    {
      provide: ReconcileMediaRooms,
      useFactory: (registry: ConversationRegistry, media: ConversationMedia, calls: DirectCalls) =>
        new ReconcileMediaRooms(registry, media, calls),
      inject: [ConversationRegistry, ConversationMedia, DirectCalls],
    },
    {
      provide: SetConversationLock,
      useFactory: (registry: ConversationRegistry, events: MeetingsEventStream) =>
        new SetConversationLock(registry, events),
      inject: [ConversationRegistry, MeetingsEventStream],
    },
    {
      provide: RequestConversationToken,
      useFactory: (registry: ConversationRegistry, media: ConversationMedia) =>
        new RequestConversationToken(registry, media),
      inject: [ConversationRegistry, ConversationMedia],
    },
    {
      provide: ConversationQueries,
      useFactory: (registry: ConversationRegistry, calls: DirectCalls) => new ConversationQueries(registry, calls),
      inject: [ConversationRegistry, DirectCalls],
    },
    {
      provide: ProximityTicker,
      useFactory: (
        update: UpdateConversations,
        reconcile: ReconcileMediaRooms,
        expire: ExpireKnocks,
        updateCalls: UpdateDirectCalls,
      ) => new ProximityTicker(update, reconcile, expire, updateCalls),
      inject: [UpdateConversations, ReconcileMediaRooms, ExpireKnocks, UpdateDirectCalls],
    },
  ],
  exports: [
    MeetingsEventStream,
    SetConversationLock,
    RequestConversationToken,
    RequestRoomCallToken,
    KnockOnRoom,
    AnswerKnock,
    CancelKnock,
    StartCall,
    InviteToCall,
    AnswerCall,
    LeaveCall,
    RequestDirectCallToken,
    ConversationQueries,
  ],
})
export class MeetingsModule {}
