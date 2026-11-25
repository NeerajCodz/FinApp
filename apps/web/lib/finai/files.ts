import type { PickedFile } from '@finapp/ui/ai/composer-files';

/** Browser files as composer picks, with a local preview for images. */
export function toPicked(files: File[]): PickedFile<File>[] {
  return files.map((file) => ({
    name: file.name || 'pasted-image.png',
    size: file.size,
    source: file,
    ...(file.type.startsWith('image/') ? { previewUrl: URL.createObjectURL(file) } : {}),
  }));
}
