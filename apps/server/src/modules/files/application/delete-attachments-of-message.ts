import type { FileStorage } from './ports/file-storage.port.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';

/** Use case: deletes a message's claimed attachments immediately and irreversibly (P-21). */
export class DeleteAttachmentsOfMessage {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(messageId: string): Promise<void> {
    const attachments = await this.uploads.findClaimedByMessage(messageId);
    for (const upload of attachments) {
      await this.storage.delete(upload.props.storageKey);
      await this.uploads.delete(upload.props.uploadId);
    }
  }
}
