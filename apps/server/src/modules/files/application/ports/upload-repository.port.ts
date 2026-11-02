import type { Upload } from '../../domain/upload.ts';

export interface UploadRepository {
  findById(uploadId: string): Promise<Upload | null>;
  findClaimedByMessage(messageId: string): Promise<Upload[]>;
  /** `pending` uploads past their `expiresAt`, oldest first, at most `limit` (P-22). */
  findExpiredPending(now: Date, limit: number): Promise<Upload[]>;
  save(upload: Upload): Promise<void>;
  delete(uploadId: string): Promise<void>;
}

export const UPLOAD_REPOSITORY = Symbol('UPLOAD_REPOSITORY');
