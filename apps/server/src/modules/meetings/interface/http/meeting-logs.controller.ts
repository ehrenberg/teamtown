import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import type { MeetingLogListResponse } from '@teamtown/contracts';
import { AuthGuard, CurrentPrincipal, type Principal } from '../../../identity/public-api.ts';
import { PeopleQueries, ResolvePerson } from '../../../people/public-api.ts';
import { DeleteMeetingLog } from '../../application/delete-meeting-log.ts';
import { ListMyMeetingLogs } from '../../application/list-my-meeting-logs.ts';

/** Logged meetings one took part in (ADR-0026/0027). There is no endpoint that lists other people's logs. */
@Controller('meeting-logs')
@UseGuards(AuthGuard)
export class MeetingLogsController {
  constructor(
    @Inject(ResolvePerson) private readonly resolvePerson: ResolvePerson,
    @Inject(PeopleQueries) private readonly people: PeopleQueries,
    @Inject(ListMyMeetingLogs) private readonly listMine: ListMyMeetingLogs,
    @Inject(DeleteMeetingLog) private readonly deleteLog: DeleteMeetingLog,
  ) {}

  @Get()
  async list(@CurrentPrincipal() principal: Principal): Promise<MeetingLogListResponse> {
    const logs = await this.listMine.execute(await this.#personId(principal));
    const names = await this.people.namesOf([...new Set(logs.flatMap((log) => log.participants))]);
    return {
      logs: logs.map((log) => ({
        meetingId: log.meetingId,
        floorId: log.floorId,
        roomId: log.roomId,
        title: log.title,
        hostId: log.hostId,
        participants: log.participants.map((personId) => ({ personId, displayName: names.get(personId) ?? '' })),
        startedAt: log.startedAt.toISOString(),
        endedAt: log.endedAt?.toISOString() ?? null,
        expiresAt: log.expiresAt.toISOString(),
      })),
    };
  }

  @Delete(':meetingId')
  @HttpCode(204)
  async delete(@CurrentPrincipal() principal: Principal, @Param('meetingId') meetingId: string): Promise<void> {
    const result = await this.deleteLog.execute({ personId: await this.#personId(principal), meetingId });
    if (result.ok) return;
    if (result.error === 'not-found') throw new NotFoundException();
    throw new ForbiddenException(result.error);
  }

  async #personId(principal: Principal): Promise<string> {
    const person = await this.resolvePerson.execute(principal);
    if (!person.ok) throw new InternalServerErrorException(person.error);
    return person.value.personId;
  }
}
