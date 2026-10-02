import assert from 'node:assert/strict';
import test from 'node:test';
import jsQR from 'jsqr';

// Wave 9 · lane S · W9-S2 (review R§5 #8): the photo card's way back — the address and a QR code under the picture that
// opens the game at the same spot (`?at=<spot>&from=photo`), sized to survive WeChat's re-encode, clear of the shop
// frames' ring; the code decodes (jsQR) at the card's own size and at WeChat's ≈ 1280 px.

const P = await import('../src/opus-bay/game/photoCard');
const { ringWidth } = await import('../src/opus-bay/economy/frames');

/** A tiny raster that understands fillStyle '#ffffff' / anything else = dark, fillRect, roundRect-less. */
function raster(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  let dark = false;
  const ctx = {
    set fillStyle(v: string) { dark = v.toLowerCase() !== '#ffffff'; },
    get fillStyle() { return dark ? '#000' : '#ffffff'; },
    beginPath() {}, fill() {},
    fillRect(x: number, y: number, rw: number, rh: number) {
      for (let yy = Math.max(0, Math.round(y)); yy < Math.min(h, Math.round(y + rh)); yy++) {
        for (let xx = Math.max(0, Math.round(x)); xx < Math.min(w, Math.round(x + rw)); xx++) { const i = (yy * w + xx) * 4; const v = dark ? 31 : 255; px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255; }
      }
    },
  };
  return { px, ctx };
}
/** box-filter downscale (what a re-encode to a smaller width does to the modules, roughly) */
function downscale(px: Uint8ClampedArray, w: number, h: number, k: number) {
  const W = Math.floor(w * k), H = Math.floor(h * k), out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let yy = Math.floor(y / k); yy < Math.min(h, Math.floor((y + 1) / k)); yy++) for (let xx = Math.floor(x / k); xx < Math.min(w, Math.floor((x + 1) / k)); xx++) { s += px[(yy * w + xx) * 4]; n++; }
    const v = n ? s / n : 255, i = (y * W + x) * 4; out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
  }
  return { out, W, H };
}

test('gameLink: the canonical address with ?at= (literal : and ,) and from=; a bad spot is dropped', () => {
  assert.equal(P.gameLink('fishermans-wharf', 'photo'), 'https://www.baylink.us/opus-bay?at=fishermans-wharf&from=photo');
  assert.equal(P.gameLink('xz:-94,-22', 'family'), 'https://www.baylink.us/opus-bay?at=xz:-94,-22&from=family');
  assert.equal(P.gameLink('<script>', 'photo'), 'https://www.baylink.us/opus-bay?from=photo');
  assert.equal(P.gameLink(null, 'photo'), 'https://www.baylink.us/opus-bay?from=photo');
  assert.ok(!P.gameLink('ggb-south-tower', 'photo').includes('Opus'), 'no user-visible "Opus Bay"');
});

test('photoSpot: a landmark beats a curated place beats xz; stations and bad ids are skipped; a throwing lookup = xz', async () => {
  const near = () => [{ id: 'some-cafe' }, { id: 'powell-station', station: true, curated: true }, { id: 'pier-39', curated: true }, { id: 'coit-tower', landmark: 'coit-tower' }];
  assert.equal(P.photoSpot(10, 20, near), 'coit-tower');
  assert.equal(P.photoSpot(10, 20, () => [{ id: 'some-cafe' }, { id: 'pier-39', curated: true }]), 'pier-39');
  assert.equal(P.photoSpot(10.4, -20.6, () => [{ id: 'some-cafe' }]), 'xz:10,-21');
  assert.equal(P.photoSpot(1, 2, () => [{ id: 'Bad Id!', landmark: 'x' }]), 'xz:1,2');
  assert.equal(P.photoSpot(1, 2, () => { throw new Error('no index'); }), 'xz:1,2');
  assert.equal(P.photoSpot(1, 2), 'xz:1,2');
  // the game resolves what photoSpot gives (game/qa.ts parseAt)
  const { parseAt } = await import('../src/opus-bay/game/qa');
  assert.deepEqual(parseAt('xz:10,-21'), { kind: 'xz', x: 10, z: -21 });
  assert.deepEqual(parseAt('coit-tower'), { kind: 'id', id: 'coit-tower' });
});

test('bandLayout: the QR box sits in the band, right-aligned on the margin, clear of every shop frame ring; text left of it', () => {
  for (const [w, h] of [[1170, 2532], [1800, 1013], [1800, 1125], [780, 1688], [1280, 720], [360, 640]]) {
    const L = P.bandLayout(w, h);
    const cardW = w + L.pad * 2;
    const t = ringWidth({ pad: L.pad, band: { x: 0, y: h + L.pad, w: cardW, h: L.band } });
    assert.equal(L.qr.x + L.qr.size, cardW - L.pad, `${w}x${h} right margin`);
    assert.ok(L.qr.y > t && L.qr.y + L.qr.size < L.band - t, `${w}x${h} clear of the ring top / bottom (t ${t})`);
    assert.ok(cardW - (L.qr.x + L.qr.size) > t, `${w}x${h} clear of the ring right`);
    assert.ok(L.textX + L.textW <= L.qr.x, `${w}x${h} text left of the code`);
    assert.ok(L.band >= 160 && L.band >= h * 0.13 - 1 && L.band >= w * 0.14 - 1, `${w}x${h} band ${L.band}`);
    // ≈ 3 px (≥ 2.85) a module after WeChat's re-encode to 1280 px on the long side (a v5 code: 37 modules + 2 × 2 quiet)
    const k = Math.min(1, 1280 / Math.max(cardW, h + L.pad + L.band));
    assert.ok((L.qr.size / 41) * k >= 2.85, `${w}x${h}: ${((L.qr.size / 41) * k).toFixed(2)} px a module at 1280`);
  }
});

test('loadQr + drawQr: the code decodes at the card size and after a downscale to WeChat\'s 1280 px', async () => {
  const url = P.gameLink('bay-bridge-center-anchorage', 'photo');
  const qr = await P.loadQr(url);
  assert.ok(qr && qr.size >= 21, 'qrcode loads in node');
  for (const [w, h] of [[1800, 1013], [1170, 2532]]) {
    const L = P.bandLayout(w, h);
    const box = { x: 10, y: 10, size: L.qr.size };
    const { px, ctx } = raster(L.qr.size + 20, L.qr.size + 20);
    const cell = P.drawQr(ctx, qr!, box);
    assert.ok(cell >= 3.9, `${w}x${h}: ${cell.toFixed(2)} px a module`);
    const side = L.qr.size + 20;
    assert.equal(jsQR(px, side, side)?.data, url, `${w}x${h} at size`);
    const cardW = w + L.pad * 2, k = Math.min(1, 1280 / Math.max(cardW, h + L.pad + L.band));
    const small = downscale(px, side, side, k);
    assert.equal(jsQR(small.out, small.W, small.H)?.data, url, `${w}x${h} at ×${k.toFixed(2)}`);
  }
});

test('photoLink: a kept photo links to its spot; an older photo (no spot) to where it was taken; nothing known = the game', () => {
  assert.equal(P.photoLink({ spot: 'coit-tower', x: 1, z: 2 }), 'https://www.baylink.us/opus-bay?at=coit-tower&from=photo');
  assert.equal(P.photoLink({ x: -93.6, z: -21.8 }), 'https://www.baylink.us/opus-bay?at=xz:-94,-22&from=photo');
  assert.equal(P.photoLink({}), 'https://www.baylink.us/opus-bay?from=photo');
});

test('sharePayload (W9-S2): 分享 = title + words + url where the browser takes a url with a file, else the url in the words, else the file; 保存 = the file', async () => {
  const { sharePayload } = await import('../src/opus-bay/ui/shareFile');
  const f = new File([new Uint8Array(4)], 'little-bay-trip-x.jpg', { type: 'image/jpeg' });
  const sharer = (ok: (d: ShareData) => boolean) => ({ share: async () => {}, canShare: ok });
  const words = { title: '湾区小旅', text: '我在 BAYLINK 的湾区小旅拍的照片', url: 'https://www.baylink.us/opus-bay?at=coit-tower&from=photo' };
  assert.deepEqual(sharePayload(sharer(() => true), f, words, false), { files: [f], title: '湾区小旅', text: words.text, url: words.url });
  assert.deepEqual(sharePayload(sharer(d => !d.url), f, words, false), { files: [f], title: '湾区小旅', text: `${words.text} ${words.url}` });
  assert.deepEqual(sharePayload(sharer(d => !d.text && !d.title), f, words, false), { files: [f] });
  assert.deepEqual(sharePayload(sharer(() => true), f, words, true), { files: [f] }, '保存 stays the file alone (iOS keeps 存储图像)');
  for (const v of Object.values(sharePayload(sharer(() => true), f, { ...words, title: 'Little Bay Trip' }, false))) assert.ok(!String(v).includes('Opus Bay'));
});

test('refusedShareRoute: the player\'s cancel ends it; a host app\'s refusal = the long-press photo (WeChat, iOS) or a download', async () => {
  const { refusedShareRoute } = await import('../src/opus-bay/ui/shareFile');
  const WECHAT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
  const abort = Object.assign(new Error('Share canceled'), { name: 'AbortError' });
  const denied = Object.assign(new Error('not allowed'), { name: 'NotAllowedError' });
  assert.equal(refusedShareRoute(abort, { userAgent: WECHAT }), null);
  assert.equal(refusedShareRoute(denied, { userAgent: WECHAT }), 'longpress');
  assert.equal(refusedShareRoute(new TypeError('bad data'), { userAgent: ANDROID }), 'download');
  assert.equal(refusedShareRoute(denied, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' }), 'longpress');
  assert.equal(refusedShareRoute(undefined, null), 'download');
});

test('the photo caption\'s date is short (10月1日 / Oct 1), so it is not cut on a phone (Moments.tsx)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/opus-bay/ui/Moments.tsx', 'utf8');
  const m = /const date = new Intl\.DateTimeFormat\(locale === 'en' \? 'en-US' : 'zh-CN', (\{[^}]*\})\)/.exec(src);
  assert.ok(m, 'the shutter\'s date format');
  assert.ok(!m![1].includes('year'), m![1]);
  const opts = { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' } as const;
  const at = new Date('2026-10-01T20:00:00Z');
  assert.equal(new Intl.DateTimeFormat('zh-CN', opts).format(at), '10月1日');
  assert.equal(new Intl.DateTimeFormat('en-US', opts).format(at), 'Oct 1');
});
