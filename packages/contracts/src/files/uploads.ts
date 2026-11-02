import { z } from 'zod';

/** Uploads behind the Files context (M3d, ADR-0017, ADR-0035, docs/features/messaging-files.md). */

export const UploadId = z.string().min(1).max(64);

/** Each file at most 100 MB (P-19). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
/** Attachments per message (P-23); enforced by Messaging once it claims uploads. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

export const PreviewKind = z.enum(['image', 'pdf', 'none']);
export type PreviewKind = z.infer<typeof PreviewKind>;

/** `POST /api/files/uploads` (multipart, one file): answered with the pending upload. */
export const UploadSchema = z.object({
  uploadId: UploadId,
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  byteSize: z.number().int().nonnegative(),
  previewKind: PreviewKind,
  expiresAt: z.iso.datetime(),
});
export type UploadContract = z.infer<typeof UploadSchema>;

/** Stable error codes in the `message` field of 4xx answers, translated in the client. */
export const FilesErrorCode = z.enum([
  'invalid-request',
  'file-too-large',
  'unsupported-file-type',
  'infected-file',
  'upload-not-found',
  'not-uploader',
  'already-claimed',
]);
export type FilesErrorCode = z.infer<typeof FilesErrorCode>;
