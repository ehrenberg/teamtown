import { defineEntity, p } from '@mikro-orm/postgresql';

/** Consents as stored: ISO timestamps. */
export interface StoredConsent {
  readonly personId: string;
  readonly consentedAt: string;
}

/** Persistence record of a logged meeting (ADR-0026/0027). */
export const MeetingLogEntity = defineEntity({
  name: 'MeetingLogRecord',
  schema: 'meetings',
  tableName: 'meeting_log',
  properties: {
    meetingId: p.string().length(64).primary(),
    floorId: p.string().length(64),
    roomId: p.string().length(64),
    title: p.string().length(120),
    hostId: p.uuid(),
    consents: p.json<StoredConsent[]>(),
    startedAt: p.datetime(),
    endedAt: p.datetime().nullable(),
    expiresAt: p.datetime(),
  },
});

export class MeetingLogRecord extends MeetingLogEntity.class {}
MeetingLogEntity.setClass(MeetingLogRecord);
