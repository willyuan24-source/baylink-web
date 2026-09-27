import * as THREE from 'three';
import { NPC_BONES, buildRig, cyl, hemi, roundBox, sphere, torus, xf, type BoneDef, type Part, type Rig, type Vec3 } from './models';
import type { ResidentKey } from '../data/sf/residents';

/**
 * Bodies of the six city residents (lane G2, plan G2-7), after their dialogue portraits (public/opus-bay/portraits/
 * sf-npc-*.webp): the district residents' shape language (capsule torso, round head, nub arms, bean feet; actors/
 * models.ts buildNpc) on the same NPC_BONES skeleton, so the 'npc' Animator drives them unchanged. One SkinnedMesh each
 * on the shared character material (no new program); lighter spheres and capsules than buildNpc's for the small parts,
 * ≈ 3–4k triangles each (the waterfront residents are 5–6k).
 *
 * Its own chunk: actors/npcs.ts imports it dynamically when a city resident first comes within reach.
 */

interface Outfit { skin: string; shirt: string; pants: string; shoes: string; sleeves?: string; hands?: string }

const HY = 1.16; // head centre
const HR = 0.22; // head radius

/** Small parts at fewer segments than models.ts' defaults (a hand is a few pixels tall on screen). */
const ball = (r: number, pos: Vec3, scale: Vec3 | number = 1, rot: Vec3 = [0, 0, 0]) => sphere(r, pos, scale, rot, 12, 8);
const pill = (r: number, len: number, pos: Vec3, rot: Vec3 = [0, 0, 0], scale: Vec3 | number = 1) => xf(new THREE.CapsuleGeometry(r, len, 3, 10), pos, rot, scale);

/** Legs, torso, head with face, arms: buildNpc's base, coloured per resident. */
function base(o: Outfit, face: { mouth?: boolean; cheeks?: boolean } = {}): Part[] {
  const sleeves = o.sleeves ?? o.shirt, hands = o.hands ?? o.skin;
  const parts: Part[] = [
    ...[1, -1].flatMap(sd => {
      const leg = sd > 0 ? 'legL' : 'legR';
      return [
        { geo: pill(0.085, 0.1, [sd * 0.1, 0.2, 0]), color: o.pants, bone: leg },
        { geo: ball(0.11, [sd * 0.1, 0.065, 0.045], [1, 0.6, 1.35]), color: o.shoes, bone: leg },
      ];
    }),
    { geo: xf(new THREE.CapsuleGeometry(0.22, 0.5, 4, 14), [0, 0.68, 0], [0, 0, 0], [1, 1, 0.9]), color: o.shirt, bone: 'body' },
    { geo: sphere(HR, [0, HY, 0.01], 1, [0, 0, 0], 20, 14), color: o.skin, bone: 'head' },
    { geo: sphere(0.03, [0.078, HY + 0.02, HR - 0.012], [0.85, 1.2, 0.55], [0, 0, 0], 10, 8), color: '#1e1b1a', bone: 'head' },
    { geo: sphere(0.03, [-0.078, HY + 0.02, HR - 0.012], [0.85, 1.2, 0.55], [0, 0, 0], 10, 8), color: '#1e1b1a', bone: 'head' },
    { geo: sphere(0.01, [0.086, HY + 0.032, HR + 0.004], 1, [0, 0, 0], 6, 4), color: '#ffffff', bone: 'head' },
    { geo: sphere(0.01, [-0.07, HY + 0.032, HR + 0.004], 1, [0, 0, 0], 6, 4), color: '#ffffff', bone: 'head' },
    { geo: pill(0.07, 0.12, [0.29, 0.76, 0], [0, 0, 0.26]), color: sleeves, bone: 'armL' },
    { geo: pill(0.07, 0.12, [-0.29, 0.76, 0], [0, 0, -0.26]), color: sleeves, bone: 'armR' },
    { geo: ball(0.07, [0.32, 0.64, 0.02]), color: hands, bone: 'armL' },
    { geo: ball(0.07, [-0.32, 0.64, 0.02]), color: hands, bone: 'armR' },
  ];
  if (face.cheeks !== false) {
    parts.push(
      { geo: sphere(0.042, [0.125, HY - 0.05, HR - 0.05], [1, 0.6, 0.4], [0, 0, 0], 8, 6), color: '#eea08e', bone: 'head' },
      { geo: sphere(0.042, [-0.125, HY - 0.05, HR - 0.05], [1, 0.6, 0.4], [0, 0, 0], 8, 6), color: '#eea08e', bone: 'head' },
    );
  }
  if (face.mouth !== false) parts.push({ geo: torus(0.032, 0.008, [0, HY - 0.075, HR - 0.004], [0.35, 0, Math.PI], Math.PI, 10), color: '#6b3526', bone: 'head' });
  return parts;
}

/** A hair cap over the back of the head (buildNpc's). */
const hairCap = (color: string): Part => ({ geo: hemi(HR + 0.012, [0, HY + 0.012, -0.012], [1, 0.95, 1], [-0.28, 0, 0]), color, bone: 'head' });

type Look = () => Part[];

const LOOKS: Record<ResidentKey, Look> = {
  // Ray: flat cap, maroon waistcoat over a cream shirt, work gloves, a moustache
  gripman: () => [
    ...base({ skin: '#b98060', shirt: '#efe3cc', pants: '#5a4234', shoes: '#3a2c22', hands: '#c98f45' }, { mouth: false }),
    hairCap('#3b2a20'),
    { geo: hemi(HR + 0.03, [0, HY + 0.05, -0.01], [1.05, 0.55, 1.08]), color: '#6e5a4a', bone: 'head' },
    { geo: cyl(0.16, 0.18, 0.025, [0, HY + 0.07, 0.17], [0.16, 0, 0], 18, [1.1, 1, 0.8]), color: '#5d4a3c', bone: 'head' },
    { geo: pill(0.028, 0.1, [0, HY - 0.07, HR - 0.004], [0, 0, Math.PI / 2]), color: '#3b2a20', bone: 'head' },
    { geo: roundBox(0.47, 0.42, 0.42, [0, 0.72, 0.005], [0, 0, 0], 0.5), color: '#8e3b44', bone: 'body' },
    { geo: roundBox(0.08, 0.24, 0.03, [0, 0.82, 0.212], [0.05, 0, 0], 0.4), color: '#e6d8bd', bone: 'body' },
    { geo: sphere(0.022, [0.05, 0.72, 0.225], 1, [0, 0, 0], 8, 6), color: '#e0a94a', bone: 'body' },
    { geo: sphere(0.022, [0.05, 0.62, 0.225], 1, [0, 0, 0], 8, 6), color: '#e0a94a', bone: 'body' },
  ],
  // Rosa: baker's cap over a brown bun, sage shirt, cream apron, a sourdough loaf held in front
  baker: () => [
    ...base({ skin: '#f1cfae', shirt: '#8fae8a', pants: '#8fae8a', shoes: '#b58a62' }),
    hairCap('#8a5a3a'),
    { geo: ball(0.09, [0, HY + 0.1, -0.2], [1, 0.9, 0.9]), color: '#8a5a3a', bone: 'head' },
    { geo: hemi(HR + 0.02, [0, HY + 0.07, -0.02], [1, 0.62, 1], [-0.3, 0, 0]), color: '#f6f2ea', bone: 'head' },
    { geo: torus(HR - 0.01, 0.025, [0, HY + 0.09, -0.01], [Math.PI / 2 - 0.3, 0, 0], Math.PI * 2, 22), color: '#e9e2d4', bone: 'head' },
    { geo: roundBox(0.38, 0.5, 0.05, [0, 0.6, 0.2], [0.07, 0, 0], 0.3), color: '#f3e8d2', bone: 'body' },
    { geo: torus(0.19, 0.012, [0, 0.9, 0.03], [Math.PI / 2 - 0.35, 0, 0], Math.PI * 2, 18), color: '#f3e8d2', bone: 'body' },
    // the loaf, with three score marks
    { geo: sphere(0.17, [0, 0.74, 0.34], [1.15, 0.72, 0.85], [0, 0, 0], 16, 10), color: '#c9894a', bone: 'body' },
    ...[-0.07, 0, 0.07].map((dx): Part => ({ geo: pill(0.012, 0.09, [dx, 0.85, 0.36], [Math.PI / 2 - 0.3, 0, 0.5]), color: '#f0d9ac', bone: 'body' })),
  ],
  // Luz: curly hair with an orange headband, paint-spotted cream overalls, a brush in one hand, a paint cup in the other
  muralist: () => {
    const curls: Part[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      curls.push({ geo: sphere(0.085, [Math.sin(a) * 0.19, HY + 0.12 + Math.cos(a * 2) * 0.02, Math.cos(a) * 0.17 - 0.03], 1, [0, 0, 0], 8, 6), color: '#2b1d16', bone: 'head' });
    }
    const spots: Part[] = (['#d8543e', '#3f86c6', '#e8b43e', '#2f8f88', '#c9563a', '#7a5ab0'] as const).map((c, i): Part => ({
      geo: sphere(0.025, [((i % 3) - 1) * 0.11, 0.5 + Math.floor(i / 3) * 0.16, 0.215], [1, 1, 0.4], [0, 0, 0], 8, 6), color: c, bone: 'body',
    }));
    return [
      ...base({ skin: '#8d5a3b', shirt: '#f2e6c8', pants: '#f2e6c8', shoes: '#6d5a48', sleeves: '#8d5a3b' }),
      hairCap('#2b1d16'),
      ...curls,
      { geo: torus(HR + 0.01, 0.028, [0, HY + 0.07, 0], [Math.PI / 2 - 0.25, 0, 0], Math.PI * 2, 24), color: '#e0773a', bone: 'head' },
      { geo: roundBox(0.34, 0.34, 0.05, [0, 0.62, 0.2], [0.05, 0, 0], 0.3), color: '#efe0bd', bone: 'body' },
      ...spots,
      // brush (right hand) and paint cup (left hand)
      { geo: cyl(0.014, 0.018, 0.34, [-0.34, 0.74, 0.08], [0.2, 0, 0], 8), color: '#b98a5a', bone: 'armR' },
      { geo: cyl(0.026, 0.012, 0.07, [-0.335, 0.93, 0.12], [0.2, 0, 0], 8), color: '#d8543e', bone: 'armR' },
      { geo: cyl(0.06, 0.05, 0.1, [0.34, 0.64, 0.1], [0, 0, 0], 12), color: '#e9e2d4', bone: 'armL' },
      { geo: cyl(0.052, 0.052, 0.012, [0.34, 0.69, 0.1], [0, 0, 0], 12), color: '#3f86c6', bone: 'armL' },
    ];
  },
  // Hank: wide straw hat, white beard, green overalls, a pot of pink tulips and a trowel
  gardener: () => [
    ...base({ skin: '#f0c8a0', shirt: '#f1e6cf', pants: '#7e9a6a', shoes: '#6d5a48' }, { mouth: false }),
    hairCap('#e7e2d8'),
    { geo: ball(0.15, [0, HY - 0.1, 0.13], [1.05, 0.9, 0.62]), color: '#eeeae3', bone: 'head' },
    { geo: cyl(0.42, 0.44, 0.03, [0, HY + 0.17, 0], [-0.08, 0, 0], 30), color: '#e2c07a', bone: 'head' },
    { geo: cyl(0.19, 0.21, 0.15, [0, HY + 0.25, -0.01], [-0.08, 0, 0], 22), color: '#e2c07a', bone: 'head' },
    { geo: cyl(0.215, 0.215, 0.04, [0, HY + 0.2, -0.005], [-0.08, 0, 0], 22), color: '#7e9a6a', bone: 'head' },
    { geo: roundBox(0.42, 0.44, 0.44, [0, 0.62, 0], [0, 0, 0], 0.5), color: '#7e9a6a', bone: 'body' },
    { geo: roundBox(0.2, 0.14, 0.04, [0, 0.62, 0.225], [0, 0, 0], 0.3), color: '#6c8a5a', bone: 'body' },
    // tulip pot (left hand)
    { geo: cyl(0.1, 0.075, 0.13, [0.36, 0.66, 0.12], [0, 0, 0], 14), color: '#c0643c', bone: 'armL' },
    ...[[-0.04, 0], [0.04, 0.02], [0, -0.04]].flatMap(([dx, dz]): Part[] => [
      { geo: cyl(0.008, 0.008, 0.16, [0.36 + dx, 0.8, 0.12 + dz], [0, 0, 0], 5), color: '#5f8a4a', bone: 'armL' },
      { geo: sphere(0.035, [0.36 + dx, 0.89, 0.12 + dz], [1, 1.3, 1], [0, 0, 0], 8, 6), color: '#e98aa0', bone: 'armL' },
    ]),
    // trowel (right hand)
    { geo: cyl(0.016, 0.016, 0.1, [-0.33, 0.6, 0.1], [0.4, 0, 0], 8), color: '#8a6a4a', bone: 'armR' },
    { geo: roundBox(0.07, 0.11, 0.015, [-0.33, 0.5, 0.15], [0.4, 0, 0], 0.4), color: '#a9b0b4', bone: 'armR' },
  ],
  // Dana: flat-brimmed ranger hat, two braids, olive uniform, binoculars and a badge
  ranger: () => [
    ...base({ skin: '#7a4b33', shirt: '#7d8456', pants: '#5f6445', shoes: '#3a2f26' }),
    hairCap('#231a15'),
    { geo: pill(0.045, 0.2, [0.19, HY - 0.16, -0.05], [0.1, 0, 0.05]), color: '#231a15', bone: 'head' },
    { geo: pill(0.045, 0.2, [-0.19, HY - 0.16, -0.05], [0.1, 0, -0.05]), color: '#231a15', bone: 'head' },
    { geo: cyl(0.4, 0.4, 0.025, [0, HY + 0.15, 0], [-0.05, 0, 0], 30), color: '#c8a46a', bone: 'head' },
    { geo: cyl(0.16, 0.2, 0.17, [0, HY + 0.24, -0.005], [-0.05, 0, 0], 4, [1, 1, 1]), color: '#c8a46a', bone: 'head' },
    { geo: cyl(0.2, 0.2, 0.035, [0, HY + 0.18, -0.005], [-0.05, 0, 0], 20), color: '#5a4630', bone: 'head' },
    { geo: sphere(0.035, [-0.1, 0.86, 0.2], [1, 1, 0.45], [0, 0, 0], 8, 6), color: '#e0a94a', bone: 'body' },
    { geo: cyl(0.04, 0.04, 0.1, [-0.045, 0.62, 0.23], [Math.PI / 2, 0, 0], 10), color: '#3a3a3a', bone: 'body' },
    { geo: cyl(0.04, 0.04, 0.1, [0.045, 0.62, 0.23], [Math.PI / 2, 0, 0], 10), color: '#3a3a3a', bone: 'body' },
    { geo: torus(0.17, 0.008, [0, 0.8, 0.06], [Math.PI / 2 - 0.55, 0, 0], Math.PI * 2, 16), color: '#3a3a3a', bone: 'body' },
  ],
  // Marcus: bald, round glasses, a full dark beard, teal jacket over a striped shirt, a record held up
  'record-store': () => [
    ...base({ skin: '#c98e6a', shirt: '#3f8f8a', pants: '#c7b28a', shoes: '#5a4234' }, { mouth: false, cheeks: false }),
    { geo: ball(0.16, [0, HY - 0.1, 0.12], [1.08, 0.95, 0.66]), color: '#3a2a22', bone: 'head' },
    { geo: torus(0.052, 0.006, [0.08, HY + 0.02, HR + 0.012], [0, 0, 0], Math.PI * 2, 16), color: '#5a4636', bone: 'head' },
    { geo: torus(0.052, 0.006, [-0.08, HY + 0.02, HR + 0.012], [0, 0, 0], Math.PI * 2, 16), color: '#5a4636', bone: 'head' },
    { geo: pill(0.005, 0.03, [0, HY + 0.025, HR + 0.02], [0, 0, Math.PI / 2]), color: '#5a4636', bone: 'head' },
    { geo: roundBox(0.18, 0.4, 0.05, [0, 0.72, 0.2], [0.03, 0, 0], 0.3), color: '#f1e6cf', bone: 'body' },
    ...[0.58, 0.68, 0.78, 0.88].map((y): Part => ({ geo: roundBox(0.182, 0.03, 0.052, [0, y, 0.202], [0.03, 0, 0], 0.2), color: '#c9563a', bone: 'body' })),
    // the record (right hand)
    { geo: cyl(0.2, 0.2, 0.012, [-0.36, 0.62, 0.14], [Math.PI / 2, 0, 0], 24), color: '#1c1c1c', bone: 'armR' },
    { geo: cyl(0.065, 0.065, 0.016, [-0.36, 0.62, 0.14], [Math.PI / 2, 0, 0], 16), color: '#e08a3a', bone: 'armR' },
  ],
};

/** Build a resident's body (a fresh rig: skeleton and geometry of its own). */
export function buildResident(key: ResidentKey): Rig {
  const bones: BoneDef[] = NPC_BONES.map(b => ({ ...b, pos: [...b.pos] as Vec3 }));
  return buildRig(bones, LOOKS[key]());
}
