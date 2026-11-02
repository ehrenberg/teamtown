import type { Result } from '@teamtown/kernel';
import type { Attachment } from '../../domain/message.ts';

export type ClaimAttachmentsError = 'upload-not-found' | 'not-uploader' | 'already-claimed';

export interface AttachmentContent {
  readonly fileName: string;
  readonly contentType: string;
  readonly stream: NodeJS.ReadableStream;
}

/** Messaging's view of the Files context (ADR-0017, ADR-0035): claims uploads as attachments, deletes them with the message. */
export interface FileAttachments {
  claim(input: {
    uploadIds: readonly string[];
    messageId: string;
    uploaderId: string;
  }): Promise<Result<Attachment[], ClaimAttachmentsError>>;
  /** Deletes a message's claimed attachment bytes and metadata (P-21). Never fails the caller's own operation. */
  deleteForMessage(messageId: string): Promise<void>;
  /** Reads a claimed attachment's bytes; the caller has already checked the message's channel access. */
  getContent(fileId: string): Promise<Result<AttachmentContent, 'not-found'>>;
}

export const FILE_ATTACHMENTS = Symbol('FILE_ATTACHMENTS');
