import { err, ok, type Result } from '@teamtown/kernel';
import type { Upload } from '../domain/upload.ts';
import type { FileStorage } from './ports/file-storage.port.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';

export type GetUploadContentError = 'not-found' | 'forbidden';

/**
 * Use case: an uploader reads their own upload. Everyone else reads an attachment through the message that carries
 * it (Messaging's `GetAttachmentContent`), which checks access to that message.
 */
export class GetUploadContent {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(input: {
    fileId: string;
    requesterId: string;
  }): Promise<Result<{ upload: Upload; stream: NodeJS.ReadableStream }, GetUploadContentError>> {
    const upload = await this.uploads.findById(input.fileId);
    if (!upload) return err('not-found');
    if (upload.props.uploaderId !== input.requesterId) return err('forbidden');
    const stream = await this.storage.get(upload.props.storageKey);
    return ok({ upload, stream });
  }
}
