import { compressImageFile, fileToDataUrl, MAX_IMAGE_UPLOAD_BYTES, UnsupportedImageError } from '../../utils/imageCompression';

export const MAX_PROFILE_IMAGE_BYTES = 1024 * 1024;
export async function prepareProfileImage(file: File, kind: 'avatar' | 'coverImage'): Promise<string> {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) throw new UnsupportedImageError('请选择不超过 10MB 的照片。');
  if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) && !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new UnsupportedImageError('请选择 JPG、PNG、WebP 或 HEIC 照片。');
  const maxWidth = kind === 'coverImage' ? 1600 : 768;
  const maxHeight = kind === 'coverImage' ? 700 : 768;
  const result = await compressImageFile(file, { maxWidth, maxHeight, quality: 0.84, skipBelowBytes: 0 });
  const dataUrl = await fileToDataUrl(result.file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new UnsupportedImageError('这张照片无法读取，请换一张 JPG 或 PNG 照片。')); image.src = dataUrl;
  });
  if (!img.naturalWidth || !img.naturalHeight) throw new UnsupportedImageError('这张照片无法读取，请换一张 JPG 或 PNG 照片。');
  if (result.file.size <= MAX_PROFILE_IMAGE_BYTES && img.naturalWidth <= maxWidth && img.naturalHeight <= maxHeight && /^image\/(jpeg|png|webp)$/.test(result.file.type)) return dataUrl;
  // The shared compressor may retain small PNGs or fall back to the source. Normalize those here so a profile never saves an oversized/undecodable image.
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new UnsupportedImageError('图片处理失败，请换一张照片。');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.84, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_PROFILE_IMAGE_BYTES) return fileToDataUrl(new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
  }
  throw new UnsupportedImageError('照片压缩后仍然过大，请裁剪后重试。');
}
