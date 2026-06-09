export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** 小于此字节数时跳过压缩，默认 900KB */
  skipBelowBytes?: number;
};

export type CompressImageResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
};

const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_MAX_HEIGHT = 1200;
const DEFAULT_QUALITY = 0.78;
const DEFAULT_SKIP_BELOW = 900 * 1024;

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

const buildOutputFile = (blob: Blob, original: File): File => {
  const base = original.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
};

const compressWithCanvas = async (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
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

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  return buildOutputFile(blob, file);
};

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

  const originalSize = file.size;
  const fallback: CompressImageResult = {
    file,
    originalSize,
    compressedSize: originalSize,
    compressed: false,
  };

  if (!file.type.startsWith('image/')) return fallback;

  // GIF 动图不压缩
  if (file.type === 'image/gif') return fallback;

  if (originalSize <= skipBelowBytes) return fallback;

  try {
    const compressedFile = await compressWithCanvas(file, maxWidth, maxHeight, quality);
    if (compressedFile.size >= originalSize) {
      return fallback;
    }
    return {
      file: compressedFile,
      originalSize,
      compressedSize: compressedFile.size,
      compressed: true,
    };
  } catch (err) {
    console.warn('[imageCompression] fallback to original file', err);
    return fallback;
  }
}

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('readAsDataURL failed'));
    reader.readAsDataURL(file);
  });
}
