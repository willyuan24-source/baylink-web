// UI9-R2 batch 2 (SHARE-HUB review nits): the hub share cards keep their pictures under 290 KB (the generator gives them a
// byte budget; verify:share-cards checks the limit on the built cards), and the home page's og:image:alt says what its hub
// card shows now (its title and source line), not the picks list the card no longer carries.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file: string) => readFileSync(file, 'utf8');

test('every hub card is rasterized to a byte budget under the 290 KB limit verify:share-cards checks', async () => {
  const { HUB_CARD_BUDGET, HUB_CARD_LIMIT } = await import('../scripts/share-card-worker.mjs');
  assert.ok(HUB_CARD_BUDGET < HUB_CARD_LIMIT && HUB_CARD_LIMIT <= 290_000, `${HUB_CARD_BUDGET} < ${HUB_CARD_LIMIT} ≤ 290000`);
  assert.match(read('scripts/generate-share-cards.ts'), /queue\(finish\(svg\), filePath\(hubCardPath\(name\), locale\), HUB_CARD_BUDGET\)/);
  assert.match(read('scripts/verify-share-cards.ts'), /bytes > HUB_CARD_LIMIT/);
});

test('the home og:image:alt is the home hub card\'s title and source line, with no 本周末精选 picks', async () => {
  const { HOME_CARD_ALT, hubCardModel } = await import('../src/lib/share-card-model');
  const data = { weekend: [], range: '10/24–25', tools: [], guideCount: 1 };
  const zh = hubCardModel('home', 'zh-Hans', text => text, data), en = hubCardModel('home', 'en', text => text, data);
  for (const [alt, model] of [[HOME_CARD_ALT.zh, zh], [HOME_CARD_ALT.en, en]] as const) {
    assert.ok(alt.includes(model.title), `${alt} names the card's title`);
    assert.ok(alt.includes(String(model.meta?.[1])), `${alt} carries the card's source line`);
    assert.doesNotMatch(alt, /精选|picks/);
  }
  const prerender = read('scripts/prerender.tsx');
  assert.match(prerender, /image: HUB_CARDS\.home, imageAlt: HOME_CARD_ALT\.zh, english: \{ imageAlt: HOME_CARD_ALT\.en \}/);
  assert.doesNotMatch(prerender, /本周末精选'|BAYLINK picks/);
});
