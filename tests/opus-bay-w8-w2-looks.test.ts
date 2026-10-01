import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { readGlbMesh } from '../scripts/opus-sf/assets/glbNode';
import { ASSETS } from '../src/opus-bay/data/assets';
import { IGN_SHELLS } from '../src/opus-bay/world/sf/landmarks/st-ignatius';

/**
 * Wave 8 · lane W2 · part c: the neighbourhood looks. St Ignatius's lead cupolas and dome are shells drawn over the AI
 * church's cream ones (world/sf/landmarks/st-ignatius.ts IGN_SHELLS): no vertex of the model may poke through a shell
 * (a 12-sided lathe's faces sit at cos(π / 12) of its profile radius).
 */

test('W8-W2 St Ignatius: the lead shells cover the AI model\'s cupolas and dome everywhere (no cream pokes through)', async () => {
  const m = await readGlbMesh(ASSETS.models['sf-st-ignatius'].url, path.resolve(import.meta.dirname, '../public'));
  const p = m.positions;
  const shells: { cx: number; cz: number; y0: number; profile: readonly (readonly [number, number])[]; seg: number }[] = [
    ...IGN_SHELLS.cupola.at.map(([cx, cz]) => ({ cx, cz, y0: IGN_SHELLS.cupola.y0, profile: IGN_SHELLS.cupola.profile, seg: 12 })),
    { cx: IGN_SHELLS.dome.at[0], cz: IGN_SHELLS.dome.at[1], y0: IGN_SHELLS.dome.y0, profile: IGN_SHELLS.dome.profile, seg: 12 },
    { cx: IGN_SHELLS.cap.at[0], cz: IGN_SHELLS.cap.at[1], y0: IGN_SHELLS.cap.y0, profile: IGN_SHELLS.cap.profile, seg: 12 },
  ];
  /** the shell's inner radius at height y over its foot (linear between profile points) */
  const rAt = (prof: readonly (readonly [number, number])[], dy: number) => {
    for (let i = 1; i < prof.length; i++) if (dy <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * ((dy - y0) / (y1 - y0 || 1)); }
    return 0;
  };
  let checked = 0;
  for (const s of shells) {
    const top = s.profile[s.profile.length - 1][1];
    for (let i = 0; i < p.length / 3; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2], dy = y - s.y0;
      // the shell's span less its very tip (the cross's stem / the finial rise through it)
      if (dy < 0.02 || dy > top - 0.2) continue;
      const d = Math.hypot(x - s.cx, z - s.cz), inner = rAt(s.profile, dy) * Math.cos(Math.PI / s.seg);
      if (d > inner + 1.2) continue;
      checked++;
      assert.ok(d <= inner + 0.005, `a model vertex at y ${y.toFixed(2)}, r ${d.toFixed(2)} pokes through the shell (inner r ${inner.toFixed(2)})`);
    }
  }
  assert.ok(checked > 200, `${checked} vertices checked`);
});
