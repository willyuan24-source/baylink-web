import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach, type TestContext } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
const globals = { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, File: dom.window.File, FileReader: dom.window.FileReader, IS_REACT_ACT_ENVIRONMENT: true };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, act, cleanup, waitFor } = await import('@testing-library/react');
const { compressImageFile, fileToDataUrl, UnsupportedImageError } = await import('../src/utils/imageCompression');
const { prepareProfileImage, MAX_PROFILE_IMAGE_BYTES } = await import('../src/features/profile/profile-images');
const { CreatePostModal } = await import('../src/features/posts/CreatePostModal');
const { setLocale } = await import('../src/i18n/locale');

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5FoAAAAASUVORK5CYII=', 'base64'));
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 255, 217]);
function riff(chunks: Array<[string, number[]]>) {
  const body = chunks.flatMap(([name, bytes]) => [...Buffer.from(name), bytes.length & 255, bytes.length >>> 8 & 255, bytes.length >>> 16 & 255, bytes.length >>> 24, ...bytes, ...(bytes.length % 2 ? [0] : [])]);
  const size = body.length + 4;
  return new Uint8Array([...Buffer.from('RIFF'), size & 255, size >>> 8 & 255, size >>> 16 & 255, size >>> 24, ...Buffer.from('WEBP'), ...body]);
}
const webp = riff([['VP8L', [47, 0, 0, 0, 0]]]);
const photo = (bytes: Uint8Array, name: string, type: string) => new dom.window.File([bytes], name, { type }) as File;
function property(t: TestContext, object: object, key: string, value: unknown) {
  const old = Object.getOwnPropertyDescriptor(object, key);
  Object.defineProperty(object, key, { configurable: true, writable: true, value });
  t.after(() => { if (old) Object.defineProperty(object, key, old); else Reflect.deleteProperty(object, key); });
}
function encoder(t: TestContext, { width = 800, height = 600, output, context = true }: { width?: number; height?: number; output?: (type: string, canvas: HTMLCanvasElement) => Blob | null; context?: boolean } = {}) {
  const decoded: { file: File; options?: ImageBitmapOptions }[] = [], encoded: { width: number; height: number; type: string }[] = [];
  let released = 0, backgrounds = 0, available = context, encodeOutput = output;
  property(t, globalThis, 'createImageBitmap', async (file: File, options?: ImageBitmapOptions) => { decoded.push({ file, options }); return { width, height, close() { released++; } }; });
  t.mock.method(dom.window.HTMLCanvasElement.prototype, 'getContext', () => available ? { drawImage() {}, fillRect() { backgrounds++; } } : null);
  t.mock.method(dom.window.HTMLCanvasElement.prototype, 'toBlob', function (this: HTMLCanvasElement, callback: BlobCallback, type = 'image/png') {
    encoded.push({ width: this.width, height: this.height, type });
    callback(encodeOutput ? encodeOutput(type, this) : new dom.window.Blob([type === 'image/png' ? png : type === 'image/webp' ? webp : jpeg], { type }));
  });
  return { decoded, encoded, released: () => released, backgrounds: () => backgrounds, context: (value: boolean) => { available = value; }, output: (value: typeof output) => { encodeOutput = value; } };
}
beforeEach(async () => { localStorage.clear(); await setLocale('zh-Hans', false); });
afterEach(cleanup);
after(() => {
  dom.window.close();
  for (const [key, old] of previous) { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); }
  if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
});

test('small JPEG/PNG/WebP files always encode new pixels and never retain original GPS bytes', async t => {
  const mock = encoder(t);
  const marker = Buffer.from('GPSLatitude=37.4;GPSLongitude=-122.1;private-camera-serial');
  const sources = [
    photo(new Uint8Array([...jpeg, ...marker]), 'small.jpg', 'image/jpeg'),
    photo(new Uint8Array([...png, ...marker]), 'small.png', 'image/png'),
    photo(riff([['VP8L', [47, 0, 0, 0, 0]], ['EXIF', [...marker]]]), 'small.webp', 'image/webp'),
  ];
  for (const source of sources) {
    const result = await compressImageFile(source, { skipBelowBytes: 10 * 1024 * 1024 });
    assert.notEqual(result.file, source);
    assert.equal(result.file.type, source.type);
    const upload = await fileToDataUrl(result.file);
    assert.doesNotMatch(Buffer.from(upload.split(',')[1], 'base64').toString(), /GPSLatitude|GPSLongitude|private-camera-serial/);
  }
  assert.equal(mock.encoded.length, 3); assert.equal(mock.released(), 3); assert.equal(mock.backgrounds(), 0);
});

test('sanitized output may grow; EXIF orientation is applied before enforcing both dimension limits', async t => {
  const mock = encoder(t, { width: 1200, height: 2400 });
  const source = photo(new Uint8Array([255, 216, 255]), 'portrait.jpeg', 'image/jpeg');
  const result = await compressImageFile(source, { maxWidth: 500, maxHeight: 700 });
  assert.notEqual(result.file, source); assert.ok(result.file.size > source.size); assert.equal(result.compressed, false);
  assert.deepEqual(mock.decoded[0].options, { imageOrientation: 'from-image' });
  assert.deepEqual(mock.encoded[0], { width: 350, height: 700, type: 'image/jpeg' });
  assert.match(result.file.name, /\.jpg$/);
});

test('PNG/WebP transparency survives output fallback and profile byte-bound resizing', async t => {
  const mock = encoder(t, { width: 4000, height: 2000, output: (_type, canvas) => new dom.window.Blob(canvas.width > 1000 ? [png, new Uint8Array(MAX_PROFILE_IMAGE_BYTES)] : [png], { type: 'image/png' }) });
  const cover = await prepareProfileImage(photo(png, 'wide.png', 'image/png'), 'coverImage');
  assert.match(cover, /^data:image\/png;base64,/);
  assert.ok(mock.encoded.length > 1); assert.equal(mock.encoded[0].height, 700);
  assert.ok(mock.encoded.every(entry => entry.type === 'image/png' && entry.width <= 1600 && entry.height <= 700));
  assert.equal(mock.backgrounds(), 0);
  const webpResult = await compressImageFile(photo(webp, 'clear.webp', 'image/webp'));
  assert.equal(webpResult.file.type, 'image/png'); assert.match(webpResult.file.name, /\.png$/);
});

test('actual GIF/APNG/animated WebP/HEIF sequence and unsupported bytes are rejected before decode', async t => {
  const mock = encoder(t);
  const apng = new Uint8Array([...png.slice(0, -12), 0, 0, 0, 8, ...Buffer.from('acTL'), 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, ...png.slice(-12)]);
  const sequence = new Uint8Array([0, 0, 0, 20, ...Buffer.from('ftypmsf1'), 0, 0, 0, 0, ...Buffer.from('heic')]);
  for (const bytes of [new Uint8Array(Buffer.from('GIF89a')), apng, riff([['VP8X', [2, 0, 0, 0, 0, 0, 0, 0, 0, 0]], ['VP8L', [47, 0, 0, 0, 0]]]), sequence, new Uint8Array(Buffer.from('<svg/>'))]) {
    await assert.rejects(compressImageFile(photo(bytes, 'disguised.jpg', 'image/jpeg')), UnsupportedImageError);
  }
  assert.equal(mock.decoded.length, 0);
});

test('canvas, wrong MIME and persistent oversize failures cannot return an original upload file', async t => {
  const source = photo(png, 'private.png', 'image/png');
  const noCanvas = encoder(t, { context: false });
  await assert.rejects(compressImageFile(source), UnsupportedImageError); assert.equal(noCanvas.released(), 1);
  noCanvas.context(true); noCanvas.output(() => null);
  await assert.rejects(compressImageFile(source), UnsupportedImageError);
  noCanvas.output(() => new dom.window.Blob([jpeg], { type: 'image/jpeg' }));
  await assert.rejects(compressImageFile(source), UnsupportedImageError);
  noCanvas.output(() => new dom.window.Blob([png, new Uint8Array(128)], { type: 'image/png' }));
  await assert.rejects(compressImageFile(source, { maxOutputBytes: 32 }), UnsupportedImageError);
  await assert.rejects(fileToDataUrl(source), UnsupportedImageError);
});

test('failed decoders reject without a raw-file fallback and release local URLs', async t => {
  let revoked = 0;
  property(t, globalThis, 'createImageBitmap', async () => { throw new Error('unsupported decoder'); });
  property(t, URL, 'createObjectURL', () => 'blob:isolated-photo');
  property(t, URL, 'revokeObjectURL', () => { revoked++; });
  class FailedImage { onerror?: () => void; style = {}; set src(_value: string) { queueMicrotask(() => this.onerror?.()); } }
  property(t, globalThis, 'Image', FailedImage);
  await assert.rejects(compressImageFile(photo(jpeg, 'photo.jpg', 'image/jpeg')), UnsupportedImageError);
  assert.equal(revoked, 1);
});

test('invalid or excessive decoded dimensions fail before allocating an upload canvas', async t => {
  const mock = encoder(t, { width: 100000, height: 100000 });
  await assert.rejects(compressImageFile(photo(jpeg, 'oversized-pixels.jpg', 'image/jpeg')), UnsupportedImageError);
  assert.equal(mock.encoded.length, 0); assert.equal(mock.released(), 1);
});

test('supported static HEIC is re-encoded to alpha-capable PNG rather than mislabeled JPEG', async t => {
  const mock = encoder(t);
  const heic = new Uint8Array([0, 0, 0, 20, ...Buffer.from('ftypheic'), 0, 0, 0, 0, ...Buffer.from('mif1')]);
  const result = await compressImageFile(photo(heic, 'photo.heic', 'image/heic'));
  assert.equal(result.file.type, 'image/png'); assert.equal(result.file.name, 'photo.png');
  assert.equal(mock.backgrounds(), 0); assert.equal(mock.encoded[0].type, 'image/png');
});

test('FileReader failures leave post uploads empty and never retry the original private file', async t => {
  const mock = encoder(t);
  const read: Blob[] = [];
  class FailedReader extends dom.window.FileReader {
    override readAsDataURL(file: Blob) { read.push(file); queueMicrotask(() => this.dispatchEvent(new dom.window.Event('error'))); }
  }
  property(t, globalThis, 'FileReader', FailedReader);
  const source = photo(new Uint8Array([...jpeg, ...Buffer.from('GPS=private')]), 'phone.jpg', 'image/jpeg');
  const notices: string[] = [];
  const user = { id: 'private-photo-owner', nickname: 'Neighbor', token: 'isolated-test-token' } as UserData;
  const view = render(<CreatePostModal user={user} onClose={() => {}} onCreated={() => {}} showToast={message => notices.push(message)} />);
  fireEvent.click(view.getByRole('button', { name: '下一步' }));
  await act(async () => { fireEvent.change(view.getByLabelText('添加图片'), { target: { files: [source] } }); });
  await waitFor(() => assert.ok(notices.some(message => message.includes('原文件未上传'))));
  assert.equal(mock.encoded.length, 1); assert.equal(read.length, 1); assert.notEqual(read[0], source);
  assert.equal(view.queryByRole('button', { name: '移除第 1 张照片' }), null);
  assert.equal(view.container.querySelector('img[src^="data:image/"]'), null);
});
