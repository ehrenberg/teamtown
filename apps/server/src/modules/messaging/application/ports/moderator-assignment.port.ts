/** Gives a person the Channel Moderator role for a channel; Access's `AssignChannelModerator` implements it. */
export interface ModeratorAssignment {
  execute(input: { personId: string; channelId: string }): Promise<void>;
}

export const MODERATOR_ASSIGNMENT = Symbol('MODERATOR_ASSIGNMENT');
