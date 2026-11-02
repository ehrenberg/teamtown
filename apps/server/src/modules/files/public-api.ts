// The only entry point other modules may import from the Files context.
export { ClaimUploads, type ClaimUploadsError, type UploadSnapshot } from './application/claim-uploads.ts';
export { DeleteAttachmentsOfMessage } from './application/delete-attachments-of-message.ts';
export {
  GetClaimedAttachmentContent,
  type AttachmentContent,
  type GetClaimedAttachmentContentError,
} from './application/get-claimed-attachment-content.ts';
export type { PreviewKind } from './domain/upload.ts';
export { FilesModule } from './files.module.ts';
