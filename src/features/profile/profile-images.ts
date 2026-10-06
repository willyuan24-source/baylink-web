import { compressImageFile, fileToDataUrl, MAX_IMAGE_UPLOAD_BYTES, UnsupportedImageError } from '../../utils/imageCompression';

export const MAX_PROFILE_IMAGE_BYTES = 1024 * 1024;
export async function prepareProfileImage(file: File, kind: 'avatar' | 'coverImage'): Promise<string> {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) throw new UnsupportedImageError('请选择不超过 10MB 的照片。');
  const maxWidth = kind === 'coverImage' ? 1600 : 768;
  const maxHeight = kind === 'coverImage' ? 700 : 768;
  const result = await compressImageFile(file, { maxWidth, maxHeight, quality: .84, maxOutputBytes: MAX_PROFILE_IMAGE_BYTES });
  return fileToDataUrl(result.file);
}
