import type { AccessPolicy, ScopeRef } from '../../access/public-api.ts';
import type { Channel } from '../domain/channel.ts';

export interface ChannelAbilityFlags {
  readonly canManage: boolean;
  readonly canArchive: boolean;
  readonly canPin: boolean;
  readonly canDeleteAny: boolean;
}

/** What a person may do in a channel beyond its members' rights: asks `AccessPolicy`, so the domain stays pure. */
export class ChannelAbilities {
  constructor(private readonly access: AccessPolicy) {}

  /** Only public and private channels have moderators; DMs and room walls have their own rules (P-26). */
  async mayManage(personId: string, channel: Channel): Promise<boolean> {
    return channel.isModerated && (await this.access.can(personId, 'channel.manage', scopeOf(channel)));
  }

  async mayPin(personId: string, channel: Channel): Promise<boolean> {
    if (!channel.isModerated) return channel.isMember(personId);
    return this.access.can(personId, 'message.pin', scopeOf(channel));
  }

  /** Never in a DM, whatever the role (P-34). */
  async mayDeleteAny(personId: string, channel: Channel): Promise<boolean> {
    return !channel.isDirect && (await this.access.can(personId, 'message.delete.any', scopeOf(channel)));
  }

  async of(personId: string, channel: Channel): Promise<ChannelAbilityFlags> {
    const [canManage, mayPin, canDeleteAny] = await Promise.all([
      this.mayManage(personId, channel),
      this.mayPin(personId, channel),
      this.mayDeleteAny(personId, channel),
    ]);
    return {
      canManage,
      canArchive: canManage && !channel.isSeed,
      canPin: mayPin && !channel.isArchived,
      canDeleteAny: canDeleteAny && !channel.isArchived,
    };
  }
}

const scopeOf = (channel: Channel): ScopeRef => ({
  kind: 'channel',
  channelId: channel.props.channelId,
  private: channel.props.kind === 'private',
});
