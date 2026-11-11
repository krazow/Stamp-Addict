import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export interface PickedPhoto {
  /** Stored path, relative to the app's documents folder (e.g. "photos/123.jpg"). */
  uri: string;
  width: number;
  height: number;
}

export class CameraPermissionError extends Error {}

/**
 * Takes or picks a photo, lets the user crop it, and copies it into the
 * app's own folder so it survives the phone clearing its photo cache.
 * Returns null if the user cancels.
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new CameraPermissionError('Camera permission was not granted');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return { uri: keepPhoto(asset.uri), width: asset.width, height: asset.height };
}

function keepPhoto(sourceUri: string): string {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create();
  const ext = (sourceUri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
  const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  new File(sourceUri).copy(new File(dir, name));
  // Store a relative path: on iPhone the documents folder's full path
  // changes when the app is updated, so absolute paths would break.
  return `photos/${name}`;
}

/** Turns a stored photo path into something <Image> can show. */
export function photoSource(uri: string | null | undefined): { uri: string } | null {
  if (!uri) return null;
  if (/^(file|https?|content|ph):/.test(uri)) return { uri };
  return { uri: new File(Paths.document, uri).uri };
}

/** Removes a stored photo file; ignores files that are already gone. */
export function deletePhotoFile(uri: string): void {
  try {
    if (/^(https?|content|ph):/.test(uri)) return;
    const file = /^file:/.test(uri) ? new File(uri) : new File(Paths.document, uri);
    if (file.exists) file.delete();
  } catch {
    // Not worth failing a delete over a missing photo file.
  }
}
