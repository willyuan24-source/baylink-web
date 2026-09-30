/**
 * W7-Q9 · the ?debug=1 phone lines (ui/iosDebug.ts): the short UA the owner reads off an iPhone screenshot, and the
 * silent-mode hint's words (W7-Q8).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

test('W7-Q9 shortUa: iOS version and the app (Safari, WeChat, CriOS, in-app), Android / desktop browsers', async () => {
  const { shortUa } = await import('../src/opus-bay/ui/iosDebug');
  const cases: [string, string][] = [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1', 'iOS 18.6 Safari 18.6'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003137) NetType/WIFI Language/zh_CN', 'iOS 17.5 WeChat 8.0.49'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1', 'iOS 17.5 CriOS 126'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]', 'iOS 17.5 in-app'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36', 'Android 14 Chrome 140'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0', 'Windows Edge 140'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'macOS Safari 17.5'],
  ];
  for (const [ua, want] of cases) assert.equal(shortUa(ua), want, ua);
});

test('W7-Q8 the silent-mode hint is one short line in both languages', async () => {
  const { SILENT_HINT } = await import('../src/opus-bay/ui/shareFile');
  assert.ok(SILENT_HINT.zh.includes('静音') && SILENT_HINT.zh.length <= 24, SILENT_HINT.zh);
  assert.ok(/silent/i.test(SILENT_HINT.en) && SILENT_HINT.en.length <= 60);
});
