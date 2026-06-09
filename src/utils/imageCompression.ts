export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** 小于此字节数时跳过压缩，默认 1.2MB */
  skipBelowBytes?: number;
};

export type CompressImageResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
};

const DEFAULT_MAX_WIDTH = 1800;
const DEFAULT_MAX_HEIGHT = 1800;
const DEFAULT_QUALITY = 0.88;
const DEFAULT_SKIP_BELOW = Math.round(1.2 * 1024 * 1024);
const PNG_WEBP_SKIP_BELOW = 2 * 1024 * 1024;
const PNG_WEBP_JPEG_QUALITY = 0.88;

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

/** iOS 相册常返回空 type，用扩展名兜底 */
export const isLikelyImageFile = (file: File): boolean => {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
};

const isGif = (file: File) =>
  file.type === 'image/gif' || /\.gif$/i.test(file.name);

const isHeic = (file: File) => {
  const t = file.type.toLowerCase();
  return t === 'image/heic' || t === 'image/heif' || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
};

const isPng = (file: File) => file.type === 'image/png' || /\.png$/i.test(file.name);

const isWebp = (file: File) => file.type === 'image/webp' || /\.webp$/i.test(file.name);

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas toBlob failed'))),
      type,
      quality,
    );
  });

const buildJpegFile = (blob: Blob, original: File): File => {
  const base = original.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
};

const compressWithCanvas = async (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  paintWhiteBackground: boolean,
): Promise<File> => {
  const img = await loadImageFromFile(file);
  const ratio = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
  const width = Math.max(1, Math.round(img.naturalWidth * ratio));
  const height = Math.max(1, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas context unavailable');

  if (paintWhiteBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) {
    (ctx as CanvasRenderingContext2D & { imageSmoothingQuality: string }).imageSmoothingQuality = 'high';
  }
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  return buildJpegFile(blob, file);
};

const makeFallback = (file: File): CompressImageResult => ({
  file,
  originalSize: file.size,
  compressedSize: file.size,
  compressed: false,
});

/**
 * 浏览器端图片压缩（Canvas）。失败时回退原文件，不抛错阻断流程。
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<CompressImageResult> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    quality = DEFAULT_QUALITY,
    skipBelowBytes = DEFAULT_SKIP_BELOW,
  } = options;

  const fallback = makeFallback(file);

  if (!isLikelyImageFile(file)) return fallback;

  if (isGif(file)) return fallback;

  if (isHeic(file)) {
    console.info('[imageCompression] HEIC/HEIF skipped, using original');
    return fallback;
  }

  if (isPng(file) || isWebp(file)) {
    if (file.size <= PNG_WEBP_SKIP_BELOW) return fallback;
    try {
      const compressedFile = await compressWithCanvas(file, maxWidth, maxHeight, PNG_WEBP_JPEG_QUALITY, true);
      if (compressedFile.size >= file.size) return fallback;
      return {
        file: compressedFile,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressed: true,
      };
    } catch (err) {
      console.warn('[imageCompression] PNG/WebP compress failed, using original', err);
      return fallback;
    }
  }

  if (file.size <= skipBelowBytes) return fallback;

  try {
    const compressedFile = await compressWithCanvas(file, maxWidth, maxHeight, quality, false);
    if (compressedFile.size >= file.size) return fallback;
    return {
      file: compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      compressed: true,
    };
  } catch (err) {
    console.warn('[imageCompression] fallback to original file', err);
    return fallback;
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('readAsDataURL failed'));
    reader.readAsDataURL(file);
  });
}
