import type { MikroORM } from '@mikro-orm/postgresql';
import type { MeetingLogRepository } from '../../application/ports/meeting-log-repository.port.ts';
import { MeetingLog } from '../../domain/meeting-log.ts';
import { MeetingLogRecord } from './meeting-log.entity.ts';

export class MikroOrmMeetingLogRepository implements MeetingLogRepository {
  constructor(private readonly orm: MikroORM) {}

  async save(log: MeetingLog): Promise<void> {
    const em = this.orm.em.fork();
    const { props } = log;
    const values = {
      floorId: props.floorId,
      roomId: props.roomId,
      title: props.title,
      hostId: props.hostId,
      consents: props.consents.map((c) => ({ personId: c.personId, consentedAt: c.consentedAt.toISOString() })),
      startedAt: props.startedAt,
      endedAt: props.endedAt,
      expiresAt: props.expiresAt,
    };
    const record = await em.findOne(MeetingLogRecord, { meetingId: props.meetingId });
    if (record) Object.assign(record, values);
    else em.create(MeetingLogRecord, { meetingId: props.meetingId, ...values });
    await em.flush();
  }

  async findById(meetingId: string): Promise<MeetingLog | null> {
    const record = await this.orm.em.fork().findOne(MeetingLogRecord, { meetingId });
    return record ? toDomain(record) : null;
  }

  async listForParticipant(personId: string): Promise<MeetingLog[]> {
    const em = this.orm.em.fork();
    // jsonb containment, served by the GIN index on "consents".
    const rows = await em.execute<{ meeting_id: string }[]>(
      'select "meeting_id" from "meetings"."meeting_log" where "consents" @> ?::jsonb',
      [JSON.stringify([{ personId }])],
    );
    if (rows.length === 0) return [];
    const records = await em.find(
      MeetingLogRecord,
      { meetingId: { $in: rows.map((row) => row.meeting_id) } },
      { orderBy: { startedAt: 'desc' } },
    );
    return records.map(toDomain);
  }

  async delete(meetingId: string): Promise<void> {
    await this.orm.em.fork().nativeDelete(MeetingLogRecord, { meetingId });
  }

  async deleteExpired(now: Date): Promise<number> {
    return this.orm.em.fork().nativeDelete(MeetingLogRecord, { expiresAt: { $lt: now } });
  }
}

function toDomain(record: MeetingLogRecord): MeetingLog {
  return MeetingLog.restore({
    meetingId: record.meetingId,
    floorId: record.floorId,
    roomId: record.roomId,
    title: record.title,
    hostId: record.hostId,
    consents: record.consents.map((c) => ({ personId: c.personId, consentedAt: new Date(c.consentedAt) })),
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? null,
    expiresAt: record.expiresAt,
  });
}
