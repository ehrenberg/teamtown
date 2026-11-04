import type { AttachmentContract, MessageContract } from '@teamtown/contracts';
import { Download, File, FileArchive, FileSpreadsheet, FileText } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { apiBlob } from '../../api/api-client.ts';
import { extensionOf, formatBytes } from './attachments.ts';
import { channelPath } from './composer.tsx';

/** Previews sit in a box of fixed height, so a loading image never moves the conversation. */
const PREVIEW_HEIGHT_PX = 192;

const pathOf = (message: MessageContract, attachment: AttachmentContract) =>
  `${channelPath(message.channelId)}/messages/${encodeURIComponent(message.messageId)}/attachments/${encodeURIComponent(attachment.fileId)}`;

function FileIcon({ fileName }: { readonly fileName: string }) {
  const extension = extensionOf(fileName);
  const className = 'size-4 shrink-0 text-text-secondary';
  if (['txt', 'md', 'pdf', 'docx', 'odt', 'pptx', 'odp'].includes(extension)) {
    return <FileText aria-hidden="true" className={className} />;
  }
  if (['csv', 'xlsx', 'ods'].includes(extension)) return <FileSpreadsheet aria-hidden="true" className={className} />;
  if (extension === 'zip') return <FileArchive aria-hidden="true" className={className} />;
  return <File aria-hidden="true" className={className} />;
}

function save(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
}

/** Opens a loaded file in a new tab; where that isn't possible (the desktop shell, popup blockers), saves it. */
function openOrSave(url: string, fileName: string): void {
  // Not with the `noopener` feature: `window.open` then always answers `null`, which reads as "couldn't open".
  const opened = window.open(url, '_blank');
  if (opened) opened.opener = null;
  else save(url, fileName);
}

/** Becomes `true` once the element scrolls near the view, so a long history doesn't load every file at once. */
function useSeen(element: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const target = element.current;
    if (!target || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin: '200px' },
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [element, seen]);
  return seen;
}

type Loaded = { readonly blob: Blob; readonly url: string } | 'failed' | null;

/** Loads an attachment with the session's token into a blob URL, which is released when no longer shown. */
function useAttachmentFile(path: string, enabled: boolean): Loaded {
  const [loaded, setLoaded] = useState<Loaded>(null);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    let url: string | null = null;
    apiBlob(path, abort.signal).then(
      (blob) => {
        url = URL.createObjectURL(blob);
        setLoaded({ blob, url });
      },
      () => {
        if (!abort.signal.aborted) setLoaded('failed');
      },
    );
    return () => {
      abort.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, enabled]);
  return loaded;
}

function PdfPage({ blob, onFailed }: { readonly blob: Blob; readonly onFailed: () => void }) {
  const holder = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let cancelled = false;
    import('./pdf-thumbnail.ts')
      .then(({ renderFirstPage }) => renderFirstPage(blob, PREVIEW_HEIGHT_PX))
      .then(
        (canvas) => {
          if (!cancelled) holder.current?.replaceChildren(canvas);
        },
        () => {
          if (!cancelled) onFailed();
        },
      );
    return () => {
      cancelled = true;
    };
  }, [blob, onFailed]);
  return <span ref={holder} className="contents" />;
}

/** An inline image or a PDF's first page; a click opens the file (P-20). Unreadable files just show their chip. */
function Preview({
  message,
  attachment,
}: {
  readonly message: MessageContract;
  readonly attachment: AttachmentContract;
}) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const seen = useSeen(box);
  const loaded = useAttachmentFile(pathOf(message, attachment), seen);
  const [broken, setBroken] = useState(false);
  const file = loaded === 'failed' ? null : loaded;
  const hide = useCallback(() => {
    setBroken(true);
  }, []);

  if (loaded === 'failed' || broken) return null;
  return (
    <div ref={box} style={{ height: PREVIEW_HEIGHT_PX }} className="overflow-hidden rounded-sm bg-neutral-100">
      {file ? (
        <button
          type="button"
          aria-label={t('chat.openFile', { name: attachment.fileName })}
          title={t('chat.openFile', { name: attachment.fileName })}
          onClick={() => {
            openOrSave(file.url, attachment.fileName);
          }}
          className="grid size-full place-items-center"
        >
          {attachment.previewKind === 'image' ? (
            <img src={file.url} alt={attachment.fileName} onError={hide} className="max-h-full max-w-full" />
          ) : (
            <PdfPage blob={file.blob} onFailed={hide} />
          )}
        </button>
      ) : (
        <p className="grid size-full place-items-center text-xs text-text-secondary">{t('chat.loading')}</p>
      )}
    </div>
  );
}

/** Name, type and size, with a direct download (P-20). Files have no in-app viewer beyond the previews. */
function FileChip({
  message,
  attachment,
}: {
  readonly message: MessageContract;
  readonly attachment: AttachmentContract;
}) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const size = formatBytes(attachment.byteSize, i18n.language);
  const type = extensionOf(attachment.fileName).toUpperCase();

  const download = () => {
    setState('loading');
    apiBlob(pathOf(message, attachment)).then(
      (blob) => {
        const url = URL.createObjectURL(blob);
        save(url, attachment.fileName);
        // The browser has taken the file over by the next task; a long delay isn't needed.
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 0);
        setState('idle');
      },
      () => {
        setState('failed');
      },
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 rounded-sm border border-border-subtle px-2 py-1.5 text-xs">
        <FileIcon fileName={attachment.fileName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{attachment.fileName}</span>
          <span className="text-text-secondary">
            {type} · {size}
          </span>
        </span>
        <button
          type="button"
          disabled={state === 'loading'}
          aria-label={t('chat.downloadFile', { name: attachment.fileName, type, size })}
          title={t('chat.downloadFile', { name: attachment.fileName, type, size })}
          onClick={download}
          className="grid size-7 shrink-0 place-items-center rounded-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary disabled:opacity-50"
        >
          <Download aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      {state === 'failed' && (
        <p role="alert" className="text-xs">
          {t('chat.downloadFailed')}
        </p>
      )}
    </>
  );
}

/** A message's files: previews for images and PDF (P-28), and a chip with a download for each. */
export function AttachmentList({ message }: { readonly message: MessageContract }) {
  if (message.attachments.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-1.5">
      {message.attachments.map((attachment) => (
        <li key={attachment.fileId} className="flex flex-col gap-1">
          {attachment.previewKind !== 'none' && <Preview message={message} attachment={attachment} />}
          <FileChip message={message} attachment={attachment} />
        </li>
      ))}
    </ul>
  );
}
