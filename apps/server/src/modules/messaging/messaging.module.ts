import { Module } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import type { Clock, IdGenerator } from '@teamtown/kernel';
import { CLOCK, ID_GENERATOR } from '../../platform/config/config.module.ts';
import {
  ClaimUploads,
  DeleteAttachmentsOfMessage,
  FilesModule,
  GetClaimedAttachmentContent,
} from '../files/public-api.ts';
import { ACCESS_POLICY, AccessModule, AssignChannelModerator, type AccessPolicy } from '../access/public-api.ts';
import { PeopleModule, PeopleQueries } from '../people/public-api.ts';
import { FloorQueries, WorldEventStream, WorldModule } from '../world/public-api.ts';
import { AddChannelMembers } from './application/add-channel-members.ts';
import { BrowseChannels } from './application/browse-channels.ts';
import { CreateChannel } from './application/create-channel.ts';
import { DeleteMessage } from './application/delete-message.ts';
import { EditMessage } from './application/edit-message.ts';
import { GetAttachmentContent } from './application/get-attachment-content.ts';
import { GetChannel } from './application/get-channel.ts';
import { LeaveChannel } from './application/leave-channel.ts';
import { ListMessages } from './application/list-messages.ts';
import { ListMyChannels } from './application/list-my-channels.ts';
import { AssignCreatorModerators } from './application/assign-creator-moderators.ts';
import { ChannelAbilities } from './application/channel-abilities.ts';
import { CreatorModeratorBootstrap } from './infrastructure/creator-moderator-bootstrap.ts';
import { ListPinnedMessages } from './application/list-pinned-messages.ts';
import { SearchMessages } from './application/search-messages.ts';
import { MESSAGE_SEARCH, type MessageSearch } from './application/ports/message-search.port.ts';
import { PostgresMessageSearch } from './infrastructure/persistence/postgres-message-search.ts';
import { ListReplies } from './application/list-replies.ts';
import { ListThreads } from './application/list-threads.ts';
import { MessagingEventStream } from './application/messaging-event-stream.ts';
import { MoveReadMarker } from './application/move-read-marker.ts';
import { OpenDirectMessage } from './application/open-direct-message.ts';
import { PinMessage } from './application/pin-message.ts';
import { CHANNEL_REPOSITORY, type ChannelRepository } from './application/ports/channel-repository.port.ts';
import { FILE_ATTACHMENTS, type FileAttachments } from './application/ports/file-attachments.port.ts';
import { MESSAGE_REPOSITORY, type MessageRepository } from './application/ports/message-repository.port.ts';
import { PEOPLE_DIRECTORY, type PeopleDirectory } from './application/ports/people-directory.port.ts';
import { ROOM_DIRECTORY, type RoomDirectory } from './application/ports/room-directory.port.ts';
import { THREAD_REPOSITORY, type ThreadRepository } from './application/ports/thread-repository.port.ts';
import { PostMessage } from './application/post-message.ts';
import { ReactToMessage } from './application/react-to-message.ts';
import { SynchronizeRoomWalls } from './application/synchronize-room-walls.ts';
import { MoveThreadReadMarker, SetThreadFollowing } from './application/thread-follows.ts';
import { UpdateChannel } from './application/update-channel.ts';
import { FilesAttachmentsAdapter } from './infrastructure/files-attachments.adapter.ts';
import { MessagingOutbox } from './infrastructure/messaging-outbox.ts';
import { PeopleDirectoryAdapter } from './infrastructure/people-directory.adapter.ts';
import { RoomWallBootstrap } from './infrastructure/room-wall-bootstrap.ts';
import { RoomWallLifecycle } from './infrastructure/room-wall-lifecycle.ts';
import { WorldRoomDirectoryAdapter } from './infrastructure/world-room-directory.adapter.ts';
import { MESSAGING_ENTITIES } from './infrastructure/persistence/messaging.entities.ts';
import { MESSAGING_MIGRATIONS } from './infrastructure/persistence/migrations/messaging-initial.migration.ts';
import { MikroOrmChannelRepository } from './infrastructure/persistence/mikro-orm-channel.repository.ts';
import { MikroOrmMessageRepository } from './infrastructure/persistence/mikro-orm-message.repository.ts';
import { MikroOrmThreadRepository } from './infrastructure/persistence/mikro-orm-thread.repository.ts';
import { ChannelsController } from './interface/http/channels.controller.ts';

/** Channels, DMs, room walls, messages, threads and reactions (M3a–M3c). Persisted in `messaging`, events via the outbox. */
@Module({
  imports: [AccessModule, PeopleModule, WorldModule, FilesModule],
  controllers: [ChannelsController],
  providers: [
    { provide: MessagingEventStream, useValue: new MessagingEventStream() },
    {
      provide: FILE_ATTACHMENTS,
      useFactory: (
        claim: ClaimUploads,
        deleteAttachments: DeleteAttachmentsOfMessage,
        getContent: GetClaimedAttachmentContent,
      ) => new FilesAttachmentsAdapter(claim, deleteAttachments, getContent),
      inject: [ClaimUploads, DeleteAttachmentsOfMessage, GetClaimedAttachmentContent],
    },
    {
      provide: MessagingOutbox,
      useFactory: (orm: MikroORM, events: MessagingEventStream) => new MessagingOutbox(orm, events),
      inject: [MikroORM, MessagingEventStream],
    },
    {
      provide: CHANNEL_REPOSITORY,
      useFactory: (orm: MikroORM, outbox: MessagingOutbox) =>
        new MikroOrmChannelRepository(orm, () => {
          outbox.relay.kick();
        }),
      inject: [MikroORM, MessagingOutbox],
    },
    {
      provide: MESSAGE_REPOSITORY,
      useFactory: (orm: MikroORM, outbox: MessagingOutbox) =>
        new MikroOrmMessageRepository(orm, () => {
          outbox.relay.kick();
        }),
      inject: [MikroORM, MessagingOutbox],
    },
    {
      provide: THREAD_REPOSITORY,
      useFactory: (orm: MikroORM, outbox: MessagingOutbox) =>
        new MikroOrmThreadRepository(orm, () => {
          outbox.relay.kick();
        }),
      inject: [MikroORM, MessagingOutbox],
    },
    {
      provide: PEOPLE_DIRECTORY,
      useFactory: (people: PeopleQueries) => new PeopleDirectoryAdapter(people),
      inject: [PeopleQueries],
    },
    {
      provide: ROOM_DIRECTORY,
      useFactory: (floors: FloorQueries) => new WorldRoomDirectoryAdapter(floors),
      inject: [FloorQueries],
    },
    {
      provide: SynchronizeRoomWalls,
      useFactory: (
        channels: ChannelRepository,
        rooms: RoomDirectory,
        people: PeopleDirectory,
        clock: Clock,
        ids: IdGenerator,
      ) => new SynchronizeRoomWalls(channels, rooms, people, clock, ids),
      inject: [CHANNEL_REPOSITORY, ROOM_DIRECTORY, PEOPLE_DIRECTORY, CLOCK, ID_GENERATOR],
    },
    {
      provide: RoomWallBootstrap,
      useFactory: (synchronize: SynchronizeRoomWalls) => new RoomWallBootstrap(synchronize),
      inject: [SynchronizeRoomWalls],
    },
    {
      provide: RoomWallLifecycle,
      useFactory: (events: WorldEventStream, synchronize: SynchronizeRoomWalls) =>
        new RoomWallLifecycle(events, synchronize),
      inject: [WorldEventStream, SynchronizeRoomWalls],
    },
    {
      provide: ListMyChannels,
      useFactory: (channels: ChannelRepository, clock: Clock) => new ListMyChannels(channels, clock),
      inject: [CHANNEL_REPOSITORY, CLOCK],
    },
    {
      provide: GetChannel,
      useFactory: (channels: ChannelRepository) => new GetChannel(channels),
      inject: [CHANNEL_REPOSITORY],
    },
    {
      provide: BrowseChannels,
      useFactory: (channels: ChannelRepository) => new BrowseChannels(channels),
      inject: [CHANNEL_REPOSITORY],
    },
    {
      provide: CreateChannel,
      useFactory: (
        channels: ChannelRepository,
        access: AccessPolicy,
        moderators: AssignChannelModerator,
        clock: Clock,
        ids: IdGenerator,
      ) => new CreateChannel(channels, access, moderators, clock, ids),
      inject: [CHANNEL_REPOSITORY, ACCESS_POLICY, AssignChannelModerator, CLOCK, ID_GENERATOR],
    },
    {
      provide: UpdateChannel,
      useFactory: (channels: ChannelRepository, abilities: ChannelAbilities, clock: Clock) =>
        new UpdateChannel(channels, abilities, clock),
      inject: [CHANNEL_REPOSITORY, ChannelAbilities, CLOCK],
    },
    {
      provide: AddChannelMembers,
      useFactory: (channels: ChannelRepository, people: PeopleDirectory, abilities: ChannelAbilities, clock: Clock) =>
        new AddChannelMembers(channels, people, abilities, clock),
      inject: [CHANNEL_REPOSITORY, PEOPLE_DIRECTORY, ChannelAbilities, CLOCK],
    },
    {
      provide: LeaveChannel,
      useFactory: (channels: ChannelRepository) => new LeaveChannel(channels),
      inject: [CHANNEL_REPOSITORY],
    },
    {
      provide: OpenDirectMessage,
      useFactory: (channels: ChannelRepository, people: PeopleDirectory, clock: Clock, ids: IdGenerator) =>
        new OpenDirectMessage(channels, people, clock, ids),
      inject: [CHANNEL_REPOSITORY, PEOPLE_DIRECTORY, CLOCK, ID_GENERATOR],
    },
    {
      provide: ListMessages,
      useFactory: (channels: ChannelRepository, messages: MessageRepository) => new ListMessages(channels, messages),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY],
    },
    {
      provide: PostMessage,
      useFactory: (
        channels: ChannelRepository,
        messages: MessageRepository,
        threads: ThreadRepository,
        fileAttachments: FileAttachments,
        clock: Clock,
        ids: IdGenerator,
      ) => new PostMessage(channels, messages, threads, fileAttachments, clock, ids),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, THREAD_REPOSITORY, FILE_ATTACHMENTS, CLOCK, ID_GENERATOR],
    },
    {
      provide: EditMessage,
      useFactory: (channels: ChannelRepository, messages: MessageRepository, threads: ThreadRepository, clock: Clock) =>
        new EditMessage(channels, messages, threads, clock),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, THREAD_REPOSITORY, CLOCK],
    },
    {
      provide: DeleteMessage,
      useFactory: (
        channels: ChannelRepository,
        messages: MessageRepository,
        fileAttachments: FileAttachments,
        abilities: ChannelAbilities,
        clock: Clock,
      ) => new DeleteMessage(channels, messages, fileAttachments, abilities, clock),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, FILE_ATTACHMENTS, ChannelAbilities, CLOCK],
    },
    {
      provide: PinMessage,
      useFactory: (channels: ChannelRepository, messages: MessageRepository, abilities: ChannelAbilities) =>
        new PinMessage(channels, messages, abilities),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, ChannelAbilities],
    },
    {
      provide: ChannelAbilities,
      useFactory: (access: AccessPolicy) => new ChannelAbilities(access),
      inject: [ACCESS_POLICY],
    },
    {
      provide: AssignCreatorModerators,
      useFactory: (channels: ChannelRepository, moderators: AssignChannelModerator) =>
        new AssignCreatorModerators(channels, moderators),
      inject: [CHANNEL_REPOSITORY, AssignChannelModerator],
    },
    {
      provide: CreatorModeratorBootstrap,
      useFactory: (assign: AssignCreatorModerators) => new CreatorModeratorBootstrap(assign),
      inject: [AssignCreatorModerators],
    },
    {
      provide: MESSAGE_SEARCH,
      useFactory: (orm: MikroORM) => new PostgresMessageSearch(orm),
      inject: [MikroORM],
    },
    {
      provide: SearchMessages,
      useFactory: (channels: ChannelRepository, search: MessageSearch) => new SearchMessages(channels, search),
      inject: [CHANNEL_REPOSITORY, MESSAGE_SEARCH],
    },
    {
      provide: ListPinnedMessages,
      useFactory: (channels: ChannelRepository, messages: MessageRepository) =>
        new ListPinnedMessages(channels, messages),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY],
    },
    {
      provide: GetAttachmentContent,
      useFactory: (channels: ChannelRepository, messages: MessageRepository, fileAttachments: FileAttachments) =>
        new GetAttachmentContent(channels, messages, fileAttachments),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, FILE_ATTACHMENTS],
    },
    {
      provide: MoveReadMarker,
      useFactory: (channels: ChannelRepository, messages: MessageRepository) => new MoveReadMarker(channels, messages),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY],
    },
    {
      provide: ListReplies,
      useFactory: (channels: ChannelRepository, messages: MessageRepository) => new ListReplies(channels, messages),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY],
    },
    {
      provide: ReactToMessage,
      useFactory: (channels: ChannelRepository, messages: MessageRepository) => new ReactToMessage(channels, messages),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY],
    },
    ...[ListThreads, SetThreadFollowing, MoveThreadReadMarker].map((UseCase) => ({
      provide: UseCase,
      useFactory: (channels: ChannelRepository, messages: MessageRepository, threads: ThreadRepository) =>
        new UseCase(channels, messages, threads),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, THREAD_REPOSITORY],
    })),
  ],
  exports: [MessagingEventStream],
})
export class MessagingModule {
  static readonly entities = MESSAGING_ENTITIES;
  static readonly migrations = MESSAGING_MIGRATIONS;
}
