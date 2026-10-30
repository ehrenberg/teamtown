import { Module } from '@nestjs/common';
import type { Clock, IdGenerator } from '@teamtown/kernel';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.ts';
import { CLOCK, ID_GENERATOR } from '../../platform/config/config.module.ts';
import { PresenceModule, PresenceQueries } from '../presence/public-api.ts';
import { FloorQueries, WorldModule } from '../world/public-api.ts';
import { ConversationMedia } from './application/conversation-media.ts';
import { ConversationQueries } from './application/conversation-queries.ts';
import { ConversationRegistry } from './application/conversation-registry.ts';
import { MeetingsEventStream } from './application/meetings-event-stream.ts';
import { FLOOR_ACOUSTICS_SOURCE, type FloorAcousticsSource } from './application/ports/floor-acoustics.port.ts';
import { LIVE_PRESENCE, type LivePresence } from './application/ports/live-presence.port.ts';
import { MEDIA_GATEWAY, type MediaGateway } from './application/ports/media-gateway.port.ts';
import { ReconcileMediaRooms } from './application/reconcile-media-rooms.ts';
import { RequestConversationToken } from './application/request-conversation-token.ts';
import { SetConversationLock } from './application/set-conversation-lock.ts';
import { UpdateConversations } from './application/update-conversations.ts';
import { LiveKitMediaGateway } from './infrastructure/livekit-media-gateway.ts';
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
      provide: LIVE_PRESENCE,
      useFactory: (presence: PresenceQueries) => new PresenceLivePositions(presence),
      inject: [PresenceQueries],
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
      ) => new UpdateConversations(presence, registry, media, events, clock),
      inject: [LIVE_PRESENCE, ConversationRegistry, ConversationMedia, MeetingsEventStream, CLOCK],
    },
    {
      provide: ReconcileMediaRooms,
      useFactory: (registry: ConversationRegistry, media: ConversationMedia) =>
        new ReconcileMediaRooms(registry, media),
      inject: [ConversationRegistry, ConversationMedia],
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
      useFactory: (registry: ConversationRegistry) => new ConversationQueries(registry),
      inject: [ConversationRegistry],
    },
    {
      provide: ProximityTicker,
      useFactory: (update: UpdateConversations, reconcile: ReconcileMediaRooms) =>
        new ProximityTicker(update, reconcile),
      inject: [UpdateConversations, ReconcileMediaRooms],
    },
  ],
  exports: [MeetingsEventStream, SetConversationLock, RequestConversationToken, ConversationQueries],
})
export class MeetingsModule {}
