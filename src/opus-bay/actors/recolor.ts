import * as THREE from 'three';

/**
 * Wave 5 (W5-F2) · recolour a clay rig in place: the characters and the rideable toys are ONE vertex-coloured skinned
 * mesh each on the shared clay material (actors/models.ts buildRig), so a wearable colour (the player's hat and
 * backpack, BAYBAY's procedural scarf, a bike livery, the toy car's paint, the pelican's ribbon) is a rewrite of the
 * matching vertices' colours — no new material, no new program, no extra draw call.
 *
 * A vertex matches a rule when its ORIGINAL colour is the rule's base colour times one factor in [0.8, 1.02] (buildRig
 * darkens toward the feet by 0.86–1: the factor is kept, so the soft shading stays). Matching always reads the
 * original colours (kept once per geometry), so recolouring again replaces the last paint and `null` restores it.
 */

const originals = new WeakMap<THREE.BufferGeometry, Float32Array>();
const TOL = 0.012;

/** One rule: vertices of base colour `from` take `to` (null: back to their own colour). */
export type RecolorRule = readonly [from: THREE.ColorRepresentation, to: THREE.ColorRepresentation | null];

/**
 * Recolour the geometry's vertices that match a rule (first rule wins), optionally only those skinned to one of
 * `bones` (skin indices). Returns how many vertices matched. A geometry without colours matches nothing.
 */
export function recolorGeometry(geo: THREE.BufferGeometry, rules: readonly RecolorRule[], bones?: ReadonlySet<number>): number {
  const col = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!col || !rules.length) return 0;
  let orig = originals.get(geo);
  if (!orig) { orig = Float32Array.from(col.array as ArrayLike<number>); originals.set(geo, orig); }
  const skin = geo.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const bases = rules.map(([f]) => new THREE.Color(f));
  const sums = bases.map(b => b.r + b.g + b.b);
  const targets = rules.map(([, t]) => (t === null ? null : new THREE.Color(t)));
  let n = 0;
  for (let i = 0; i < col.count; i++) {
    if (bones && skin && !bones.has(skin.getX(i))) continue;
    const r = orig[i * 3], g = orig[i * 3 + 1], b = orig[i * 3 + 2];
    for (let k = 0; k < bases.length; k++) {
      const B = bases[k];
      if (sums[k] < 1e-4) continue;
      const f = (r + g + b) / sums[k];
      if (f < 0.8 || f > 1.02) continue;
      if (Math.abs(r - B.r * f) > TOL || Math.abs(g - B.g * f) > TOL || Math.abs(b - B.b * f) > TOL) continue;
      const T = targets[k];
      if (T) col.setXYZ(i, T.r * f, T.g * f, T.b * f); else col.setXYZ(i, r, g, b);
      n++;
      break;
    }
  }
  if (n) col.needsUpdate = true;
  return n;
}

/** Skin indices of the named bones in a skinned mesh (unknown names are skipped). */
export function boneIndices(mesh: THREE.SkinnedMesh, names: readonly string[]): Set<number> {
  const out = new Set<number>();
  const bones = mesh.skeleton?.bones ?? [];
  for (const name of names) { const i = bones.findIndex(b => b.name === name); if (i >= 0) out.add(i); }
  return out;
}

/** A darker shade of a colour (the band of a hat, the dark tube of a frame): HSL lightness × k. */
export function shade(color: THREE.ColorRepresentation, k: number): THREE.Color {
  const c = new THREE.Color(color), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k)));
}

/** How many vertices show `color` now (times a shading factor), optionally among `bones` — QA and tests, read-only. */
export function countColor(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, bones?: ReadonlySet<number>): number {
  const col = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!col) return 0;
  const skin = geo.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
  const B = new THREE.Color(color), sum = B.r + B.g + B.b;
  let n = 0;
  for (let i = 0; i < col.count; i++) {
    if (bones && skin && !bones.has(skin.getX(i))) continue;
    const r = col.getX(i), g = col.getY(i), b = col.getZ(i), f = (r + g + b) / sum;
    if (f >= 0.8 && f <= 1.02 && Math.abs(r - B.r * f) <= TOL && Math.abs(g - B.g * f) <= TOL && Math.abs(b - B.b * f) <= TOL) n++;
  }
  return n;
}
