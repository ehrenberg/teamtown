import { err, ok, type Result } from '@teamtown/kernel';
import type { FileStorage } from './ports/file-storage.port.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';

export type GetClaimedAttachmentContentError = 'not-found';

export interface AttachmentContent {
  readonly fileName: string;
  readonly contentType: string;
  readonly stream: NodeJS.ReadableStream;
}

/**
 * Reads a claimed attachment's bytes for a caller that already checked access (Messaging checks the message's
 * channel read permission before calling this). Unlike `GetUploadContent`, access is not limited to the
 * uploader, since anyone who can read the message may read its attachments.
 */
export class GetClaimedAttachmentContent {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(fileId: string): Promise<Result<AttachmentContent, GetClaimedAttachmentContentError>> {
    const upload = await this.uploads.findById(fileId);
    if (upload?.props.status !== 'claimed') return err('not-found');
    const stream = await this.storage.get(upload.props.storageKey);
    return ok({ fileName: upload.props.fileName, contentType: upload.props.contentType, stream });
  }
}
