import { Controller, Get, Inject, InternalServerErrorException, UseGuards } from '@nestjs/common';
import type { MeResponse } from '@teamtown/contracts';
import { AuthGuard, CurrentPrincipal, type Principal } from '../../../identity/public-api.ts';
import { ResolvePerson } from '../../application/resolve-person.ts';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(@Inject(ResolvePerson) private readonly resolvePerson: ResolvePerson) {}

  @Get()
  async me(@CurrentPrincipal() principal: Principal): Promise<MeResponse> {
    const person = await this.resolvePerson.execute(principal);
    if (!person.ok) {
      // The identity provider delivered an unusable name; nothing the caller can fix.
      throw new InternalServerErrorException(person.error);
    }
    return person.value;
  }
}
