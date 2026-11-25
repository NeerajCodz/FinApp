import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { PickedFile } from '@finapp/ui/ai/composer-files';
import { FINAI_ATTACHMENTS_PER_MESSAGE } from '@finapp/ui/ai/finai';

export type NativeSource = { uri: string; mimeType?: string };

const extensionFor = (mimeType?: string) =>
  mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : mimeType?.startsWith('image/heic')
        ? 'heic'
        : 'jpg';

/**
 * Opens the photo library, camera or file picker and returns the picks for the FinAI composer.
 * Throws `CAMERA_PERMISSION` when the camera isn't allowed.
 */
export async function pickFinaiFiles(
  source: 'library' | 'camera' | 'files',
): Promise<PickedFile<NativeSource>[]> {
  if (source === 'files') {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: '*/*',
    });
    if (result.canceled) return [];
    return result.assets.slice(0, FINAI_ATTACHMENTS_PER_MESSAGE).map((asset) => ({
      name: asset.name,
      size: asset.size ?? 1,
      source: { uri: asset.uri, ...(asset.mimeType ? { mimeType: asset.mimeType } : {}) },
      ...(asset.mimeType?.startsWith('image/') ? { previewUrl: asset.uri } : {}),
    }));
  }
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('CAMERA_PERMISSION');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.85,
    ...(source === 'library'
      ? { allowsMultipleSelection: true, selectionLimit: FINAI_ATTACHMENTS_PER_MESSAGE }
      : {}),
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return [];
  return result.assets.map((asset, index) => ({
    name: asset.fileName ?? `photo-${Date.now()}-${index + 1}.${extensionFor(asset.mimeType)}`,
    size: asset.fileSize ?? 1,
    source: { uri: asset.uri, ...(asset.mimeType ? { mimeType: asset.mimeType } : {}) },
    previewUrl: asset.uri,
  }));
}
