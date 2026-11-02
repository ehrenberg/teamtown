import { err, ok, type Result } from '@teamtown/kernel';
import type { Upload, UploadClaimError } from '../domain/upload.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';

export type ClaimUploadsError = UploadClaimError | 'not-found';

/** What a caller outside Files may know about a claimed upload; never the aggregate itself. */
export interface UploadSnapshot {
  readonly fileId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly previewKind: Upload['previewKind'];
}

const toSnapshot = (upload: Upload): UploadSnapshot => ({
  fileId: upload.props.uploadId,
  fileName: upload.props.fileName,
  contentType: upload.props.contentType,
  byteSize: upload.props.byteSize,
  previewKind: upload.previewKind,
});

/**
 * Use case: claims pending uploads as a message's attachments (P-23). Exported for Messaging to call when it
 * posts a message with `attachmentUploadIds` (follow-up: docs/features/messaging-files.md). All uploads are
 * checked before any is claimed, so a message never ends up with only some of its attachments claimed.
 */
export class ClaimUploads {
  constructor(private readonly uploads: UploadRepository) {}

  async execute(input: {
    uploadIds: readonly string[];
    messageId: string;
    uploaderId: string;
  }): Promise<Result<UploadSnapshot[], ClaimUploadsError>> {
    const found: Upload[] = [];
    for (const uploadId of input.uploadIds) {
      const upload = await this.uploads.findById(uploadId);
      if (!upload) return err('not-found');
      found.push(upload);
    }
    for (const upload of found) {
      const claimed = upload.claim(input.messageId, input.uploaderId);
      if (!claimed.ok) return claimed;
    }
    for (const upload of found) await this.uploads.save(upload);
    return ok(found.map(toSnapshot));
  }
}
