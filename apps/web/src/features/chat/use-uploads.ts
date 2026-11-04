import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiDelete, apiUpload, type UploadTask } from '../../api/api-client.ts';
import { contentTypeOf, sortFiles } from './attachments.ts';
import { errorText } from './chat-shared.ts';

export interface DraftFile {
  /** Local until the server answers with an `uploadId`. */
  readonly key: number;
  readonly fileName: string;
  readonly byteSize: number;
  /** From 0 to 1. */
  readonly progress: number;
  readonly uploadId: string | null;
}

export interface Uploads {
  readonly files: readonly DraftFile[];
  /** The newest refusal in plain words, for the composer. */
  readonly error: string | null;
  /** What screen readers hear about the running uploads. */
  readonly status: string;
  readonly uploading: boolean;
  readonly uploadIds: readonly string[];
  readonly add: (files: readonly File[]) => void;
  readonly remove: (key: number) => void;
  /** After sending: the message owns the files now, so nothing is cancelled. */
  readonly clear: () => void;
}

const cancelOnServer = (uploadId: string) => {
  // Best effort: an upload that stays behind expires after 24 hours anyway (P-22).
  void apiDelete(`/files/uploads/${encodeURIComponent(uploadId)}`).catch(() => undefined);
};

/**
 * The files attached to one composer. Each uploads as soon as it is picked and can be removed until the message is
 * sent (P-22); leaving the conversation drops whatever wasn't sent.
 */
export function useUploads(): Uploads {
  const { t } = useTranslation();
  const [files, setFiles] = useState<readonly DraftFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const nextKey = useRef(0);
  const tasks = useRef(new Map<number, UploadTask>());
  const current = useRef(files);
  current.current = files;

  const update = (key: number, change: Partial<DraftFile>) => {
    setFiles((list) => list.map((file) => (file.key === key ? { ...file, ...change } : file)));
  };
  const drop = (key: number) => {
    setFiles((list) => list.filter((file) => file.key !== key));
  };

  const start = (file: File, contentType: string) => {
    const key = nextKey.current++;
    const task = apiUpload(file, contentType, (progress) => {
      update(key, { progress });
    });
    tasks.current.set(key, task);
    setFiles((list) => [...list, { key, fileName: file.name, byteSize: file.size, progress: 0, uploadId: null }]);
    setStatus(t('chat.uploadStarted', { name: file.name }));
    task.result.then(
      (upload) => {
        if (!tasks.current.delete(key)) {
          // Removed in the moment the upload finished.
          cancelOnServer(upload.uploadId);
          return;
        }
        update(key, { progress: 1, uploadId: upload.uploadId });
        setStatus(t('chat.uploadFinished', { name: file.name }));
      },
      (failure: unknown) => {
        // A removed upload was aborted on purpose.
        if (!tasks.current.delete(key)) return;
        drop(key);
        setError(t('chat.fileRefused', { name: file.name, reason: errorText(failure, t) }));
      },
    );
  };

  const add = (picked: readonly File[]) => {
    const { accepted, refused } = sortFiles(picked, current.current.length);
    const first = refused[0];
    setError(first ? t('chat.fileRefused', { name: first.file.name, reason: t(`chat.error.${first.code}`) }) : null);
    for (const file of accepted) start(file, contentTypeOf(file.name) ?? file.type);
  };

  const remove = (key: number) => {
    const file = current.current.find((candidate) => candidate.key === key);
    if (!file) return;
    const task = tasks.current.get(key);
    tasks.current.delete(key);
    task?.abort();
    if (file.uploadId) cancelOnServer(file.uploadId);
    drop(key);
    setError(null);
  };

  const clear = () => {
    setFiles([]);
    setError(null);
    setStatus('');
  };

  // Leaving the conversation: stop running uploads and cancel what was never sent.
  useEffect(() => {
    const running = tasks.current;
    return () => {
      for (const task of running.values()) task.abort();
      running.clear();
      for (const file of current.current) if (file.uploadId) cancelOnServer(file.uploadId);
    };
  }, []);

  return {
    files,
    error,
    status,
    uploading: files.some((file) => file.uploadId === null),
    uploadIds: files.flatMap((file) => (file.uploadId ? [file.uploadId] : [])),
    add,
    remove,
    clear,
  };
}
