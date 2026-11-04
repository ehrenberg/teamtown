import type { OnApplicationBootstrap } from '@nestjs/common';
import type { AssignCreatorModerators } from '../application/assign-creator-moderators.ts';

/** Carries channels created before M4a over to the Access model. */
export class CreatorModeratorBootstrap implements OnApplicationBootstrap {
  constructor(private readonly assign: AssignCreatorModerators) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.assign.execute();
  }
}
