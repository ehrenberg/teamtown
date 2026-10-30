import { z } from 'zod';

export const PersonId = z.uuid();

/** A person's colour, used for the avatar's top and name plate accents. */
export const AvatarColor = z.string().regex(/^#[0-9a-f]{6}$/i);

/** `GET /api/me` */
export const MeResponse = z.object({
  personId: PersonId,
  displayName: z.string().min(1).max(80),
  avatarColor: AvatarColor,
});
export type MeResponse = z.infer<typeof MeResponse>;
