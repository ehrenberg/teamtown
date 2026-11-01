import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { PeopleListResponse } from '@teamtown/contracts';
import { AuthGuard } from '../../../identity/public-api.ts';
import { PeopleQueries } from '../../application/people-queries.ts';

/** Everyone in the town (name and colour only), e.g. to pick people for a DM. */
@Controller('people')
@UseGuards(AuthGuard)
export class PeopleController {
  constructor(@Inject(PeopleQueries) private readonly people: PeopleQueries) {}

  @Get()
  async list(): Promise<PeopleListResponse> {
    return { people: await this.people.everyone() };
  }
}
