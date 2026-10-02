import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

/**
 * Wave 9 · lane S · the Ultra review's fixes (docs/opus-bay/sf-w9-S.md "Review (Ultra)").
 *   S-RV-1  保存 / 分享 on the 约家人 card and in the album said what they did only by toast; the title host (ui/titleHost.ts
 *           modalUp, lane F W9-F2) holds every toast while a card / panel or a held overlay is up and drops it after
 *           10 s — so in WeChat both buttons of the card did nothing visible (the review's R§6 problem again)
 *   S-RV-2  the card's long-press route never counted opus_share_card; a desktop right-click did
 *   S-RV-5  the card's overlay was not on BAYBAY's hold list
 * Virtual time (the title host's waits).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
let clock = 80_000;
mock.method(performance, 'now', () => clock);
mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
const advance = (ms: number) => { for (let left = ms; left > 0; left -= 100) { clock += Math.min(100, left); mock.timers.tick(Math.min(100, left)); } };

const { game, toast } = await import('../src/opus-bay/core/store');
const A = await import('../src/opus-bay/game/attention');
const H = await import('../src/opus-bay/ui/titleHost');
const F = await import('../src/opus-bay/ui/shareFile');
const { BAYBAY_HOLD_OVERLAYS } = await import('../src/opus-bay/game/baybayHold');
const { SHARE_CARD_ID } = await import('../src/opus-bay/ui/shareCardModel');
const off = H.initTitleHost();
const shown = () => { const s = H.titleHostState(); return s.toast ? (typeof s.toast.text === 'string' ? s.toast.text : s.toast.text.zh) : null; };
const src = (p: string) => readFileSync(new URL(`../src/opus-bay/${p}`, import.meta.url), 'utf8');

// (W9-I, F-RC-1 / F-RP-2) the cause is fixed in ui/titleHost.ts: a toast raised under a panel / card shows at once. The
// sheet still says what 保存 / 分享 did in its own status line (the next test). Before W9-I: held, then dropped after 10 s.
test('S-RV-1 (the cause) / W9-I: under an event card a toast is the card’s own feedback and shows at once, then goes', () => {
  advance(20_000); A.clearAttention(); game.set({ dialogue: { nodeId: null }, panel: { kind: null } }); advance(3000);
  game.set({ panel: { kind: 'event' } });
  advance(200);
  assert.equal(H.modalUp(), true);
  toast({ zh: '长按图片，保存或发给家人', en: 'Press and hold the picture to save or send it' }, 'info', 2600);
  advance(200);
  assert.equal(shown(), '长按图片，保存或发给家人', 'at once, beside the card');
  advance(11_000);
  game.set({ panel: { kind: null } });
  advance(3000);
  assert.notEqual(shown(), '长按图片，保存或发给家人', 'gone after its time, not shown again');
  off();
  mock.timers.reset();
});

test('S-RV-1: the 约家人 card and the album viewer say what 保存 / 分享 did in the sheet (a status line), never by toast', () => {
  const card = src('ui/ShareCard.tsx');
  assert.doesNotMatch(card, /\btoast\(/, 'ShareCard.tsx calls no toast()');
  assert.match(card, /role="status"/);
  const album = src('ui/Album.tsx');
  assert.doesNotMatch(album, /toast\(\s*(copied \? )?ALBUM_TEXT\.(saved|linkCopied)/, 'the album viewer toasts neither 照片已保存 nor the link copied');
  assert.match(album, /className="ob-album-press-hint ob-share-note" role="status"/);
});

test('S-RV-1 / S-RV-2: sendNote — the long-press route says why and counts 分享; a download says saved / copied and counts 分享 only', () => {
  assert.deepEqual(F.sendNote('longpress', true), { note: 'press', counts: false });
  assert.deepEqual(F.sendNote('longpress', false), { note: 'press', counts: true });
  assert.deepEqual(F.sendNote('download', true), { note: 'saved', counts: false });
  assert.deepEqual(F.sendNote('download', true, true), { note: 'saved', counts: false });
  assert.deepEqual(F.sendNote('download', false, true), { note: 'copied', counts: true });
  assert.deepEqual(F.sendNote('download', false, false), { note: 'saved', counts: true });
});

test('S-RV-2: a right-click on the card picture counts only on a touch device (a long press there), not on a desktop', () => {
  const card = src('ui/ShareCard.tsx');
  assert.match(card, /onContextMenu=\{\(\) => \{ if \(touch\) countOnce\(\); \}\}/);
  assert.match(card, /if \(route === 'longpress'\) \{ say\(sendNote\(route, asSave\)\); return; \}/);
});

test('S-RV-5: the 约家人 sheet is on BAYBAY\'s hold list', () => {
  assert.ok(BAYBAY_HOLD_OVERLAYS.includes(SHARE_CARD_ID), SHARE_CARD_ID);
});
