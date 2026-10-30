import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/public-api.ts';
import { PresenceModule } from '../presence/public-api.ts';
import { RealtimeGateway } from './interface/ws/realtime.gateway.ts';

/** Driving adapter: WebSocket transport for presence (and later meetings and live notifications). */
@Module({
  imports: [PeopleModule, PresenceModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
