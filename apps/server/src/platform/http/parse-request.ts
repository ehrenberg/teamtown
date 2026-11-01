import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/** Validates a request body or query against its contract; anything else is `400 invalid-request`. */
export function parseRequest<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException('invalid-request');
  return parsed.data;
}
