import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * W6-K2: content and flow fixes. Part a: International Orange is 国际橙 everywhere a player reads it (the lead's
 * decision, sf-w6-lead.md §6; the colour's name: goldengate.org "Color & Art Deco Styling", checked 2026-09-29), the
 * shop's item ids unchanged (saves keep them), 繁體 through the site's conversion.
 */

const ROOT = path.resolve(import.meta.dirname, '..');
const { ITEMS } = await import('../src/opus-bay/economy/items');
const L = await import('../src/i18n/locale');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('W6-K2: International Orange is 国际橙 in every shop item (ids unchanged), English "International Orange"', async () => {
  const orange = ['scarf-orange', 'my-pack-orange', 'bike-orange'].map(id => ITEMS.find(i => i.id === id));
  for (const it of orange) {
    assert.ok(it, 'the item ids stay (save compatibility)');
    assert.match(it.name.zh, /^国际橙/);
    assert.equal(it.short.zh, '国际橙');
    assert.match(it.name.en, /^International Orange /);
    assert.equal(it.short.en, 'Int’l Orange');
  }
  assert.equal(ITEMS.find(i => i.id === 'scarf-orange')!.note!.zh, '金门大桥的颜色就叫国际橙');
  // 繁體 goes through the site's conversion (opencc cn → tw)
  await L.loadLocale('zh-Hant');
  assert.equal(L.translateText('国际橙围巾', 'zh-Hant'), '國際橙圍巾');
  assert.equal(L.translateText('国际橙', 'zh-Hant'), '國際橙');
});

test('W6-K2: no player-read text in the game says 国际橘 any more (code comments aside)', () => {
  const hits: string[] = [];
  for (const f of walk(path.join(ROOT, 'src/opus-bay'))) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (code.includes('国际橘') && !/^\s*\*/.test(line)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, []);
});
