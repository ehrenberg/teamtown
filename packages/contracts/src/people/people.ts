import { z } from 'zod';
import { AvatarColor, PersonId } from './me.ts';

/** `GET /api/people`: everyone in the town, e.g. to pick people for a DM. */
export const PeopleListResponse = z.object({
  people: z.array(z.object({ personId: PersonId, displayName: z.string(), avatarColor: AvatarColor })),
});
export type PeopleListResponse = z.infer<typeof PeopleListResponse>;
