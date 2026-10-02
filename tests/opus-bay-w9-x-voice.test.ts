/**
 * Wave 9 · lane X (W9-X2): BAYBAY's voice coverage — every fixed BAYBAY line (zh + en) and whether it has a clip
 * (scripts/opus-sf/voice/w9/coverage.ts; the number of record is in docs/opus-bay/sf-w9-X.md).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

test('W9-X2 · voice coverage: ≥ 95 % of BAYBAY\'s fixed lines are voiced (zh + en, not muted); every unvoiced / muted / reworded line is listed', async (t) => {
  const { coverage } = await import('../scripts/opus-sf/voice/w9/coverage');
  const c = await coverage();
  t.diagnostic(`BAYBAY fixed lines ${c.lines}: voiced ${c.voiced} (${c.pct} %), muted ${c.muted}, unvoiced ${c.unvoiced}; recorded but reworded ${c.dead.length}`);
  for (const r of c.rows) if (r.status !== 'voiced') t.diagnostic(`${r.status} ${r.id} ${r.zh} | ${r.en}`);
  for (const d of c.dead) t.diagnostic(`reworded (silent until re-recorded) ${d.id} (${d.table}) ${d.zh}`);
  assert.ok(c.lines >= 590, `${c.lines} lines: the inventory lost lines (a scan broke?)`);
  assert.equal(c.lines, c.voiced + c.muted + c.unvoiced);
  // a lane may add a line after lane X's last batch (it plays as text only until recorded): a floor, not 100 %
  assert.ok(c.pct >= 95, `voice coverage ${c.pct} % < 95 %`);
  // the two families: the bubbles the binder matches by text, the lines the lanes play by id (tour, city lines)
  assert.ok(c.byFamily.text.lines >= 440 && c.byFamily.id.lines >= 140, JSON.stringify(c.byFamily));
  assert.equal(c.byFamily.id.unvoiced, 0, 'every tour / city line played by id has both clips');
});

test('W9-X2 · coverage rows: a recorded line counts once (the earliest table wins, as in the binder); no row is a template', async () => {
  const { coverage } = await import('../scripts/opus-sf/voice/w9/coverage');
  const c = await coverage();
  const seen = new Set<string>();
  for (const r of c.rows.filter(x => x.family === 'text')) {
    const k = `${r.zh}\n${r.en}`;
    assert.ok(!seen.has(k), `${r.id}: counted twice`);
    seen.add(k);
    assert.ok(!/\$\{/.test(r.zh + r.en), `${r.id} is a template`);
  }
});
