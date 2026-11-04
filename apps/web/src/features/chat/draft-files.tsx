import { Paperclip, X } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ACCEPTED_EXTENSIONS, formatBytes } from './attachments.ts';
import type { Uploads } from './use-uploads.ts';

/** The "Attach file" button; the native file input stays hidden behind it. */
export function AttachButton({ uploads }: { readonly uploads: Uploads }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ACCEPTED_EXTENSIONS}
        data-testid="attach-input"
        onChange={(event) => {
          uploads.add([...(event.target.files ?? [])]);
          // Picking the same file again after removing it must fire `change` again.
          event.target.value = '';
        }}
      />
      <button
        type="button"
        aria-label={t('chat.attachFile')}
        title={t('chat.attachFile')}
        onClick={() => input.current?.click()}
        className="grid size-7 shrink-0 place-items-center rounded-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary"
      >
        <Paperclip aria-hidden="true" className="size-4" />
      </button>
    </>
  );
}

/** The attached files with their progress; each can be removed, or cancelled while uploading (P-22). */
export function DraftFiles({ uploads }: { readonly uploads: Uploads }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <p role="status" className="sr-only">
        {uploads.status}
      </p>
      {uploads.files.length > 0 && (
        <ul aria-label={t('chat.attachedFiles')} className="mb-1.5 flex flex-col gap-1">
          {uploads.files.map((file) => (
            <li
              key={file.key}
              className="flex items-center gap-2 rounded-sm border border-border-subtle px-2 py-1 text-xs"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{file.fileName}</span>
                {file.uploadId === null ? (
                  <span
                    role="progressbar"
                    aria-label={t('chat.uploading', { name: file.fileName })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(file.progress * 100)}
                    className="mt-1 block h-1 overflow-hidden rounded-full bg-neutral-100"
                  >
                    <span
                      className="block h-full bg-terracotta-500"
                      style={{ width: `${String(file.progress * 100)}%` }}
                    />
                  </span>
                ) : (
                  <span className="text-text-secondary">{formatBytes(file.byteSize, i18n.language)}</span>
                )}
              </span>
              <button
                type="button"
                aria-label={t('chat.removeFile', { name: file.fileName })}
                title={t('chat.removeFile', { name: file.fileName })}
                onClick={() => {
                  uploads.remove(file.key);
                }}
                className="grid size-6 shrink-0 place-items-center rounded-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
