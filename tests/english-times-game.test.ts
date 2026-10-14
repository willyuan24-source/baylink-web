import assert from 'node:assert/strict';
import test, { after } from 'node:test';

/**
 * H41 with the site's switch, as production runs it: main.tsx imports i18n/metadata (US-style English times and dates)
 * for every route, /opus-bay included. The Opus Bay game reads the same English dictionary through translateText and
 * keeps the dictionary's formats on its own pages (/opus-bay, /play); tests/opus-bay-w9-r-words.test.ts W9-R5 pins them
 * without the switch. Review 10-14: this checks it with the switch on.
 */
const { isGamePage } = await import('../src/i18n/metadata');
const L = await import('../src/i18n/locale');
const { publicText } = await import('../src/opus-bay/data/publicText');

const OPERA_DATE = '9/29–10/4 · 9/29、10/2 19:30；10/4 14:00；节目页时长约 2 小时 51 分钟';
const scope = globalThis as { window?: unknown };
const hadWindow = 'window' in scope;
/** The page the reader is on (the switch reads window.location.pathname; tests run without a DOM). */
const onPage = (pathname: string) => { scope.window = { location: { pathname } }; };
after(async () => {
  if (!hadWindow) delete scope.window;
  await L.setLocale('zh-Hans', false);
});

test('H41: the game’s own pages are /opus-bay and /play, in every language', () => {
  for (const path of ['/opus-bay', '/opus-bay/', '/en/opus-bay', '/zh-Hant/opus-bay', '/opus-bay.html', '/play', '/en/play']) assert.equal(isGamePage(path), true, path);
  for (const path of ['/', '/en', '/en/events', '/events/sf-opera-mary-queen', '/player', '/en/plan', '/guides/opus-bay-tips']) assert.equal(isGamePage(path), false, path);
});

test('H41: with the site switch on, the game keeps the dictionary’s formats on its pages; site pages read US style', async () => {
  await L.setLocale('en', false);
  onPage('/en/opus-bay');
  assert.equal(publicText(OPERA_DATE, 'en'), '9/29–10/4 · 9/29 and 10/2 at 19:30; 10/4 at 14:00. Running time: about 2 hours 51 minutes.');
  assert.equal(L.translateText('10/18 · 14:00–16:00', 'en'), '10/18 · 14:00–16:00', 'a neutral date line stays as it is in the game');
  assert.equal(L.translateText('14:00–16:00', 'en'), '14:00–16:00');
  onPage('/play');
  assert.match(publicText(OPERA_DATE, 'en'), /at 19:30; 10\/4 at 14:00\./);

  onPage('/en/events/sf-opera-mary-queen');
  assert.equal(publicText(OPERA_DATE, 'en'), 'Sep 29–Oct 4 · Sep 29 and Oct 2 at 7:30pm; Oct 4 at 2pm. Running time: about 2 hours 51 minutes.');
  assert.match(L.translateText('10/18 · 14:00–16:00', 'en'), /^Oct 18 · 2–4\s?p\.?m\.?$/);
  assert.equal(L.translateText('14:00–16:00', 'en'), '2–4pm');

  // back in the game (a full-page load in production; here the same module): the formats come back
  onPage('/en/opus-bay');
  assert.equal(publicText(OPERA_DATE, 'en'), '9/29–10/4 · 9/29 and 10/2 at 19:30; 10/4 at 14:00. Running time: about 2 hours 51 minutes.');
});
