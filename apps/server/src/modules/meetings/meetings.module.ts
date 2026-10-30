import { Module } from '@nestjs/common';
import type { Clock, IdGenerator } from '@teamtown/kernel';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.ts';
import { CLOCK, ID_GENERATOR } from '../../platform/config/config.module.ts';
import { MikroORM } from '@mikro-orm/postgresql';
import { PeopleModule } from '../people/public-api.ts';
import {
  AdmitToRoom,
  PresenceModule,
  PresenceQueries,
  SetRoomConsentRequired,
  WalkOutOfRoom,
} from '../presence/public-api.ts';
import { FloorQueries, WorldModule } from '../world/public-api.ts';
import { ActiveMeetingLogs } from './application/active-meeting-logs.ts';
import { AnswerCall } from './application/answer-call.ts';
import { AnswerMeetingLog } from './application/answer-meeting-log.ts';
import { DeleteMeetingLog } from './application/delete-meeting-log.ts';
import { EndMeetingLog } from './application/end-meeting-log.ts';
import { ListMyMeetingLogs } from './application/list-my-meeting-logs.ts';
import { MEETING_LOG_REPOSITORY, type MeetingLogRepository } from './application/ports/meeting-log-repository.port.ts';
import { PurgeExpiredMeetingLogs } from './application/purge-expired-meeting-logs.ts';
import { StartMeetingLog } from './application/start-meeting-log.ts';
import { UpdateMeetingLogs } from './application/update-meeting-logs.ts';
import { CallMembership } from './application/call-membership.ts';
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
import { StartScreenShare } from './application/start-screen-share.ts';
import { StopScreenShare } from './application/stop-screen-share.ts';
import { SyncScreenShares } from './application/sync-screen-shares.ts';
import { SetCamera } from './application/set-camera.ts';
import { StartCall } from './application/start-call.ts';
import { SyncCameras } from './application/sync-cameras.ts';
import { SetConversationLock } from './application/set-conversation-lock.ts';
import { UpdateConversations } from './application/update-conversations.ts';
import { UpdateDirectCalls } from './application/update-direct-calls.ts';
import { Cameras } from './domain/cameras.ts';
import { ScreenShares } from './domain/screen-shares.ts';
import { DirectCalls } from './domain/direct-calls.ts';
import { Knocks } from './domain/knocks.ts';
import { LiveKitMediaGateway } from './infrastructure/livekit-media-gateway.ts';
import { MeetingLogRetention } from './infrastructure/meeting-log-retention.ts';
import { MeetingLogEntity } from './infrastructure/persistence/meeting-log.entity.ts';
import { MEETINGS_MIGRATIONS } from './infrastructure/persistence/migrations/meetings-initial.migration.ts';
import { MikroOrmMeetingLogRepository } from './infrastructure/persistence/mikro-orm-meeting-log.repository.ts';
import { MeetingLogsController } from './interface/http/meeting-logs.controller.ts';
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
  imports: [WorldModule, PresenceModule, PeopleModule],
  controllers: [MeetingLogsController],
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
      useFactory: (
        presence: PresenceQueries,
        admit: AdmitToRoom,
        consent: SetRoomConsentRequired,
        walkOut: WalkOutOfRoom,
      ) => new PresenceLivePositions(presence, admit, consent, walkOut),
      inject: [PresenceQueries, AdmitToRoom, SetRoomConsentRequired, WalkOutOfRoom],
    },
    { provide: LIVE_PRESENCE, useExisting: PresenceLivePositions },
    { provide: ROOM_ADMISSION, useExisting: PresenceLivePositions },
    { provide: Cameras, useValue: new Cameras() },
    { provide: ActiveMeetingLogs, useValue: new ActiveMeetingLogs() },
    {
      provide: MEETING_LOG_REPOSITORY,
      useFactory: (orm: MikroORM) => new MikroOrmMeetingLogRepository(orm),
      inject: [MikroORM],
    },
    {
      provide: StartMeetingLog,
      useFactory: (
        membership: CallMembership,
        logs: ActiveMeetingLogs,
        repository: MeetingLogRepository,
        admission: RoomAdmission,
        events: MeetingsEventStream,
        clock: Clock,
        ids: IdGenerator,
        config: AppConfig,
      ) =>
        new StartMeetingLog(
          membership,
          logs,
          repository,
          admission,
          events,
          clock,
          ids,
          config.MEETING_LOG_RETENTION_DAYS,
        ),
      inject: [
        CallMembership,
        ActiveMeetingLogs,
        MEETING_LOG_REPOSITORY,
        ROOM_ADMISSION,
        MeetingsEventStream,
        CLOCK,
        ID_GENERATOR,
        APP_CONFIG,
      ],
    },
    {
      provide: AnswerMeetingLog,
      useFactory: (
        presence: LivePresence,
        logs: ActiveMeetingLogs,
        repository: MeetingLogRepository,
        admission: RoomAdmission,
        events: MeetingsEventStream,
        clock: Clock,
      ) => new AnswerMeetingLog(presence, logs, repository, admission, events, clock),
      inject: [LIVE_PRESENCE, ActiveMeetingLogs, MEETING_LOG_REPOSITORY, ROOM_ADMISSION, MeetingsEventStream, CLOCK],
    },
    {
      provide: EndMeetingLog,
      useFactory: (
        presence: LivePresence,
        logs: ActiveMeetingLogs,
        repository: MeetingLogRepository,
        admission: RoomAdmission,
        events: MeetingsEventStream,
        clock: Clock,
      ) => new EndMeetingLog(presence, logs, repository, admission, events, clock),
      inject: [LIVE_PRESENCE, ActiveMeetingLogs, MEETING_LOG_REPOSITORY, ROOM_ADMISSION, MeetingsEventStream, CLOCK],
    },
    {
      provide: UpdateMeetingLogs,
      useFactory: (
        presence: LivePresence,
        logs: ActiveMeetingLogs,
        repository: MeetingLogRepository,
        admission: RoomAdmission,
        events: MeetingsEventStream,
        clock: Clock,
      ) => new UpdateMeetingLogs(presence, logs, repository, admission, events, clock),
      inject: [LIVE_PRESENCE, ActiveMeetingLogs, MEETING_LOG_REPOSITORY, ROOM_ADMISSION, MeetingsEventStream, CLOCK],
    },
    {
      provide: ListMyMeetingLogs,
      useFactory: (repository: MeetingLogRepository) => new ListMyMeetingLogs(repository),
      inject: [MEETING_LOG_REPOSITORY],
    },
    {
      provide: DeleteMeetingLog,
      useFactory: (repository: MeetingLogRepository) => new DeleteMeetingLog(repository),
      inject: [MEETING_LOG_REPOSITORY],
    },
    {
      provide: PurgeExpiredMeetingLogs,
      useFactory: (repository: MeetingLogRepository, clock: Clock) => new PurgeExpiredMeetingLogs(repository, clock),
      inject: [MEETING_LOG_REPOSITORY, CLOCK],
    },
    {
      provide: MeetingLogRetention,
      useFactory: (purge: PurgeExpiredMeetingLogs) => new MeetingLogRetention(purge),
      inject: [PurgeExpiredMeetingLogs],
    },
    { provide: ScreenShares, useValue: new ScreenShares() },
    {
      provide: StartScreenShare,
      useFactory: (shares: ScreenShares, membership: CallMembership, events: MeetingsEventStream) =>
        new StartScreenShare(shares, membership, events),
      inject: [ScreenShares, CallMembership, MeetingsEventStream],
    },
    {
      provide: StopScreenShare,
      useFactory: (shares: ScreenShares, membership: CallMembership, events: MeetingsEventStream) =>
        new StopScreenShare(shares, membership, events),
      inject: [ScreenShares, CallMembership, MeetingsEventStream],
    },
    {
      provide: SyncScreenShares,
      useFactory: (shares: ScreenShares, membership: CallMembership, events: MeetingsEventStream) =>
        new SyncScreenShares(shares, membership, events),
      inject: [ScreenShares, CallMembership, MeetingsEventStream],
    },
    {
      provide: CallMembership,
      useFactory: (registry: ConversationRegistry, calls: DirectCalls) => new CallMembership(registry, calls),
      inject: [ConversationRegistry, DirectCalls],
    },
    {
      provide: SetCamera,
      useFactory: (cameras: Cameras, membership: CallMembership, events: MeetingsEventStream) =>
        new SetCamera(cameras, membership, events),
      inject: [Cameras, CallMembership, MeetingsEventStream],
    },
    {
      provide: SyncCameras,
      useFactory: (cameras: Cameras, membership: CallMembership, events: MeetingsEventStream) =>
        new SyncCameras(cameras, membership, events),
      inject: [Cameras, CallMembership, MeetingsEventStream],
    },
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
        logs: ActiveMeetingLogs,
      ) => new UpdateConversations(presence, registry, media, events, clock, calls, logs),
      inject: [
        LIVE_PRESENCE,
        ConversationRegistry,
        ConversationMedia,
        MeetingsEventStream,
        CLOCK,
        DirectCalls,
        ActiveMeetingLogs,
      ],
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
      useFactory: (registry: ConversationRegistry, calls: DirectCalls, cameras: Cameras, logs: ActiveMeetingLogs) =>
        new ConversationQueries(registry, calls, cameras, logs),
      inject: [ConversationRegistry, DirectCalls, Cameras, ActiveMeetingLogs],
    },
    {
      provide: ProximityTicker,
      useFactory: (
        update: UpdateConversations,
        reconcile: ReconcileMediaRooms,
        expire: ExpireKnocks,
        updateCalls: UpdateDirectCalls,
        syncCameras: SyncCameras,
        syncScreenShares: SyncScreenShares,
        updateLogs: UpdateMeetingLogs,
      ) => new ProximityTicker(update, reconcile, expire, updateCalls, syncCameras, syncScreenShares, updateLogs),
      inject: [
        UpdateConversations,
        ReconcileMediaRooms,
        ExpireKnocks,
        UpdateDirectCalls,
        SyncCameras,
        SyncScreenShares,
        UpdateMeetingLogs,
      ],
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
    SetCamera,
    StartScreenShare,
    StopScreenShare,
    StartMeetingLog,
    EndMeetingLog,
    AnswerMeetingLog,
    ConversationQueries,
  ],
})
export class MeetingsModule {
  static readonly entities = [MeetingLogEntity];
  static readonly migrations = MEETINGS_MIGRATIONS;
}
