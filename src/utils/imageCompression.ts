export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxOutputBytes?: number;
  /** Kept for caller compatibility. Metadata removal never skips small files. */
  skipBelowBytes?: number;
};

export type CompressImageResult = { file: File; originalSize: number; compressedSize: number; compressed: boolean };
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const preparedFiles = new WeakSet<File>();
const TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type RasterType = typeof TYPES[number];

export class UnsupportedImageError extends Error {
  constructor(message: string) { super(message); this.name = 'UnsupportedImageError'; }
}
const unsupported = () => new UnsupportedImageError('请选择 JPG、PNG、静态 WebP 或可读取的 HEIC 照片；动图和其他格式请先导出为静态图片。');
const processingFailed = () => new UnsupportedImageError('这张照片无法安全处理，请导出为 JPG 或 PNG 后重试；原文件未上传。');
export const isLikelyImageFile = (file: File) => file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);

function readFile(file: Blob, dataUrl: false): Promise<ArrayBuffer>;
function readFile(file: Blob, dataUrl: true): Promise<string>;
function readFile(file: Blob, dataUrl: boolean): Promise<ArrayBuffer | string> {
  if (!dataUrl && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reader.onabort = () => reject(processingFailed());
    reader.onload = () => {
      if (dataUrl ? typeof reader.result === 'string' : Object.prototype.toString.call(reader.result) === '[object ArrayBuffer]') resolve(reader.result as ArrayBuffer | string);
      else reject(processingFailed());
    };
    try { if (dataUrl) reader.readAsDataURL(file); else reader.readAsArrayBuffer(file); }
    catch { reject(processingFailed()); }
  });
}
const ascii = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));

/** Check actual bytes, including APNG/WebP animation; extensions are not evidence. */
function staticFormat(bytes: Uint8Array): RasterType | 'image/heic' {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset), type = ascii(bytes, offset + 4);
      if (length > bytes.length - offset - 12) throw unsupported();
      if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw unsupported();
      if (type === 'IEND') return 'image/png';
      offset += length + 12;
    }
    throw unsupported();
  }
  if (bytes.length >= 12 && ascii(bytes, 0) === 'RIFF' && ascii(bytes, 8) === 'WEBP') {
    const end = view.getUint32(4, true) + 8;
    if (end !== bytes.length) throw unsupported();
    let offset = 12, image = false;
    while (offset + 8 <= end) {
      const type = ascii(bytes, offset), length = view.getUint32(offset + 4, true);
      if (length > end - offset - 8) throw unsupported();
      if (type === 'ANIM' || type === 'ANMF' || (type === 'VP8X' && (length < 10 || (bytes[offset + 8] & 2)))) throw unsupported();
      if (type === 'VP8 ' || type === 'VP8L') image = true;
      offset += 8 + length + (length % 2);
    }
    if (image && offset === end) return 'image/webp';
    throw unsupported();
  }
  if (bytes.length >= 16 && ascii(bytes, 4) === 'ftyp') {
    const end = view.getUint32(0);
    if (end < 16 || end > bytes.length || end % 4 !== 0) throw unsupported();
    const brands = [ascii(bytes, 8)];
    for (let offset = 16; offset < end; offset += 4) brands.push(ascii(bytes, offset));
    if (brands.some(brand => ['msf1', 'hevc', 'hevx', 'avis', 'avif'].includes(brand))) throw unsupported();
    if (brands.some(brand => ['heic', 'heix'].includes(brand))) return 'image/heic';
  }
  throw unsupported();
}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; release: () => void };
async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Apply EXIF rotation/mirroring to pixels before omitting its metadata.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch { /* Some browsers decode HEIC with HTMLImageElement only. */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), image = new Image();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(processingFailed()); }, 15000);
    if (image.style) image.style.imageOrientation = 'from-image';
    image.onload = () => {
      clearTimeout(timer); URL.revokeObjectURL(url);
      resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, release() {} });
    };
    image.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(processingFailed()); };
    image.src = url;
  });
}
function canvasToBlob(canvas: HTMLCanvasElement, type: RasterType, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(processingFailed()), 15000);
    try { canvas.toBlob(blob => { clearTimeout(timer); if (blob?.size) resolve(blob); else reject(processingFailed()); }, type, quality); }
    catch { clearTimeout(timer); reject(processingFailed()); }
  });
}

/** Always encode fresh pixels, even if the sanitized file grows in size. Never return the original. */
export async function compressImageFile(file: File, options: CompressImageOptions = {}): Promise<CompressImageResult> {
  let decoded: DecodedImage | undefined;
  try {
    if (!file.size || file.size > MAX_IMAGE_UPLOAD_BYTES) throw new UnsupportedImageError('请选择不超过 10MB 的照片。');
    const inputType = staticFormat(new Uint8Array(await readFile(file, false)));
    const maxWidth = options.maxWidth ?? 1800, maxHeight = options.maxHeight ?? 1800;
    // Five base64 photos plus the post fields must fit the API's 20 MiB body.
    const quality = options.quality ?? .88, maxBytes = options.maxOutputBytes ?? 2.5 * 1024 * 1024;
    if (![maxWidth, maxHeight].every(value => Number.isFinite(value) && value >= 1 && value <= 4096)
      || !Number.isFinite(quality) || quality < .1 || quality > 1 || !Number.isFinite(maxBytes) || maxBytes < 1 || maxBytes > MAX_IMAGE_UPLOAD_BYTES) throw processingFailed();
    decoded = await decode(file);
    const { width, height } = decoded;
    if (![width, height].every(value => Number.isSafeInteger(value) && value > 0) || width * height > 64 * 1024 * 1024) throw processingFailed();
    const type: RasterType = inputType === 'image/heic' ? 'image/png' : inputType;
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    if (!context) throw processingFailed();
    let ratio = Math.min(1, maxWidth / width, maxHeight / height);
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.floor(width * ratio)); canvas.height = Math.max(1, Math.floor(height * ratio));
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      // Do not paint a background: PNG/WebP/HEIC alpha must survive encoding.
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, type, quality);
      const actualType = blob.type as RasterType;
      if (!TYPES.includes(actualType) || (actualType !== type && !(type === 'image/webp' && actualType === 'image/png'))) throw processingFailed();
      if (staticFormat(new Uint8Array(await readFile(blob, false))) !== actualType) throw processingFailed();
      if (blob.size <= maxBytes) {
        const extension = actualType === 'image/jpeg' ? 'jpg' : actualType.slice(6);
        const base = file.name.replace(/\.[^.]+$/, '') || 'image';
        const prepared = new File([blob], `${base}.${extension}`, { type: actualType, lastModified: Date.now() });
        preparedFiles.add(prepared);
        return { file: prepared, originalSize: file.size, compressedSize: prepared.size, compressed: prepared.size < file.size };
      }
      ratio *= .8;
    }
    throw new UnsupportedImageError('图片处理后仍然过大，请裁剪后重试；原文件未上传。');
  } catch (error) {
    if (error instanceof UnsupportedImageError) throw error;
    throw processingFailed();
  } finally { try { decoded?.release(); } catch { /* Releasing local decode resources cannot enable a raw-file fallback. */ } }
}

/** Only files returned by the privacy-preserving encoder can enter an upload payload. */
export async function fileToDataUrl(file: File): Promise<string> {
  if (!preparedFiles.has(file)) throw processingFailed();
  try {
    const result = await readFile(file, true);
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(result)) throw processingFailed();
    return result;
  } catch { throw processingFailed(); }
}
