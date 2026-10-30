import { Module } from '@nestjs/common';
import { MeetingsModule } from '../meetings/public-api.ts';
import { PeopleModule } from '../people/public-api.ts';
import { PresenceModule } from '../presence/public-api.ts';
import { RealtimeGateway } from './interface/ws/realtime.gateway.ts';

/** Driving adapter: WebSocket transport for presence and meetings (later also live notifications). */
@Module({
  imports: [PeopleModule, PresenceModule, MeetingsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
