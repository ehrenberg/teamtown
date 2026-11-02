import { err, ok, type Result } from '@teamtown/kernel';
import type { Upload } from '../domain/upload.ts';
import type { FileStorage } from './ports/file-storage.port.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';

export type GetUploadContentError = 'not-found' | 'forbidden';

/**
 * Use case: reads an upload's bytes for download or preview.
 *
 * TODO(messaging-integration): once a message's attachments are wired up, access should follow the message's
 * channel read permission (anyone who can read the message), not just the uploader. That needs Messaging to
 * expose a read check through its public-api; until then, only the uploader may read their own upload.
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
