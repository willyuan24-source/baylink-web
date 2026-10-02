import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * W9-E-review (Ultra) · lane E's fixes (docs/opus-bay/sf-w9-E.md "Review (Ultra)").
 *
 * E-RC-1 · the city's .obc / .obb files are raw gzip and gunzip() needed DecompressionStream — Safari / iOS Safari have
 * it from 16.4, Firefox from 113 (MDN browser-compat-data api/DecompressionStream.json, read 2026-10-02). W9-E made the
 * site parse on iOS 15 and the switch sends everyone into the game: there the city never arrived (ReferenceError).
 */

const SF = 'public/opus-bay/sf/v1';

async function withoutDecompressionStream<T>(fn: () => Promise<T>): Promise<T> {
  const g = globalThis as { DecompressionStream?: unknown };
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream');
  delete g.DecompressionStream;
  assert.equal(typeof g.DecompressionStream, 'undefined');
  try {
    return await fn();
  } finally {
    if (saved) Object.defineProperty(globalThis, 'DecompressionStream', saved);
  }
}

test('W9-E-review (E-RC-1): every published city file inflates without DecompressionStream, byte for byte as zlib', async () => {
  const { gunzip } = await import('../src/opus-bay/world/sf/format');
  const files = [
    'far.obc', 'graph.obc',
    ...fs.readdirSync(path.join(SF, 'boards')).filter(f => f.endsWith('.obb')).map(f => `boards/${f}`),
    ...fs.readdirSync(path.join(SF, 'c')).filter(f => f.endsWith('.obc')).map(f => `c/${f}`),
  ];
  assert.ok(files.length > 100, `${files.length} files`);
  await withoutDecompressionStream(async () => {
    for (const f of files) {
      const raw = new Uint8Array(fs.readFileSync(path.join(SF, f)));
      assert.deepEqual([raw[0], raw[1]], [0x1f, 0x8b], `${f} is raw gzip (the server sends no Content-Encoding)`);
      const got = await gunzip(raw);
      assert.ok(Buffer.from(got).equals(zlib.gunzipSync(raw)), f);
    }
  });
  // and the engines that have the stream still use it (same bytes)
  const far = new Uint8Array(fs.readFileSync(path.join(SF, 'far.obc')));
  assert.ok(Buffer.from(await gunzip(far)).equals(zlib.gunzipSync(far)));
});

test('W9-E-review (E-RC-1): the fallback inflate matches zlib on every block type and gzip header flag', async () => {
  const { gunzipSync } = await import('../src/opus-bay/world/sf/inflate');
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const text = Buffer.from('湾区小旅 Little Bay Trip · Ferry Building, Coit Tower, 金门大桥 '.repeat(900));
  const noise = Buffer.from(Array.from({ length: 90_000 }, () => Math.floor(rnd() * 256)));
  const mixed = Buffer.concat([text.subarray(0, 5000), noise.subarray(0, 3000), text, Buffer.alloc(70_000, 7)]);
  const inputs = [Buffer.alloc(0), Buffer.from('a'), text, noise, mixed];
  const C = zlib.constants;
  const opts: zlib.ZlibOptions[] = [
    { level: 0 }, { level: 1 }, { level: 6 }, { level: 9 },
    { strategy: C.Z_FIXED }, { strategy: C.Z_HUFFMAN_ONLY }, { strategy: C.Z_RLE }, { level: 9, memLevel: 1, windowBits: 9 },
  ];
  for (const [i, input] of inputs.entries()) for (const o of opts) {
    const gz = new Uint8Array(zlib.gzipSync(input, o));
    assert.ok(Buffer.from(gunzipSync(gz)).equals(input), `input ${i} ${JSON.stringify(o)}`);
  }
  // header flags: FEXTRA, FNAME, FCOMMENT, FHCRC (zlib writes none of them)
  const gz = zlib.gzipSync(text);
  const head = Buffer.from(gz.subarray(0, 10));
  head[3] = 4 | 8 | 16 | 2;
  const flagged = Buffer.concat([head, Buffer.from([3, 0, 1, 2, 3]), Buffer.from('city.obc\0'), Buffer.from('a comment\0'), Buffer.from([0, 0]), gz.subarray(10)]);
  assert.ok(Buffer.from(gunzipSync(new Uint8Array(flagged))).equals(text));
  // two members, as DecompressionStream reads them
  const two = Buffer.concat([zlib.gzipSync(text), zlib.gzipSync(noise)]);
  assert.ok(Buffer.from(gunzipSync(new Uint8Array(two))).equals(Buffer.concat([text, noise])));
  // broken data throws (the worker posts it as an error, like the stream's TypeError)
  assert.throws(() => gunzipSync(new Uint8Array(gz.subarray(0, gz.length - 40))));
  assert.throws(() => gunzipSync(new Uint8Array([0x1f, 0x8b, 9, 0, 0, 0, 0, 0, 0, 0, 1])));
});
