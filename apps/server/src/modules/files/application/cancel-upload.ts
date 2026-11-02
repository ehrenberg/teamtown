import { err, ok, type Result } from '@teamtown/kernel';
import type { UploadCancelError } from '../domain/upload.ts';
import type { FileStorage } from './ports/file-storage.port.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';

export type CancelUploadError = UploadCancelError | 'not-found';

/** Use case: the uploader removes a file they attached before sending the message (P-22). */
export class CancelUpload {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(input: { uploadId: string; requesterId: string }): Promise<Result<void, CancelUploadError>> {
    const upload = await this.uploads.findById(input.uploadId);
    if (!upload) return err('not-found');
    const cancelled = upload.cancel(input.requesterId);
    if (!cancelled.ok) return cancelled;
    await this.storage.delete(upload.props.storageKey);
    await this.uploads.delete(upload.props.uploadId);
    return ok(undefined);
  }
}
