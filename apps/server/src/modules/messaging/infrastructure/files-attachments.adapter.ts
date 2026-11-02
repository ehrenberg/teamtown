import { err, ok, type Result } from '@teamtown/kernel';
import type { ClaimUploads, DeleteAttachmentsOfMessage, GetClaimedAttachmentContent } from '../../files/public-api.ts';
import type { Attachment } from '../domain/message.ts';
import type {
  AttachmentContent,
  ClaimAttachmentsError,
  FileAttachments,
} from '../application/ports/file-attachments.port.ts';

/** Adapts Messaging's `FileAttachments` port to the Files context's public-api (one-directional dependency). */
export class FilesAttachmentsAdapter implements FileAttachments {
  constructor(
    private readonly claimUploads: ClaimUploads,
    private readonly deleteAttachments: DeleteAttachmentsOfMessage,
    private readonly getContentUseCase: GetClaimedAttachmentContent,
  ) {}

  async claim(input: {
    uploadIds: readonly string[];
    messageId: string;
    uploaderId: string;
  }): Promise<Result<Attachment[], ClaimAttachmentsError>> {
    const result = await this.claimUploads.execute(input);
    if (!result.ok) return err(result.error === 'not-found' ? 'upload-not-found' : result.error);
    return ok(result.value.map((upload) => ({ ...upload })));
  }

  deleteForMessage(messageId: string): Promise<void> {
    return this.deleteAttachments.execute(messageId);
  }

  async getContent(fileId: string): Promise<Result<AttachmentContent, 'not-found'>> {
    return this.getContentUseCase.execute(fileId);
  }
}
