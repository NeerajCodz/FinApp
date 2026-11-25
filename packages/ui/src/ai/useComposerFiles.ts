/**
 * Composer attachments for FinAI (web and native): checks each picked file, uploads it with the
 * platform's `upload`, and tracks per-file progress and errors. Files are uploaded as soon as
 * they're picked so sending is instant; removing one discards its upload.
 */
import * as React from 'react';
import {
  FINAI_ATTACHMENTS_PER_MESSAGE,
  finaiAttachmentError,
  finaiAttachmentKind,
  finaiAttachmentProblem,
  type FinaiComposerAttachment,
} from './finai';

export type PickedFile<T> = { name: string; size: number; previewUrl?: string; source: T };
export type UploadResult = { id: string } | { error: string };

let counter = 0;

export function useComposerFiles<T>(options: {
  upload: (file: PickedFile<T>) => Promise<UploadResult>;
  discard?: (id: string) => Promise<unknown>;
  /** Called with a message when a pick is refused as a whole (e.g. too many files). */
  onNotice?: (message: string) => void;
}) {
  const [files, setFiles] = React.useState<FinaiComposerAttachment[]>([]);
  const latest = React.useRef(options);
  React.useEffect(() => {
    latest.current = options;
  });
  const filesRef = React.useRef(files);
  filesRef.current = files;

  const update = (key: string, patch: Partial<FinaiComposerAttachment>) =>
    setFiles((current) => current.map((file) => (file.key === key ? { ...file, ...patch } : file)));

  const add = React.useCallback((picked: PickedFile<T>[]) => {
    const room = FINAI_ATTACHMENTS_PER_MESSAGE - filesRef.current.length;
    if (room <= 0) {
      latest.current.onNotice?.(`Attach up to ${FINAI_ATTACHMENTS_PER_MESSAGE} files per message.`);
      return;
    }
    if (picked.length > room)
      latest.current.onNotice?.(
        `Only the first ${room} file${room === 1 ? '' : 's'} were added (up to ${FINAI_ATTACHMENTS_PER_MESSAGE} per message).`,
      );
    for (const file of picked.slice(0, room)) {
      const key = `file-${Date.now()}-${counter++}`;
      const problem = finaiAttachmentProblem(file.name, file.size);
      const entry: FinaiComposerAttachment = {
        key,
        name: file.name,
        size: file.size,
        kind: finaiAttachmentKind(file.name) ?? 'text',
        status: problem ? 'error' : 'uploading',
        ...(problem ? { error: problem } : {}),
        ...(file.previewUrl ? { previewUrl: file.previewUrl } : {}),
      };
      setFiles((current) => [...current, entry]);
      if (problem) continue;
      latest.current
        .upload(file)
        .then((result) => {
          // Removed while uploading: discard the finished upload.
          if (!filesRef.current.some((current) => current.key === key)) {
            if ('id' in result) void latest.current.discard?.(result.id)?.catch(() => undefined);
            return;
          }
          if ('id' in result) update(key, { status: 'ready', id: result.id });
          else update(key, { status: 'error', error: finaiAttachmentError(result.error) });
        })
        .catch((cause: unknown) => {
          const code =
            cause instanceof Error ? /[A-Z][A-Z_]{3,}/.exec(cause.message)?.[0] : undefined;
          update(key, { status: 'error', error: finaiAttachmentError(code) });
        });
    }
  }, []);

  const remove = React.useCallback((key: string) => {
    const file = filesRef.current.find((entry) => entry.key === key);
    setFiles((current) => current.filter((entry) => entry.key !== key));
    if (file?.id) void latest.current.discard?.(file.id)?.catch(() => undefined);
  }, []);

  /** Takes the ready files for sending and clears the composer (restore them if sending fails). */
  const take = React.useCallback(() => {
    const ready = filesRef.current.filter((file) => file.status === 'ready' && file.id);
    setFiles([]);
    return ready;
  }, []);

  const restore = React.useCallback((list: FinaiComposerAttachment[]) => {
    if (list.length) setFiles((current) => [...list, ...current]);
  }, []);

  return { files, add, remove, take, restore };
}
