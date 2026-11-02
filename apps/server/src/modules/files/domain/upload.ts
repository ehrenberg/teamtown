import { err, ok, type Result } from '@teamtown/kernel';

/** Each file at most 100 MB (P-19). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Common images, PDF, plain text and office/archive formats; executables and active web content are
 * rejected (P-20). Checked against the content type the client declared; sniffing the actual bytes is a
 * follow-up (docs/features/messaging-files.md).
 */
export const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/zip',
]);

/** Uploads nobody claims expire after this long (P-22). */
export const UPLOAD_EXPIRY_MS = 24 * 60 * 60 * 1000;

export type PreviewKind = 'image' | 'pdf' | 'none';

export function previewKindOf(contentType: string): PreviewKind {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  return 'none';
}

export type UploadStatus = 'pending' | 'claimed';

export interface UploadProps {
  readonly uploadId: string;
  readonly uploaderId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly storageKey: string;
  readonly status: UploadStatus;
  /** Set once a message claims this upload; `null` while `pending`. */
  readonly claimedByMessageId: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export type UploadCreateError = 'file-too-large' | 'unsupported-file-type';
export type UploadClaimError = 'not-uploader' | 'already-claimed';
export type UploadCancelError = 'not-uploader' | 'already-claimed';

/**
 * A file in temporary storage before a message claims it as an attachment (docs/architecture/domain-model.md).
 * Created by `UploadFile` after a clean malware scan (ADR-0035); claimed by `ClaimUploads` when a message is
 * posted with it; deleted by `PurgeExpiredUploads` if nobody claims it within 24 hours (P-22).
 */
export class Upload {
  private constructor(private state: UploadProps) {}

  static create(input: {
    uploadId: string;
    uploaderId: string;
    fileName: string;
    contentType: string;
    byteSize: number;
    now: Date;
  }): Result<Upload, UploadCreateError> {
    if (input.byteSize > MAX_UPLOAD_BYTES) return err('file-too-large');
    if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) return err('unsupported-file-type');
    return ok(
      new Upload({
        uploadId: input.uploadId,
        uploaderId: input.uploaderId,
        fileName: input.fileName,
        contentType: input.contentType,
        byteSize: input.byteSize,
        storageKey: input.uploadId,
        status: 'pending',
        claimedByMessageId: null,
        createdAt: input.now,
        expiresAt: new Date(input.now.getTime() + UPLOAD_EXPIRY_MS),
      }),
    );
  }

  /** Restores a stored upload; it was valid when it was saved. */
  static restore(props: UploadProps): Upload {
    return new Upload(props);
  }

  get props(): UploadProps {
    return this.state;
  }

  get isPending(): boolean {
    return this.state.status === 'pending';
  }

  get previewKind(): PreviewKind {
    return previewKindOf(this.state.contentType);
  }

  isExpired(now: Date): boolean {
    return this.isPending && now > this.state.expiresAt;
  }

  /** Only the uploader may claim their own upload as an attachment, and only once. */
  claim(messageId: string, requesterId: string): Result<void, UploadClaimError> {
    if (requesterId !== this.state.uploaderId) return err('not-uploader');
    if (this.state.status === 'claimed') return err('already-claimed');
    this.state = { ...this.state, status: 'claimed', claimedByMessageId: messageId };
    return ok(undefined);
  }

  /** Only the uploader may cancel, and only before it is claimed. */
  cancel(requesterId: string): Result<void, UploadCancelError> {
    if (requesterId !== this.state.uploaderId) return err('not-uploader');
    if (this.state.status === 'claimed') return err('already-claimed');
    return ok(undefined);
  }
}
