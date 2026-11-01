import { Module } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import type { Clock, IdGenerator } from '@teamtown/kernel';
import { CLOCK, ID_GENERATOR } from '../../platform/config/config.module.ts';
import { PeopleModule, PeopleQueries } from '../people/public-api.ts';
import { AddChannelMembers } from './application/add-channel-members.ts';
import { BrowseChannels } from './application/browse-channels.ts';
import { CreateChannel } from './application/create-channel.ts';
import { DeleteMessage } from './application/delete-message.ts';
import { EditMessage } from './application/edit-message.ts';
import { GetChannel } from './application/get-channel.ts';
import { LeaveChannel } from './application/leave-channel.ts';
import { ListMessages } from './application/list-messages.ts';
import { ListMyChannels } from './application/list-my-channels.ts';
import { ListReplies } from './application/list-replies.ts';
import { ListThreads } from './application/list-threads.ts';
import { MessagingEventStream } from './application/messaging-event-stream.ts';
import { MoveReadMarker } from './application/move-read-marker.ts';
import { OpenDirectMessage } from './application/open-direct-message.ts';
import { CHANNEL_REPOSITORY, type ChannelRepository } from './application/ports/channel-repository.port.ts';
import { MESSAGE_REPOSITORY, type MessageRepository } from './application/ports/message-repository.port.ts';
import { PEOPLE_DIRECTORY, type PeopleDirectory } from './application/ports/people-directory.port.ts';
import { THREAD_REPOSITORY, type ThreadRepository } from './application/ports/thread-repository.port.ts';
import { PostMessage } from './application/post-message.ts';
import { ReactToMessage } from './application/react-to-message.ts';
import { MoveThreadReadMarker, SetThreadFollowing } from './application/thread-follows.ts';
import { UpdateChannel } from './application/update-channel.ts';
import { MessagingOutbox } from './infrastructure/messaging-outbox.ts';
import { PeopleDirectoryAdapter } from './infrastructure/people-directory.adapter.ts';
import { MESSAGING_ENTITIES } from './infrastructure/persistence/messaging.entities.ts';
import { MESSAGING_MIGRATIONS } from './infrastructure/persistence/migrations/messaging-initial.migration.ts';
import { MikroOrmChannelRepository } from './infrastructure/persistence/mikro-orm-channel.repository.ts';
import { MikroOrmMessageRepository } from './infrastructure/persistence/mikro-orm-message.repository.ts';
import { MikroOrmThreadRepository } from './infrastructure/persistence/mikro-orm-thread.repository.ts';
import { ChannelsController } from './interface/http/channels.controller.ts';

/** Channels, DMs, messages, threads and reactions (M3a/M3b, ADR-0033, ADR-0034). Persisted in the `messaging` schema, events via the outbox. */
@Module({
  imports: [PeopleModule],
  controllers: [ChannelsController],
  providers: [
    { provide: MessagingEventStream, useValue: new MessagingEventStream() },
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
      useFactory: (channels: ChannelRepository, clock: Clock, ids: IdGenerator) =>
        new CreateChannel(channels, clock, ids),
      inject: [CHANNEL_REPOSITORY, CLOCK, ID_GENERATOR],
    },
    {
      provide: UpdateChannel,
      useFactory: (channels: ChannelRepository, clock: Clock) => new UpdateChannel(channels, clock),
      inject: [CHANNEL_REPOSITORY, CLOCK],
    },
    {
      provide: AddChannelMembers,
      useFactory: (channels: ChannelRepository, people: PeopleDirectory, clock: Clock) =>
        new AddChannelMembers(channels, people, clock),
      inject: [CHANNEL_REPOSITORY, PEOPLE_DIRECTORY, CLOCK],
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
        clock: Clock,
        ids: IdGenerator,
      ) => new PostMessage(channels, messages, threads, clock, ids),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, THREAD_REPOSITORY, CLOCK, ID_GENERATOR],
    },
    {
      provide: EditMessage,
      useFactory: (channels: ChannelRepository, messages: MessageRepository, threads: ThreadRepository, clock: Clock) =>
        new EditMessage(channels, messages, threads, clock),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, THREAD_REPOSITORY, CLOCK],
    },
    {
      provide: DeleteMessage,
      useFactory: (channels: ChannelRepository, messages: MessageRepository, clock: Clock) =>
        new DeleteMessage(channels, messages, clock),
      inject: [CHANNEL_REPOSITORY, MESSAGE_REPOSITORY, CLOCK],
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
