import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 8 · lane H · Halloween live polish (sf-w8-H.md):
 *
 *   W8-H2  the big night's toast says where the candies come from: 万圣夜糖果加倍 (×2, a door knocked before) and
 *          新门 + 万圣夜加倍 (×3, a door never knocked: its first treat + the night's double) — halloween/treat.ts
 *   W8-H3  the city's fallback goals card (ui/Moments.tsx GoalsCard) has a one-line Halloween row in the season: the
 *          goals row's `Mini` (ui/slots GoalsRowSlot), registered by halloween/play.ts with the journal's block
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;
const store = new Map<string, string>();
g.localStorage ??= { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, length: 0 };

const treat = await import('../src/opus-bay/halloween/treat');

test('W8-H2 the big night toast: ×2 at a door knocked before says the night doubles; ×3 at a new door names both', () => {
  const c = treat.CANDIES.find(x => x.id === 'chocolate') ?? treat.CANDIES[0];
  const two = treat.treatToast(c, true, 2, 5, 12), three = treat.treatToast(c, true, 3, 10, 3), one = treat.treatToast(c, false, 1, 5, 4);
  assert.match(two.zh, /^万圣夜糖果加倍：/);
  assert.match(two.en, /^Halloween night, treats doubled: /);
  assert.match(three.zh, /^新门 \+ 万圣夜加倍：.+ ×3！\+10 金币/);
  assert.match(three.en, /^New door \+ Halloween double: .+ ×3! \+10 coins/);
  assert.match(one.zh, /^得到/);
  assert.match(one.en, /^Treat: /);
  for (const t of [two, three]) assert.ok(!/双倍糖果|Double treat/.test(t.zh + t.en), 'the old wording is gone');
  // a phone toast wraps to two lines at most: short with every candy (the old ×3 toast was 30 / 58 characters)
  for (const k of treat.CANDIES) { const t = treat.treatToast(k, true, 3, 10, 30); assert.ok(t.zh.length <= 36 && t.en.length <= 80, `${t.zh} / ${t.en}`); }
});

test('W8-H3 the fallback goals card: the Halloween goals row has a one-line Mini in the season (next goal + count), none after', async () => {
  const slots = await import('../src/opus-bay/ui/slots');
  const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
  const { initHalloweenPlay } = await import('../src/opus-bay/halloween/play');
  const { HalloweenGoalsMini } = await import('../src/opus-bay/halloween/playGoalsRow');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement: h } = await import('react');
  __setBayNowForTests(new Date('2026-10-12T19:00:00Z'));
  let undo = initHalloweenPlay();
  try {
    const row = slots.goalsRows.get('g-halloween');
    assert.equal(row?.Mini, HalloweenGoalsMini);
    const html = renderToStaticMarkup(h(HalloweenGoalsMini));
    assert.match(html, /万圣节目标|Halloween goals/);
    assert.match(html, /0\/3/);
    assert.match(html, /敲开 5 户人家的门|Knock on 5 doors/);
    assert.match(html, /0\/5/);
    // the card renders the Mini of every row that has one (ui/Moments.tsx GoalsRowsMini)
    const src = (await import('node:fs')).readFileSync(new URL('../src/opus-bay/ui/Moments.tsx', import.meta.url), 'utf8');
    assert.match(src, /\{city && <GoalsRowsMini \/>\}/);
    assert.match(src, /r\.Mini \? <r\.Mini key=\{r\.id\} \/> : null/);
  } finally { undo(); }
  __setBayNowForTests(new Date('2026-11-20T19:00:00Z'));
  undo = initHalloweenPlay();
  try { assert.equal(slots.goalsRows.get('g-halloween'), undefined); } finally { undo(); __setBayNowForTests(null); }
});
