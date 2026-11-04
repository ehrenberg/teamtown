import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  AssignmentSchema,
  GroupNameRequest,
  type AccessOverviewResponse,
  type MyAccessResponse,
} from '@teamtown/contracts';
import type { Result } from '@teamtown/kernel';
import { parseRequest } from '../../../../platform/http/parse-request.ts';
import { AuthGuard, CurrentPrincipal, type Principal } from '../../../identity/public-api.ts';
import { ResolvePerson } from '../../../people/public-api.ts';
import { AdministerGroups, GetAccessOverview } from '../../application/administer-groups.ts';
import { AssignRole, GetMyAccess, RevokeRole } from '../../application/administer-roles.ts';

/** Maps a use-case error to its HTTP status; the code is the `message` (contracts: `AccessErrorCode`). */
function fail(code: string): never {
  if (code === 'not-found') throw new NotFoundException();
  if (code === 'not-allowed') throw new ForbiddenException(code);
  if (code === 'last-owner' || code === 'group-name-taken') throw new ConflictException(code);
  throw new BadRequestException(code);
}

function valueOf<T>(result: Result<T, string>): T {
  if (!result.ok) fail(result.error);
  return result.value;
}

/** Administration of roles and groups (M4b-1, ADR-0038). Each use case checks `town.roles.manage` or stricter. */
@Controller('access')
@UseGuards(AuthGuard)
export class AccessController {
  constructor(
    @Inject(ResolvePerson) private readonly resolvePerson: ResolvePerson,
    @Inject(GetMyAccess) private readonly getMyAccess: GetMyAccess,
    @Inject(GetAccessOverview) private readonly getOverview: GetAccessOverview,
    @Inject(AssignRole) private readonly assignRole: AssignRole,
    @Inject(RevokeRole) private readonly revokeRole: RevokeRole,
    @Inject(AdministerGroups) private readonly groups: AdministerGroups,
  ) {}

  @Get('me')
  async me(@CurrentPrincipal() principal: Principal): Promise<MyAccessResponse> {
    return this.getMyAccess.execute(await this.#personId(principal));
  }

  @Get('overview')
  async overview(@CurrentPrincipal() principal: Principal): Promise<AccessOverviewResponse> {
    const { assignments, groups } = valueOf(await this.getOverview.execute(await this.#personId(principal)));
    return { assignments, groups: groups.map((group) => ({ ...group, memberIds: [...group.memberIds] })) };
  }

  @Put('assignments')
  @HttpCode(204)
  async assign(@CurrentPrincipal() principal: Principal, @Body() body: unknown): Promise<void> {
    const assignment = parseRequest(AssignmentSchema, body);
    valueOf(await this.assignRole.execute({ actorId: await this.#personId(principal), assignment }));
  }

  @Delete('assignments')
  @HttpCode(204)
  async revoke(@CurrentPrincipal() principal: Principal, @Body() body: unknown): Promise<void> {
    const assignment = parseRequest(AssignmentSchema, body);
    valueOf(await this.revokeRole.execute({ actorId: await this.#personId(principal), assignment }));
  }

  @Post('groups')
  async createGroup(@CurrentPrincipal() principal: Principal, @Body() body: unknown): Promise<{ groupId: string }> {
    const { name } = parseRequest(GroupNameRequest, body);
    const groupId = valueOf(await this.groups.create({ actorId: await this.#personId(principal), name }));
    return { groupId };
  }

  @Patch('groups/:groupId')
  @HttpCode(204)
  async renameGroup(
    @CurrentPrincipal() principal: Principal,
    @Param('groupId') groupId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const { name } = parseRequest(GroupNameRequest, body);
    valueOf(await this.groups.rename({ actorId: await this.#personId(principal), groupId, name }));
  }

  @Delete('groups/:groupId')
  @HttpCode(204)
  async deleteGroup(@CurrentPrincipal() principal: Principal, @Param('groupId') groupId: string): Promise<void> {
    valueOf(await this.groups.delete({ actorId: await this.#personId(principal), groupId }));
  }

  @Put('groups/:groupId/members/:personId')
  @HttpCode(204)
  async addMember(
    @CurrentPrincipal() principal: Principal,
    @Param('groupId') groupId: string,
    @Param('personId') personId: string,
  ): Promise<void> {
    const actorId = await this.#personId(principal);
    valueOf(await this.groups.setMember({ actorId, groupId, personId, member: true }));
  }

  @Delete('groups/:groupId/members/:personId')
  @HttpCode(204)
  async removeMember(
    @CurrentPrincipal() principal: Principal,
    @Param('groupId') groupId: string,
    @Param('personId') personId: string,
  ): Promise<void> {
    const actorId = await this.#personId(principal);
    valueOf(await this.groups.setMember({ actorId, groupId, personId, member: false }));
  }

  async #personId(principal: Principal): Promise<string> {
    const person = await this.resolvePerson.execute(principal);
    if (!person.ok) throw new InternalServerErrorException(person.error);
    return person.value.personId;
  }
}
