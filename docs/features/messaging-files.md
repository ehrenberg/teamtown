# Feature: Files

- **Status:** Draft
- **Brainstorming ID:** M7 Files & previews
- **Bounded context(s):** Files, Messaging, REST, web client
- **Milestone:** M3d (ADR-0033, ADR-0035)

## Problem / user value

As a team member, I want to share a file in a channel, DM or room wall and see what it is before downloading it,
so that I can hand over documents and images without leaving the chat.

## Behaviour

1. **Uploading.** The composer gets an "Attach file" action and drag-and-drop onto the chat panel. Each file is
   uploaded to temporary storage as soon as it is picked; the composer shows per-file progress and lets the member
   cancel or remove it before sending (P-22). Sending the message claims the uploaded files as that message's
   **attachments**; an upload nobody claims within 24 hours expires and is deleted (P-22).
2. **Limits.** Each file is at most **100 MB** (P-19). A message may carry **up to 10 attachments**, each subject
   to the per-file limit (P-23). The composer rejects an oversized file or a message over the limit before
   uploading, with a plain-language error.
3. **Allowed types.** Common images (`png`, `jpeg`, `gif`, `webp`), PDF, plain text (`txt`, `md`, `csv`) and common
   office/archive formats (`docx`, `xlsx`, `pptx`, `odt`, `ods`, `odp`, `zip`) are accepted; the server checks the
   detected content type, not only the file extension. Executables and active web content (for example `exe`,
   `msi`, `sh`, `html`, `js`, `svg`) are rejected with a plain-language error, both in the composer and the server
   (P-20). _The exact extension list is an implementation detail within the decided category and may be adjusted
   without a new product decision._
4. **Previews.** Images and PDFs get a preview: images show inline (bounded size, click to open full size); PDFs
   show a first-page thumbnail that opens the file on click. Every other allowed type shows a file chip (name,
   type icon, size) with a direct download; there is no in-app viewer for them (P-20).
5. **Attachments in the message.** An attachment belongs to exactly one message and is shown with it, in the
   channel, in a thread or "also sent to channel". It has no separate caption; the message body is the caption.
   Editing a message never changes its attachments (adding or removing a file requires a new message).
6. **Deleting.** Deleting a message deletes its attachments' bytes and metadata immediately and irreversibly,
   matching the existing message-body deletion (P-21). A deleted message shows "Message deleted" as it already
   does; no file chip remains.
7. **Access.** Downloading or previewing a file requires the same access as reading the message that carries it
   (channel membership, DM membership, or room-wall access). Files have no access independent of their message.
8. **Live.** `MessagePosted` already carries the full message including its attachments, so open clients render
   new attachments without an extra round trip. A cancelled or expired temporary upload is never visible to
   anyone but its uploader.
9. **Malware scanning (ADR-0035).** Every upload is scanned by ClamAV as part of `POST /api/files/uploads`, before
   the file reaches `pending`. A clean result proceeds as above. An infected result rejects the upload immediately
   with a plain-language error; no bytes are kept, and the file never becomes attachable or downloadable. If the
   scanner is disabled (self-hoster opted out), uploads proceed unscanned; the server logs a startup warning in
   that case.
10. **Pinning (P-24, P-25).** Any message — with or without an attachment — can be pinned to the channel, DM or
    room wall it belongs to. A **"Pinned"** view, reachable from the chat header, lists all of a conversation's
    pinned messages, newest first, each linking back to its place in the conversation (or its thread, if the
    pinned message is a reply). Pinning and unpinning use the existing `message.pin` permission from the
    catalogue; until M4 roles exist, only the **channel's creator** may pin or unpin in a channel, the same as
    their other moderation actions (renaming, archiving, inviting) (P-25). DMs and room walls have no creator, so
    any member of the DM, and any member on a room wall, may pin or unpin there (P-26). A deleted message is
    automatically unpinned. There is no limit on the number of pinned messages in this slice.

## Acceptance criteria

- [ ] Given a member attaches a 50 MB image and sends the message, then every member who can read the channel
      sees the image inline as a preview.
- [ ] Given a member attaches a 150 MB file, then the composer rejects it before uploading, with a plain-language
      error, and the message is not blocked from sending without it.
- [ ] Given a member attaches 11 files to one message, then the composer rejects the 11th attachment with a
      plain-language error.
- [ ] Given a member attaches an `.exe` file, then the upload is rejected by the composer and, if attempted
      directly against the API, by the server, with a plain-language error.
- [ ] Given a member uploads a file but never sends the message, then the file is deleted automatically no later
      than 24 hours after the upload.
- [ ] Given a message with attachments, when its author deletes the message, then the attachment bytes and
      metadata are deleted immediately and the message shows "Message deleted".
- [ ] Given a private channel a person cannot read, then requesting one of its attachments directly returns `404`.
- [ ] Given a member uploads a file that ClamAV flags as infected, then the upload is rejected immediately with a
      plain-language error, no bytes are kept, and the file cannot be attached to any message.
- [ ] Given a channel's creator, when they pin or unpin a message, then it appears or disappears in that channel's
      "Pinned" view for everyone who can read the channel.
- [ ] Given a member who is not the channel's creator, when they try to pin a message via the API, then the
      request is rejected (`403`).
- [ ] Given a pinned message, when its author deletes it, then it is removed from the "Pinned" view along with the
      message.
- [ ] Non-spatial path: attaching, previewing and downloading files works the same in the chat panel regardless of
      whether the 3D world is visible; no action requires the world.
- [ ] Accessibility: the attach action and each attachment have accessible labels (file name, type, size); upload
      progress and errors are announced; image previews have alt text from the file name; keyboard users can
      attach, remove, cancel and download without a pointer.
- [ ] i18n: all new UI and error strings exist in English and German, using German **du**.

## Permissions

Uploading and sending a message with attachments is `message.post`, already in the catalogue together with
`file.upload` (`docs/architecture/permissions.md`). No new permission is introduced for attachments; viewing or
downloading an attachment requires the same `channel.read` (or membership-equivalent) check as the message that
carries it. Until M4, the local M3a rules apply: anyone who can post in a channel, DM or room wall can attach
files to their own messages.

Pinning reuses the catalogue's existing `message.pin`. Until M4 roles exist:

| Action                          | Allowed for                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| Pin or unpin in a channel       | the channel's creator only (P-25), like its other moderation |
| Pin or unpin in a DM / group DM | any member (P-26)                                            |
| Pin or unpin on a room wall     | any member (P-26), consistent with P-16's read/post access   |
| View the "Pinned" list          | anyone who can read the conversation                         |

## Domain changes

- New **Files** bounded context (already listed as Supporting in the domain model): owns uploaded bytes and their
  metadata behind the `FileStorage` port (ADR-0017: local Docker volume by default, S3-compatible optional).
- **`Upload`** (root, Files): `uploadId`, `uploaderId`, `fileName`, `contentType`, `byteSize`, `storageKey`,
  `status: pending | claimed`, `createdAt`, `expiresAt` (`createdAt` + 24 h while `pending`, P-22). A scheduled
  cleanup deletes bytes and metadata for `pending` uploads past `expiresAt`.
- **`Attachment`** (value object, embedded in `Message.attachments[]`, Messaging): `fileId`, `fileName`,
  `contentType`, `byteSize`, plus preview metadata (`previewKind: image | pdf | none`, `previewUrl?`). Messaging
  references the Files aggregate by ID only; it never stores bytes.
- **`Message.attachments[]`** (already anticipated in the domain model) is populated when a message is sent,
  claiming the referenced uploads. Invariant: at most 10 attachments per message, each already claimed by no
  other message, each uploaded by the message's author, each within the per-file size limit (P-19, P-23).
- Deleting a message triggers Files to delete the claimed uploads' bytes and metadata immediately (P-21), via a
  domain event, not a direct cross-module call.
- Glossary addition to `docs/architecture/domain-model.md` §1: **Attachment** — "A file attached to a message,
  previewed inline for images and PDF, downloaded otherwise" (`Attachment`, `Message.attachments[]`); **Upload** —
  "A file in temporary storage before a message claims it" (`Upload`).
- Context map addition: `Messaging -->|AttachmentsClaimed| files` and `messaging -->|MessageDeleted| files`
  (domain events), `files -. FileStorage port .-> messaging` is not needed since Messaging only stores
  references; the web client fetches file bytes directly from a Files REST endpoint that checks access via the
  `AccessPolicy` port the same way Messaging does.
- **`MalwareScanner`** port (Files, ADR-0035): `scan(bytes): clean | infected`. The default adapter calls a
  ClamAV (`clamd`) instance over the Docker Compose network; a disabled scanner always returns `clean` and logs a
  startup warning. `POST /api/files/uploads` calls it before persisting the upload; an `infected` result deletes
  the streamed bytes and never creates an `Upload`.
- **`Message.pinned`** (boolean, Messaging): set by a pin/unpin use case that checks `message.pin` the same way
  other message actions check permissions. A deleted message is unpinned as part of its existing deletion.
  Pinning does not change `editedAt`. Glossary addition: **Pin** — "A message marked to stay easy to find in its
  conversation" (`Message.pinned`).

## API & realtime contracts

New contracts in `packages/contracts/src/files/`:

- `POST /api/files/uploads` (multipart, one file): creates a `pending` `Upload`, returns
  `{ uploadId, fileName, contentType, byteSize, expiresAt }`. Rejects disallowed types (`unsupported-file-type`)
  and oversized files (`file-too-large`, 413).
- `DELETE /api/files/uploads/{uploadId}`: the uploader cancels a `pending` upload before sending.
- `GET /api/files/{fileId}`: streams the bytes (original) for an attachment the caller may read (via Messaging's
  access check); `404` if the caller cannot read the message, or the message/attachment no longer exists.
- `GET /api/files/{fileId}/preview`: the image or PDF first-page preview; `404` for types without a preview.
- New error code: `infected-file` (422), from the malware scan (ADR-0035).

Changes in `packages/contracts/src/messaging/`:

- `POST /api/channels/{id}/messages` body gains `attachmentUploadIds?: string[]` (claims the given pending
  uploads as this message's attachments; the use case checks count, ownership and size).
- `MessageSchema` gains `attachments: [{ fileId, fileName, contentType, byteSize, previewKind, previewUrl? }]` and
  `pinned: boolean`.
- `PUT` / `DELETE /api/channels/{id}/messages/{messageId}/pin` (idempotent): pins or unpins; checks `message.pin`
  per the permission table above.
- `GET /api/channels/{id}/pinned-messages`: the channel's pinned messages, newest first.
- New error codes: `too-many-attachments` (409), `upload-not-found`, `upload-already-claimed`,
  `unsupported-file-type`, `file-too-large` (413).

Realtime: `MessagePosted`, `MessageEdited` and `MessageDeleted` already carry the full message, now including
`attachments` and `pinned`, so attachments need no new realtime message type. Pinning needs one new event,
`MessagePinChanged { channelId, messageId, pinned }`, sent to the conversation's open clients.

## Privacy impact

Attachment bytes and metadata (file name, type, size) are content, stored like message bodies, and visible to
whoever can read the message (ADR-0033). Deleting a message deletes them immediately and irreversibly (P-21), same
as the existing message-body deletion. No avatar position, path, room-entry or presence data is touched; uploads
and attachments carry no location (ADR-0012). The malware scan (ADR-0035) reads file bytes transiently to produce
a clean/infected verdict; it stores no scan history, only the immediate accept/reject outcome. Pin state is
content metadata on the message, visible to the same people who can already read it; no new personal data.

## UI / design

- Composer: "Attach file" button plus drag-and-drop over the chat panel; attached files show as removable chips
  with a progress bar while uploading.
- Message: image attachments render inline (bounded max size, tokens for spacing/radius); PDF attachments show a
  thumbnail; other types show a file chip (icon by type, name, size) with a download affordance.
- Errors (oversized file, rejected type, too many attachments) use the existing plain-language error style
  (`docs/design/brand-guide.md` §6), inline near the composer, not a blocking modal.
- No world representation: files are chat-panel content only, fully usable without the 3D view.
- **Pinned view:** a header action "Pinned" (with a count badge if non-empty) opens a list in the chat panel:
  message excerpt, author, timestamp and an "Unpin" action for whoever may pin; selecting an entry scrolls to it
  in the conversation.

## Open questions

_None._ P-19 to P-26 and ADR-0035 were decided on 2026-11-02.
