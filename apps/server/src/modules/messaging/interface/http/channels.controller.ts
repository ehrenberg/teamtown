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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AddMembersRequest,
  CreateChannelRequest,
  MessageBodyRequest,
  MessagePageQuery,
  MoveReadMarkerRequest,
  MoveThreadReadMarkerRequest,
  OpenDirectMessageRequest,
  PostMessageRequest,
  UpdateChannelRequest,
  type BrowseChannelsResponse,
  type ChannelListResponse,
  type ChannelSummary,
  type MessageContract,
  type MessagePageResponse,
  type ThreadListResponse,
} from '@teamtown/contracts';
import type { Result } from '@teamtown/kernel';
import { parseRequest } from '../../../../platform/http/parse-request.ts';
import { AuthGuard, CurrentPrincipal, type Principal } from '../../../identity/public-api.ts';
import { ResolvePerson } from '../../../people/public-api.ts';
import { AddChannelMembers } from '../../application/add-channel-members.ts';
import { BrowseChannels } from '../../application/browse-channels.ts';
import { CreateChannel } from '../../application/create-channel.ts';
import { DeleteMessage } from '../../application/delete-message.ts';
import { EditMessage } from '../../application/edit-message.ts';
import { GetChannel } from '../../application/get-channel.ts';
import { LeaveChannel } from '../../application/leave-channel.ts';
import { ListMessages } from '../../application/list-messages.ts';
import { ListMyChannels } from '../../application/list-my-channels.ts';
import { ListReplies } from '../../application/list-replies.ts';
import { ListThreads } from '../../application/list-threads.ts';
import { MoveReadMarker } from '../../application/move-read-marker.ts';
import { OpenDirectMessage } from '../../application/open-direct-message.ts';
import type { ChannelOverview } from '../../application/ports/channel-repository.port.ts';
import type { MessagePage, ThreadSummary } from '../../application/ports/message-repository.port.ts';
import { PostMessage } from '../../application/post-message.ts';
import { ReactToMessage } from '../../application/react-to-message.ts';
import { MoveThreadReadMarker, SetThreadFollowing } from '../../application/thread-follows.ts';
import { UpdateChannel } from '../../application/update-channel.ts';
import type { Channel } from '../../domain/channel.ts';
import type { Message } from '../../domain/message.ts';

const FORBIDDEN = new Set([
  'not-channel-creator',
  'not-channel-member',
  'not-message-author',
  'cannot-invite',
  'cannot-leave-channel',
]);
const CONFLICT = new Set(['channel-name-taken', 'channel-archived', 'too-many-reactions']);

/** Maps a use-case error to its HTTP status; the code is the `message` (contracts: `MessagingErrorCode`). */
function fail(code: string): never {
  if (code === 'not-found') throw new NotFoundException();
  if (FORBIDDEN.has(code)) throw new ForbiddenException(code);
  if (CONFLICT.has(code)) throw new ConflictException(code);
  throw new BadRequestException(code);
}

function valueOf<T>(result: Result<T, string>): T {
  if (!result.ok) fail(result.error);
  return result.value;
}

const toSummary = (
  personId: string,
  { channel, unreadCount, mentionCount, lastMessageAt }: ChannelOverview,
): ChannelSummary => ({
  channelId: channel.props.channelId,
  kind: channel.isDirect ? 'direct' : (channel.props.kind as 'public' | 'private'),
  group: channel.props.kind === 'group',
  name: channel.props.name,
  creatorId: channel.props.creatorId,
  members: channel.memberIds,
  archived: channel.isArchived,
  unreadCount,
  mentionCount,
  lastMessageAt: lastMessageAt?.toISOString() ?? null,
  readMarker: channel.membershipOf(personId)?.readMarker?.messageId ?? null,
});

const toMessage = (message: Message, thread?: ThreadSummary | null): MessageContract => ({
  ...message.snapshot,
  thread: thread
    ? {
        replyCount: thread.replyCount,
        lastReplyAt: thread.lastReplyAt.toISOString(),
        replierIds: [...thread.replierIds],
      }
    : null,
});

/** A page oldest first, as the client shows it. */
const toPage = (page: MessagePage): MessagePageResponse => ({
  messages: page.messages.map((message) => toMessage(message, page.threads.get(message.props.messageId))).reverse(),
  hasMore: page.hasMore,
});

/**
 * Channels and DMs (M3a, ADR-0033). Writes go over REST; members hear of them over the WebSocket
 * (docs/architecture/world-and-realtime.md §5). Channels one may not read answer 404, never 403.
 */
@Controller()
@UseGuards(AuthGuard)
export class ChannelsController {
  constructor(
    @Inject(ResolvePerson) private readonly resolvePerson: ResolvePerson,
    @Inject(ListMyChannels) private readonly listMine: ListMyChannels,
    @Inject(GetChannel) private readonly getChannel: GetChannel,
    @Inject(BrowseChannels) private readonly browseChannels: BrowseChannels,
    @Inject(CreateChannel) private readonly createChannel: CreateChannel,
    @Inject(UpdateChannel) private readonly updateChannel: UpdateChannel,
    @Inject(AddChannelMembers) private readonly addMembers: AddChannelMembers,
    @Inject(LeaveChannel) private readonly leaveChannel: LeaveChannel,
    @Inject(OpenDirectMessage) private readonly openDirectMessage: OpenDirectMessage,
    @Inject(ListMessages) private readonly listMessages: ListMessages,
    @Inject(PostMessage) private readonly postMessage: PostMessage,
    @Inject(EditMessage) private readonly editMessage: EditMessage,
    @Inject(DeleteMessage) private readonly deleteMessage: DeleteMessage,
    @Inject(MoveReadMarker) private readonly moveReadMarker: MoveReadMarker,
    @Inject(ListReplies) private readonly listReplies: ListReplies,
    @Inject(ReactToMessage) private readonly reactToMessage: ReactToMessage,
    @Inject(ListThreads) private readonly listThreads: ListThreads,
    @Inject(SetThreadFollowing) private readonly setThreadFollowing: SetThreadFollowing,
    @Inject(MoveThreadReadMarker) private readonly moveThreadReadMarker: MoveThreadReadMarker,
  ) {}

  @Get('channels')
  async list(@CurrentPrincipal() principal: Principal): Promise<ChannelListResponse> {
    const personId = await this.#personId(principal);
    const overviews = await this.listMine.execute(personId);
    return { channels: overviews.map((overview) => toSummary(personId, overview)) };
  }

  @Get('channels/browse')
  async browse(@CurrentPrincipal() principal: Principal): Promise<BrowseChannelsResponse> {
    const personId = await this.#personId(principal);
    const channels = await this.browseChannels.execute();
    return {
      channels: channels.map((channel) => ({
        channelId: channel.props.channelId,
        name: channel.props.name ?? '',
        memberCount: channel.memberIds.length,
        archived: channel.isArchived,
        isMember: channel.isMember(personId),
      })),
    };
  }

  @Get('channels/:channelId')
  async get(@CurrentPrincipal() principal: Principal, @Param('channelId') channelId: string): Promise<ChannelSummary> {
    const personId = await this.#personId(principal);
    return this.#summary(personId, channelId);
  }

  @Post('channels')
  async create(@CurrentPrincipal() principal: Principal, @Body() body: unknown): Promise<ChannelSummary> {
    const request = parseRequest(CreateChannelRequest, body);
    const personId = await this.#personId(principal);
    const channel = valueOf(await this.createChannel.execute({ personId, ...request }));
    return this.#summary(personId, channel);
  }

  @Patch('channels/:channelId')
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Body() body: unknown,
  ): Promise<ChannelSummary> {
    const request = parseRequest(UpdateChannelRequest, body);
    const personId = await this.#personId(principal);
    const channel = valueOf(await this.updateChannel.execute({ personId, channelId, ...request }));
    return this.#summary(personId, channel);
  }

  @Post('channels/:channelId/members')
  async addMember(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Body() body: unknown,
  ): Promise<ChannelSummary> {
    const request = parseRequest(AddMembersRequest, body);
    const personId = await this.#personId(principal);
    const channel = valueOf(await this.addMembers.execute({ personId, channelId, personIds: request.personIds }));
    return this.#summary(personId, channel);
  }

  @Delete('channels/:channelId/members/me')
  @HttpCode(204)
  async leave(@CurrentPrincipal() principal: Principal, @Param('channelId') channelId: string): Promise<void> {
    const personId = await this.#personId(principal);
    valueOf(await this.leaveChannel.execute({ personId, channelId }));
  }

  @Post('direct-messages')
  async openDirect(@CurrentPrincipal() principal: Principal, @Body() body: unknown): Promise<ChannelSummary> {
    const request = parseRequest(OpenDirectMessageRequest, body);
    const personId = await this.#personId(principal);
    const channel = valueOf(await this.openDirectMessage.execute({ personId, personIds: request.personIds }));
    return this.#summary(personId, channel);
  }

  @Get('channels/:channelId/messages')
  async messages(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Query() query: unknown,
  ): Promise<MessagePageResponse> {
    const { before, limit } = parseRequest(MessagePageQuery, query);
    const personId = await this.#personId(principal);
    return toPage(valueOf(await this.listMessages.execute({ personId, channelId, limit, before })));
  }

  @Get('channels/:channelId/messages/:rootMessageId/replies')
  async replies(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Param('rootMessageId') rootMessageId: string,
    @Query() query: unknown,
  ): Promise<MessagePageResponse> {
    const { before, limit } = parseRequest(MessagePageQuery, query);
    const personId = await this.#personId(principal);
    return toPage(valueOf(await this.listReplies.execute({ personId, channelId, rootMessageId, limit, before })));
  }

  @Post('channels/:channelId/messages')
  async post(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Body() body: unknown,
  ): Promise<MessageContract> {
    const request = parseRequest(PostMessageRequest, body);
    const personId = await this.#personId(principal);
    return toMessage(valueOf(await this.postMessage.execute({ personId, channelId, ...request })));
  }

  @Patch('channels/:channelId/messages/:messageId')
  async edit(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Body() body: unknown,
  ): Promise<MessageContract> {
    const request = parseRequest(MessageBodyRequest, body);
    const personId = await this.#personId(principal);
    return toMessage(valueOf(await this.editMessage.execute({ personId, channelId, messageId, body: request.body })));
  }

  @Delete('channels/:channelId/messages/:messageId')
  @HttpCode(204)
  async remove(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    const personId = await this.#personId(principal);
    valueOf(await this.deleteMessage.execute({ personId, channelId, messageId }));
  }

  @Put('channels/:channelId/read-marker')
  @HttpCode(204)
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const request = parseRequest(MoveReadMarkerRequest, body);
    const personId = await this.#personId(principal);
    valueOf(await this.moveReadMarker.execute({ personId, channelId, messageId: request.messageId }));
  }

  @Put('channels/:channelId/messages/:messageId/reactions/:emoji')
  async addReaction(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
  ): Promise<MessageContract> {
    return this.#react(principal, { channelId, messageId, emoji, add: true });
  }

  @Delete('channels/:channelId/messages/:messageId/reactions/:emoji')
  async removeReaction(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
  ): Promise<MessageContract> {
    return this.#react(principal, { channelId, messageId, emoji, add: false });
  }

  @Get('threads')
  async threads(@CurrentPrincipal() principal: Principal): Promise<ThreadListResponse> {
    const personId = await this.#personId(principal);
    const threads = await this.listThreads.execute(personId);
    return {
      threads: threads.map(({ channelId, root, summary, unreadCount }) => ({
        channelId,
        root: toMessage(root, summary),
        unreadCount,
      })),
    };
  }

  @Put('channels/:channelId/threads/:rootMessageId/follow')
  @HttpCode(204)
  async follow(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Param('rootMessageId') rootMessageId: string,
  ): Promise<void> {
    const personId = await this.#personId(principal);
    valueOf(await this.setThreadFollowing.execute({ personId, channelId, rootMessageId, following: true }));
  }

  @Delete('channels/:channelId/threads/:rootMessageId/follow')
  @HttpCode(204)
  async unfollow(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Param('rootMessageId') rootMessageId: string,
  ): Promise<void> {
    const personId = await this.#personId(principal);
    valueOf(await this.setThreadFollowing.execute({ personId, channelId, rootMessageId, following: false }));
  }

  @Put('channels/:channelId/threads/:rootMessageId/read-marker')
  @HttpCode(204)
  async readThread(
    @CurrentPrincipal() principal: Principal,
    @Param('channelId') channelId: string,
    @Param('rootMessageId') rootMessageId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const { messageId } = parseRequest(MoveThreadReadMarkerRequest, body);
    const personId = await this.#personId(principal);
    valueOf(await this.moveThreadReadMarker.execute({ personId, channelId, rootMessageId, messageId }));
  }

  async #react(
    principal: Principal,
    input: { channelId: string; messageId: string; emoji: string; add: boolean },
  ): Promise<MessageContract> {
    const personId = await this.#personId(principal);
    return toMessage(valueOf(await this.reactToMessage.execute({ personId, ...input })));
  }

  async #summary(personId: string, channel: Channel | string): Promise<ChannelSummary> {
    const channelId = typeof channel === 'string' ? channel : channel.props.channelId;
    const overview = await this.getChannel.execute({ personId, channelId });
    if (!overview) throw new NotFoundException();
    return toSummary(personId, overview);
  }

  async #personId(principal: Principal): Promise<string> {
    const person = await this.resolvePerson.execute(principal);
    if (!person.ok) throw new InternalServerErrorException(person.error);
    return person.value.personId;
  }
}
