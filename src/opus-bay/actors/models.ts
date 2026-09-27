import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural toy characters. Each character is ONE SkinnedMesh (one draw call, one shadow draw) built from
 * soft primitives that are rigidly bound to a handful of bones (body, head, eyes, arms, feet, tail …), so the
 * procedural animation in anim.ts can squash / stretch / swing parts with plain bone transforms.
 * All characters share one vertex-coloured MeshStandardMaterial with a soft rim light (clay-toy look).
 */

export type Vec3 = [number, number, number];

export interface BoneDef { name: string; parent: string | null; pos: Vec3 }
export interface Part { geo: THREE.BufferGeometry; color: THREE.ColorRepresentation; bone: string }

export interface Rig {
  mesh: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  /** bind-pose local positions (animation adds offsets to these) */
  rest: Record<string, THREE.Vector3>;
  height: number;
}

// ---------------------------------------------------------------------------
// Shared material (vertex colours + rim light)
// ---------------------------------------------------------------------------

let MATERIAL: THREE.MeshStandardMaterial | null = null;
export interface RimUniforms { rimColor: { value: THREE.Color }; rimStrength: { value: number }; charGlow: { value: number } }
export const rimUniforms: RimUniforms = { rimColor: { value: new THREE.Color('#fff1d6') }, rimStrength: { value: 0.22 }, charGlow: { value: 0.03 } };

/**
 * Soft rim light + a little self-light (charGlow, raised at night) so the characters always read. Shared by the
 * procedural vertex-coloured material and the textured GLB characters (each with its own program cache key).
 */
export function patchCharacterShader(m: THREE.MeshStandardMaterial, cacheKey: string, uniforms: RimUniforms = rimUniforms) {
  m.onBeforeCompile = shader => {
    shader.uniforms.rimColor = uniforms.rimColor;
    shader.uniforms.rimStrength = uniforms.rimStrength;
    shader.uniforms.charGlow = uniforms.charGlow;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float charGlow;')
      .replace(
        '#include <opaque_fragment>',
        'float obRim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.6);\noutgoingLight += rimColor * obRim * rimStrength + diffuseColor.rgb * charGlow;\n#include <opaque_fragment>',
      );
  };
  m.customProgramCacheKey = () => cacheKey;
  m.needsUpdate = true;
  return m;
}

export function characterMaterial(): THREE.MeshStandardMaterial {
  if (MATERIAL) return MATERIAL;
  MATERIAL = patchCharacterShader(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 }), 'opus-bay-character-rim-glow');
  return MATERIAL;
}

/** Uniforms for the textured GLB BAYBAY: rim shared with everyone, her own night self-light (white fur reads grey otherwise). */
export const baybayGlbUniforms: RimUniforms = { rimColor: rimUniforms.rimColor, rimStrength: rimUniforms.rimStrength, charGlow: { value: 0.03 } };

/**
 * Build a Rig from the rigged BAYBAY GLB (same bone names as buildBaybay; identity rest rotations). The returned
 * `object` is what gets placed in the world (the skinned mesh and its bones are siblings under it).
 */
export function rigFromGltf(scene: THREE.Object3D, height = 1.3): { rig: Rig; object: THREE.Object3D } | null {
  let mesh: THREE.SkinnedMesh | null = null;
  const bones: Record<string, THREE.Bone> = {};
  scene.traverse(o => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as THREE.SkinnedMesh;
    if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
  });
  const found = mesh as THREE.SkinnedMesh | null;
  if (!found || !bones.root || !bones.body) return null;
  const src = (Array.isArray(found.material) ? found.material[0] : found.material) as THREE.MeshStandardMaterial;
  const mat = new THREE.MeshStandardMaterial({ map: src.map ?? null, roughness: 0.66, metalness: 0 });
  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
  patchCharacterShader(mat, 'opus-bay-character-glb', baybayGlbUniforms);
  src.dispose();
  found.material = mat;
  found.castShadow = true;
  found.frustumCulled = false;
  const rest: Record<string, THREE.Vector3> = {};
  for (const [name, bone] of Object.entries(bones)) { rest[name] = bone.position.clone(); bone.rotation.set(0, 0, 0); }
  return { rig: { mesh: found, bones, rest, height }, object: scene };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();

/** Scale → rotate (XYZ euler) → translate a geometry in place. */
export function xf(geo: THREE.BufferGeometry, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scale: Vec3 | number = 1): THREE.BufferGeometry {
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  tmpM.compose(tmpP.set(pos[0], pos[1], pos[2]), tmpQ.setFromEuler(tmpE.set(rot[0], rot[1], rot[2])), tmpS.set(s[0], s[1], s[2]));
  geo.applyMatrix4(tmpM);
  return geo;
}

export const sphere = (r: number, pos: Vec3, scale: Vec3 | number = 1, rot: Vec3 = [0, 0, 0], w = 18, h = 12) => xf(new THREE.SphereGeometry(r, w, h), pos, rot, scale);
export const hemi = (r: number, pos: Vec3, scale: Vec3 | number = 1, rot: Vec3 = [0, 0, 0]) => xf(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), pos, rot, scale);
export const capsule = (r: number, len: number, pos: Vec3, rot: Vec3 = [0, 0, 0], scale: Vec3 | number = 1) => xf(new THREE.CapsuleGeometry(r, len, 4, 12), pos, rot, scale);
export const cyl = (rTop: number, rBot: number, h: number, pos: Vec3, rot: Vec3 = [0, 0, 0], seg = 20, scale: Vec3 | number = 1) => xf(new THREE.CylinderGeometry(rTop, rBot, h, seg), pos, rot, scale);
export const torus = (r: number, tube: number, pos: Vec3, rot: Vec3 = [0, 0, 0], arc = Math.PI * 2, seg = 24) => xf(new THREE.TorusGeometry(r, tube, 8, seg, arc), pos, rot);
export const box = (w: number, h: number, d: number, pos: Vec3, rot: Vec3 = [0, 0, 0]) => xf(new THREE.BoxGeometry(w, h, d), pos, rot);

/** Rounded box: a box with its corners pushed toward a superellipsoid (soft toy shapes). */
export function roundBox(w: number, h: number, d: number, pos: Vec3, rot: Vec3 = [0, 0, 0], soft = 0.45) {
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const nx = v.x / (w / 2), ny = v.y / (h / 2), nz = v.z / (d / 2);
    const len = Math.hypot(nx, ny, nz) || 1;
    const k = 1 - soft + soft * (Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz)) / len);
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return xf(g, pos, rot);
}

// ---------------------------------------------------------------------------
// Rig builder
// ---------------------------------------------------------------------------

const AO_HEIGHT = 0.55;

export function buildRig(boneDefs: BoneDef[], parts: Part[], opts: { ao?: boolean } = {}): Rig {
  const index = new Map(boneDefs.map((b, i) => [b.name, i]));
  const color = new THREE.Color();
  const geos: THREE.BufferGeometry[] = [];
  let top = 0;
  for (const part of parts) {
    const g0 = part.geo.index ? part.geo : part.geo;
    const g = g0.clone();
    g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    color.set(part.color);
    for (let i = 0; i < n; i++) { colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const bi = index.get(part.bone);
    if (bi === undefined) throw new Error(`rig: unknown bone ${part.bone}`);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.computeBoundingBox();
    top = Math.max(top, g.boundingBox!.max.y);
    geos.push(g.index ? g : g);
    part.geo.dispose();
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  if (!merged) throw new Error('rig: merge failed');
  if (opts.ao !== false) {
    // soft ambient occlusion toward the feet and a hint of it under the chin/hat brim (clay toy look)
    const pos = merged.attributes.position as THREE.BufferAttribute, col = merged.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const k = 0.86 + 0.14 * Math.min(1, Math.max(0, y / AO_HEIGHT));
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
  }
  const bones: Record<string, THREE.Bone> = {};
  const rest: Record<string, THREE.Vector3> = {};
  const list: THREE.Bone[] = [];
  for (const def of boneDefs) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    const parent = def.parent ? boneDefs.find(b => b.name === def.parent)! : null;
    bone.position.set(def.pos[0] - (parent?.pos[0] ?? 0), def.pos[1] - (parent?.pos[1] ?? 0), def.pos[2] - (parent?.pos[2] ?? 0));
    bones[def.name] = bone;
    rest[def.name] = bone.position.clone();
    list.push(bone);
  }
  for (const def of boneDefs) if (def.parent) bones[def.parent].add(bones[def.name]);
  const mesh = new THREE.SkinnedMesh(merged, characterMaterial());
  const roots = boneDefs.filter(b => !b.parent).map(b => bones[b.name]);
  roots.forEach(root => mesh.add(root));
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  mesh.computeBoundingSphere();
  if (mesh.boundingSphere) mesh.boundingSphere.radius *= 1.6;
  return { mesh, bones, rest, height: top };
}

// ---------------------------------------------------------------------------
// The newcomer (player): round cream traveller, terracotta bucket hat, teal backpack, rolled map
// ---------------------------------------------------------------------------

const C = {
  cream: '#f8e2ba',
  creamFoot: '#e8c995',
  cheek: '#f0a38f',
  ink: '#211d1c',
  white: '#ffffff',
  mouth: '#6b3526',
  hat: '#d8744a',
  hatBand: '#a9502f',
  pack: '#2f8f88',
  packDark: '#237169',
  strap: '#1d625c',
  paper: '#f4ead3',
  tie: '#c9563a',
};

/** Newcomer hat: crown r 0.315, brim 0.43 (narrower than the 0.45 body), tilted back −0.45 rad, a small pin on the band. */
function hatParts(): Part[] {
  const tilt = -0.45, y = 1.2, z = -0.05;
  const at = (dy: number, dz: number): Vec3 => [0, y + dy * Math.cos(tilt) - dz * Math.sin(tilt), z + dy * Math.sin(tilt) + dz * Math.cos(tilt)];
  const pin = at(0.1, 0.31);
  return [
    { geo: cyl(0.33, 0.43, 0.12, at(0, 0), [tilt, 0, 0], 40, [1, 1, 0.92]), color: C.hat, bone: 'hat' },
    { geo: sphere(0.315, at(0.07, 0), [1, 0.8, 1], [tilt, 0, 0], 32, 18), color: C.hat, bone: 'hat' },
    { geo: xf(new THREE.TorusGeometry(0.315, 0.033, 8, 36), at(0.1, 0), [Math.PI / 2 + tilt, 0, 0]), color: C.hatBand, bone: 'hat' },
    // small gold pin on the band, front-left
    { geo: sphere(0.045, [0.17, pin[1], pin[2] - 0.05], [1, 1, 0.55], [tilt, 0.5, 0], 10, 8), color: '#e0a94a', bone: 'hat' },
  ];
}

export function buildNewcomer(): Rig {
  const bones: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'body', parent: 'root', pos: [0, 0.3, 0] },
    { name: 'hat', parent: 'body', pos: [0, 1.1, 0] },
    { name: 'eyes', parent: 'body', pos: [0, 0.855, 0.37] },
    { name: 'pack', parent: 'body', pos: [0, 1.0, -0.34] },
    { name: 'armL', parent: 'body', pos: [0.39, 0.8, 0.02] },
    { name: 'armR', parent: 'body', pos: [-0.39, 0.8, 0.02] },
    { name: 'footL', parent: 'root', pos: [0.16, 0.1, 0.02] },
    { name: 'footR', parent: 'root', pos: [-0.16, 0.1, 0.02] },
  ];
  const strap = (x: number) => xf(new THREE.TorusGeometry(0.3, 0.036, 8, 26), [x, 0.86, -0.17], [0.12, Math.PI / 2, 0], [1.12, 1.1, 1]);
  const parts: Part[] = [
    // body bean (taller than it is wide, so the hat reads as a hat, not a mushroom cap)
    { geo: sphere(0.45, [0, 0.72, 0], [1, 1.36, 0.92], [0, 0, 0], 30, 22), color: C.cream, bone: 'body' },
    { geo: sphere(0.08, [0.235, 0.755, 0.33], [1, 0.62, 0.36]), color: C.cheek, bone: 'body' },
    { geo: sphere(0.08, [-0.235, 0.755, 0.33], [1, 0.62, 0.36]), color: C.cheek, bone: 'body' },
    // small open smile
    { geo: sphere(0.05, [0, 0.765, 0.4], [1.15, 0.62, 0.45], [0.25, 0, 0]), color: C.mouth, bone: 'body' },
    { geo: sphere(0.028, [0, 0.75, 0.413], [1.2, 0.5, 0.4]), color: '#e98b7f', bone: 'body' },
    // backpack straps (flattened rings round the shoulders)
    { geo: strap(0.25), color: C.strap, bone: 'body' },
    { geo: strap(-0.25), color: C.strap, bone: 'body' },
    // eyes (blink by scaling the eyes bone)
    { geo: sphere(0.066, [0.128, 0.855, 0.37], [0.84, 1.16, 0.58]), color: C.ink, bone: 'eyes' },
    { geo: sphere(0.066, [-0.128, 0.855, 0.37], [0.84, 1.16, 0.58]), color: C.ink, bone: 'eyes' },
    { geo: sphere(0.022, [0.148, 0.88, 0.404], 1, [0, 0, 0], 8, 6), color: C.white, bone: 'eyes' },
    { geo: sphere(0.022, [-0.108, 0.88, 0.404], 1, [0, 0, 0], 8, 6), color: C.white, bone: 'eyes' },
    // soft bucket hat, pushed back so the face reads from behind at three-quarters: brim narrower than the body
    ...hatParts(),
    // backpack: small and round, with a cream bedroll on top (reads "traveller", not "box")
    { geo: roundBox(0.46, 0.52, 0.3, [0, 0.8, -0.45], [0.08, 0, 0], 0.72), color: C.pack, bone: 'pack' },
    { geo: roundBox(0.44, 0.2, 0.32, [0, 0.99, -0.45], [0.12, 0, 0], 0.72), color: C.packDark, bone: 'pack' },
    { geo: roundBox(0.26, 0.17, 0.1, [0, 0.68, -0.6], [0.08, 0, 0], 0.7), color: C.packDark, bone: 'pack' },
    { geo: sphere(0.03, [0, 0.93, -0.615], 1, [0, 0, 0], 8, 6), color: '#e0a94a', bone: 'pack' },
    { geo: xf(new THREE.CylinderGeometry(0.1, 0.1, 0.56, 14), [0, 1.14, -0.47], [0, 0, Math.PI / 2]), color: C.paper, bone: 'pack' },
    { geo: xf(new THREE.CylinderGeometry(0.106, 0.106, 0.035, 14), [0.17, 1.14, -0.47], [0, 0, Math.PI / 2]), color: C.tie, bone: 'pack' },
    { geo: xf(new THREE.CylinderGeometry(0.106, 0.106, 0.035, 14), [-0.17, 1.14, -0.47], [0, 0, Math.PI / 2]), color: C.tie, bone: 'pack' },
    // nub arms
    { geo: capsule(0.088, 0.15, [0.47, 0.67, 0.04], [0, 0, 0.34]), color: C.cream, bone: 'armL' },
    { geo: capsule(0.088, 0.15, [-0.47, 0.67, 0.04], [0, 0, -0.34]), color: C.cream, bone: 'armR' },
    // rolled map in the left hand
    { geo: cyl(0.06, 0.06, 0.46, [0.55, 0.56, 0.15], [0.3, 0, -0.12], 12), color: C.paper, bone: 'armL' },
    { geo: cyl(0.064, 0.064, 0.035, [0.557, 0.66, 0.18], [0.3, 0, -0.12], 12), color: C.tie, bone: 'armL' },
    { geo: cyl(0.064, 0.064, 0.035, [0.543, 0.46, 0.12], [0.3, 0, -0.12], 12), color: C.tie, bone: 'armL' },
    // feet
    { geo: sphere(0.13, [0.16, 0.075, 0.05], [1, 0.62, 1.3]), color: C.creamFoot, bone: 'footL' },
    { geo: sphere(0.13, [-0.16, 0.075, 0.05], [1, 0.62, 1.3]), color: C.creamFoot, bone: 'footR' },
  ];
  return buildRig(bones, parts);
}

// ---------------------------------------------------------------------------
// BAYBAY: cream-white sea otter with a teal scarf and an orange pin
// ---------------------------------------------------------------------------

const B = {
  fur: '#fbf7ef',
  head: '#fdfaf3',
  muzzle: '#fffefa',
  belly: '#f3e6cc',
  limb: '#f6efe2',
  foot: '#ece0cb',
  tail: '#efe4cf',
  earIn: '#ecc7ba',
  nose: '#1c1a1c',
  eye: '#17161b',
  mouthIn: '#5e2c30',
  tongue: '#ef8f92',
  whisker: '#b9b0a4',
  scarf: '#1f8f8a',
  scarfDark: '#18756f',
  pin: '#e8663d',
};

export function buildBaybay(): Rig {
  const bones: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'body', parent: 'root', pos: [0, 0.2, 0] },
    { name: 'head', parent: 'body', pos: [0, 0.84, 0.02] },
    { name: 'eyes', parent: 'head', pos: [0, 1.08, 0.3] },
    { name: 'mouth', parent: 'head', pos: [0, 0.915, 0.34] },
    { name: 'armL', parent: 'body', pos: [0.27, 0.73, 0.06] },
    { name: 'armR', parent: 'body', pos: [-0.27, 0.73, 0.06] },
    { name: 'tail', parent: 'body', pos: [0, 0.26, -0.24] },
    { name: 'scarf', parent: 'body', pos: [0.14, 0.8, 0.27] },
    { name: 'footL', parent: 'root', pos: [0.13, 0.07, 0.04] },
    { name: 'footR', parent: 'root', pos: [-0.13, 0.07, 0.04] },
  ];
  const whiskers: Part[] = [];
  for (const side of [1, -1]) {
    for (let k = -1; k <= 1; k++) {
      const a = 0.12 * k;
      whiskers.push({ geo: cyl(0.006, 0.0035, 0.17, [side * 0.225, 0.965 + k * 0.022, 0.33], [0, side * 0.35, side * (Math.PI / 2 + a)], 5), color: B.whisker, bone: 'head' });
    }
  }
  const parts: Part[] = [
    // torso + belly
    { geo: sphere(0.34, [0, 0.5, 0], [1, 1.18, 0.9], [0, 0, 0], 26, 18), color: B.fur, bone: 'body' },
    { geo: sphere(0.27, [0, 0.45, 0.2], [0.95, 1.1, 0.52]), color: B.belly, bone: 'body' },
    // head
    { geo: sphere(0.31, [0, 1.04, 0.03], [1.1, 0.95, 0.98], [0, 0, 0], 28, 20), color: B.head, bone: 'head' },
    { geo: sphere(0.13, [0, 0.955, 0.275], [1.32, 0.86, 0.9]), color: B.muzzle, bone: 'head' },
    { geo: sphere(0.062, [0, 1.0, 0.385], [1.35, 0.88, 0.9]), color: B.nose, bone: 'head' },
    { geo: sphere(0.017, [0.022, 1.022, 0.432], 1, [0, 0, 0], 8, 6), color: '#ffffff', bone: 'head' },
    { geo: torus(0.036, 0.008, [0.034, 0.952, 0.378], [0.2, 0, Math.PI], Math.PI, 10), color: B.nose, bone: 'head' },
    { geo: torus(0.036, 0.008, [-0.034, 0.952, 0.378], [0.2, 0, Math.PI], Math.PI, 10), color: B.nose, bone: 'head' },
    // ears
    { geo: sphere(0.09, [0.25, 1.25, -0.02], [1, 0.86, 0.55]), color: B.limb, bone: 'head' },
    { geo: sphere(0.09, [-0.25, 1.25, -0.02], [1, 0.86, 0.55]), color: B.limb, bone: 'head' },
    { geo: sphere(0.052, [0.25, 1.245, 0.016], [1, 0.82, 0.4]), color: B.earIn, bone: 'head' },
    { geo: sphere(0.052, [-0.25, 1.245, 0.016], [1, 0.82, 0.4]), color: B.earIn, bone: 'head' },
    ...whiskers,
    // eyes
    { geo: sphere(0.06, [0.128, 1.08, 0.298], [0.88, 1.12, 0.62]), color: B.eye, bone: 'eyes' },
    { geo: sphere(0.06, [-0.128, 1.08, 0.298], [0.88, 1.12, 0.62]), color: B.eye, bone: 'eyes' },
    { geo: sphere(0.021, [0.148, 1.102, 0.333], 1, [0, 0, 0], 8, 6), color: '#ffffff', bone: 'eyes' },
    { geo: sphere(0.021, [-0.108, 1.102, 0.333], 1, [0, 0, 0], 8, 6), color: '#ffffff', bone: 'eyes' },
    { geo: sphere(0.009, [0.112, 1.062, 0.34], 1, [0, 0, 0], 6, 4), color: '#ffffff', bone: 'eyes' },
    { geo: sphere(0.009, [-0.144, 1.062, 0.34], 1, [0, 0, 0], 6, 4), color: '#ffffff', bone: 'eyes' },
    // open smile + tongue (mouth bone scales to talk)
    { geo: sphere(0.058, [0, 0.905, 0.35], [1.15, 0.72, 0.5]), color: B.mouthIn, bone: 'mouth' },
    { geo: sphere(0.042, [0, 0.89, 0.365], [1.1, 0.58, 0.6]), color: B.tongue, bone: 'mouth' },
    // scarf ring + knot + hanging tail + pin
    { geo: torus(0.27, 0.078, [0, 0.83, 0.015], [Math.PI / 2 - 0.12, 0, 0], Math.PI * 2, 30), color: B.scarf, bone: 'body' },
    { geo: sphere(0.085, [0.12, 0.79, 0.25], [1, 0.9, 0.8]), color: B.scarfDark, bone: 'body' },
    { geo: roundBox(0.14, 0.32, 0.055, [0.16, 0.62, 0.315], [-0.2, 0, 0.1], 0.35), color: B.scarf, bone: 'scarf' },
    { geo: box(0.13, 0.03, 0.058, [0.176, 0.47, 0.345], [-0.2, 0, 0.1]), color: B.scarfDark, bone: 'scarf' },
    { geo: sphere(0.045, [0.158, 0.69, 0.355], [1, 1, 0.6]), color: B.pin, bone: 'scarf' },
    { geo: sphere(0.013, [0.172, 0.705, 0.381], 1, [0, 0, 0], 6, 4), color: '#fff3e6', bone: 'scarf' },
    // arms
    { geo: capsule(0.072, 0.19, [0.325, 0.6, 0.1], [0.12, 0, 0.3]), color: B.limb, bone: 'armL' },
    { geo: capsule(0.072, 0.19, [-0.325, 0.6, 0.1], [0.12, 0, -0.3]), color: B.limb, bone: 'armR' },
    // tail
    { geo: capsule(0.11, 0.26, [0, 0.16, -0.42], [-1.1, 0, 0], [1, 1, 0.8]), color: B.tail, bone: 'tail' },
    { geo: sphere(0.085, [0, 0.07, -0.6], [1, 0.72, 1.15]), color: B.tail, bone: 'tail' },
    // feet
    { geo: sphere(0.1, [0.13, 0.058, 0.08], [1.05, 0.62, 1.45]), color: B.foot, bone: 'footL' },
    { geo: sphere(0.1, [-0.13, 0.058, 0.08], [1.05, 0.62, 1.45]), color: B.foot, bone: 'footR' },
  ];
  return buildRig(bones, parts);
}

// ---------------------------------------------------------------------------
// Residents (A12): the heroes' shape language — capsule torso, round head, nub arms, bean feet (1.3–1.5 u tall)
// ---------------------------------------------------------------------------

export type NpcLook = 'vendor' | 'fisher' | 'jogger' | 'parent' | 'kid' | 'operator';

interface Outfit { shirt: string; pants: string; skin: string; shoes: string; hair: string }
const OUTFITS_RAW: Record<NpcLook, Outfit> = {
  vendor: { shirt: '#6f9a5b', pants: '#5b4a3a', skin: '#e8b98f', shoes: '#4a3a2c', hair: '#3b2a20' },
  fisher: { shirt: '#8b6a4c', pants: '#3d4b5c', skin: '#c98e6a', shoes: '#2e2a26', hair: '#8f8a84' },
  jogger: { shirt: '#3f86c6', pants: '#2c3e50', skin: '#8d5a3b', shoes: '#f4f1e6', hair: '#1f1a17' },
  parent: { shirt: '#c9d6e8', pants: '#cdbf9f', skin: '#f0c8a0', shoes: '#6d5a48', hair: '#6a4a33' },
  kid: { shirt: '#f2c14e', pants: '#3f6f9a', skin: '#d9a27a', shoes: '#d8744a', hair: '#2b211b' },
  operator: { shirt: '#2f4b6e', pants: '#26374f', skin: '#f0c8a0', shoes: '#1d1d1f', hair: '#4a3a2a' },
};
/** outfit colours pulled 10 % toward the diorama's cream so residents sit in the palette */
const soften = (hex: string) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#e9dcc4'), 0.1).getHexString();
const OUTFITS = Object.fromEntries(Object.entries(OUTFITS_RAW).map(([k, o]) => [k, {
  shirt: soften(o.shirt), pants: soften(o.pants), skin: o.skin, shoes: soften(o.shoes), hair: o.hair,
}])) as Record<NpcLook, Outfit>;

/**
 * The resident skeleton (Animator 'npc' drives these bone names). Exported on wave-2 day 0 for lane G2's city residents
 * (actors/residentLooks.ts builds its own looks on it with buildRig and the primitives above). Head centre y 1.16,
 * head radius 0.22, torso capsule at y 0.68.
 */
export const NPC_BONES: readonly BoneDef[] = [
  { name: 'root', parent: null, pos: [0, 0, 0] },
  { name: 'body', parent: 'root', pos: [0, 0.3, 0] },
  { name: 'head', parent: 'body', pos: [0, 0.95, 0] },
  { name: 'armL', parent: 'body', pos: [0.24, 0.86, 0] },
  { name: 'armR', parent: 'body', pos: [-0.24, 0.86, 0] },
  { name: 'legL', parent: 'root', pos: [0.1, 0.3, 0] },
  { name: 'legR', parent: 'root', pos: [-0.1, 0.3, 0] },
];

export function buildNpc(look: NpcLook): Rig {
  const o = OUTFITS[look];
  const HY = 1.16; // head centre
  const HR = 0.2 * 1.1; // head radius
  const bones: BoneDef[] = NPC_BONES.map(b => ({ ...b, pos: [...b.pos] as Vec3 }));
  const shorts = look === 'jogger';
  const parts: Part[] = [
    // stubby legs + bean feet
    ...[1, -1].flatMap(sd => {
      const leg = sd > 0 ? 'legL' : 'legR';
      return [
        { geo: capsule(0.085, 0.1, [sd * 0.1, 0.2, 0]), color: shorts ? o.skin : o.pants, bone: leg },
        ...(shorts ? [{ geo: capsule(0.095, 0.03, [sd * 0.1, 0.29, 0]), color: o.pants, bone: leg }] : []),
        { geo: sphere(0.11, [sd * 0.1, 0.065, 0.045], [1, 0.6, 1.35]), color: o.shoes, bone: leg },
      ];
    }),
    // capsule torso (a soft bean) + a round head
    { geo: capsule(0.22, 0.5, [0, 0.68, 0], [0, 0, 0], [1, 1, 0.9]), color: o.shirt, bone: 'body' },
    { geo: sphere(HR, [0, HY, 0.01], 1, [0, 0, 0], 24, 18), color: o.skin, bone: 'head' },
    { geo: sphere(0.03, [0.078, HY + 0.02, HR - 0.012], [0.85, 1.2, 0.55], [0, 0, 0], 10, 8), color: '#1e1b1a', bone: 'head' },
    { geo: sphere(0.03, [-0.078, HY + 0.02, HR - 0.012], [0.85, 1.2, 0.55], [0, 0, 0], 10, 8), color: '#1e1b1a', bone: 'head' },
    { geo: sphere(0.01, [0.086, HY + 0.032, HR + 0.004], 1, [0, 0, 0], 6, 4), color: '#ffffff', bone: 'head' },
    { geo: sphere(0.01, [-0.07, HY + 0.032, HR + 0.004], 1, [0, 0, 0], 6, 4), color: '#ffffff', bone: 'head' },
    { geo: sphere(0.042, [0.125, HY - 0.05, HR - 0.05], [1, 0.6, 0.4], [0, 0, 0], 8, 6), color: '#eea08e', bone: 'head' },
    { geo: sphere(0.042, [-0.125, HY - 0.05, HR - 0.05], [1, 0.6, 0.4], [0, 0, 0], 8, 6), color: '#eea08e', bone: 'head' },
    { geo: torus(0.032, 0.008, [0, HY - 0.075, HR - 0.004], [0.35, 0, Math.PI], Math.PI, 10), color: '#6b3526', bone: 'head' },
    // nub arms + mitten hands
    { geo: capsule(0.07, 0.12, [0.29, 0.76, 0], [0, 0, 0.26]), color: o.shirt, bone: 'armL' },
    { geo: capsule(0.07, 0.12, [-0.29, 0.76, 0], [0, 0, -0.26]), color: o.shirt, bone: 'armR' },
    { geo: sphere(0.07, [0.32, 0.64, 0.02]), color: o.skin, bone: 'armL' },
    { geo: sphere(0.07, [-0.32, 0.64, 0.02]), color: o.skin, bone: 'armR' },
  ];
  const hairCap = () => ({ geo: hemi(HR + 0.012, [0, HY + 0.012, -0.012], [1, 0.95, 1], [-0.28, 0, 0]), color: o.hair, bone: 'head' });
  switch (look) {
    case 'vendor':
      parts.push(
        hairCap(),
        // apron + straw hat, and a crate of produce held against the chest
        { geo: roundBox(0.36, 0.42, 0.04, [0, 0.62, 0.2], [0.08, 0, 0], 0.3), color: '#f6efe2', bone: 'body' },
        { geo: cyl(0.36, 0.38, 0.035, [0, HY + 0.17, 0], [-0.08, 0, 0], 28), color: '#e8cf8a', bone: 'head' },
        { geo: cyl(0.17, 0.19, 0.14, [0, HY + 0.25, -0.01], [-0.08, 0, 0], 22), color: '#e8cf8a', bone: 'head' },
        { geo: cyl(0.195, 0.195, 0.045, [0, HY + 0.2, -0.005], [-0.08, 0, 0], 22), color: '#b85b36', bone: 'head' },
        { geo: roundBox(0.46, 0.2, 0.3, [0, 0.66, 0.36], [0, 0, 0], 0.25), color: '#b98a5a', bone: 'body' },
        { geo: sphere(0.07, [-0.11, 0.78, 0.36], 1, [0, 0, 0], 10, 8), color: '#e0a94a', bone: 'body' },
        { geo: sphere(0.07, [0.05, 0.79, 0.33], 1, [0, 0, 0], 10, 8), color: '#c9563a', bone: 'body' },
        { geo: sphere(0.065, [0.14, 0.78, 0.4], 1, [0, 0, 0], 10, 8), color: '#9fbf7a', bone: 'body' },
      );
      break;
    case 'fisher':
      parts.push(
        { geo: hemi(HR + 0.02, [0, HY + 0.02, -0.01], [1, 1.12, 1]), color: '#c65a45', bone: 'head' },
        { geo: torus(HR, 0.04, [0, HY + 0.04, -0.01], [Math.PI / 2, 0, 0], Math.PI * 2, 26), color: '#a8473a', bone: 'head' },
        { geo: sphere(0.055, [0, HY + 0.28, -0.01]), color: '#f4f1e6', bone: 'head' },
        { geo: sphere(0.12, [0, HY - 0.11, 0.12], [1.1, 0.75, 0.7]), color: '#c9c2b8', bone: 'head' },
        { geo: roundBox(0.5, 0.46, 0.44, [0, 0.72, 0], [0, 0, 0], 0.55), color: '#8c9a6b', bone: 'body' },
        // rod held forward-up over the water, reel near the grip
        { geo: cyl(0.014, 0.024, 2.4, [-0.33, 1.34, 0.94], [0.87, 0, 0], 6), color: '#34302c', bone: 'armR' },
        { geo: cyl(0.05, 0.05, 0.06, [-0.26, 0.7, 0.16], [0, 0, Math.PI / 2], 10), color: '#9aa3a8', bone: 'armR' },
        { geo: cyl(0.18, 0.16, 0.3, [0.5, 0.15, 0.14], [0, 0, 0], 16), color: '#7f9c8f', bone: 'root' },
        { geo: torus(0.17, 0.018, [0.5, 0.3, 0.14], [Math.PI / 2, 0, 0], Math.PI * 2, 16), color: '#5f7a6f', bone: 'root' },
      );
      break;
    case 'jogger':
      parts.push(
        hairCap(),
        { geo: torus(HR + 0.005, 0.03, [0, HY + 0.06, 0], [Math.PI / 2 - 0.2, 0, 0], Math.PI * 2, 26), color: '#e8663d', bone: 'head' },
        { geo: roundBox(0.1, 0.035, 0.09, [0.335, 0.8, 0.02], [0, 0, 0.26], 0.3), color: '#e8663d', bone: 'armL' },
      );
      break;
    case 'parent':
      parts.push(
        hairCap(),
        { geo: cyl(0.38, 0.4, 0.03, [0, HY + 0.16, 0], [-0.1, 0, 0], 30), color: '#f4e2a8', bone: 'head' },
        { geo: cyl(0.19, 0.21, 0.14, [0, HY + 0.24, -0.01], [-0.1, 0, 0], 22), color: '#f4e2a8', bone: 'head' },
        { geo: cyl(0.215, 0.215, 0.035, [0, HY + 0.19, -0.005], [-0.1, 0, 0], 22), color: '#d8744a', bone: 'head' },
        { geo: roundBox(0.18, 0.12, 0.09, [0, 0.84, 0.23], [0, 0, 0], 0.4), color: '#34373b', bone: 'body' },
        { geo: cyl(0.04, 0.04, 0.05, [0, 0.84, 0.29], [Math.PI / 2, 0, 0], 12), color: '#7a8a90', bone: 'body' },
        { geo: torus(0.2, 0.011, [0, 0.92, 0.03], [Math.PI / 2 - 0.5, 0, 0], Math.PI * 2, 20), color: '#34373b', bone: 'body' },
      );
      break;
    case 'kid':
      parts.push(
        { geo: hemi(HR + 0.02, [0, HY + 0.02, 0], [1, 0.72, 1]), color: '#d8744a', bone: 'head' },
        { geo: cyl(0.16, 0.16, 0.022, [0, HY + 0.025, 0.17], [0.08, 0, 0], 18, [1, 1, 0.95]), color: '#b85b36', bone: 'head' },
        { geo: sphere(0.24, [0, 0.92, -0.05], [1, 0.62, 0.9]), color: '#e8b43e', bone: 'body' },
        { geo: roundBox(0.2, 0.26, 0.11, [0, 0.68, -0.26], [0.1, 0, 0], 0.5), color: '#3f86c6', bone: 'body' },
      );
      break;
    case 'operator':
      parts.push(
        hairCap(),
        { geo: cyl(0.21, 0.21, 0.14, [0, HY + 0.19, -0.01], [-0.06, 0, 0], 22), color: '#1f2f45', bone: 'head' },
        { geo: cyl(0.225, 0.225, 0.03, [0, HY + 0.26, -0.01], [-0.06, 0, 0], 22), color: '#26374f', bone: 'head' },
        { geo: cyl(0.15, 0.15, 0.022, [0, HY + 0.13, 0.17], [0.18, 0, 0], 18, [1, 1, 0.75]), color: '#141d2b', bone: 'head' },
        { geo: sphere(0.035, [0, HY + 0.21, 0.215], [1, 1, 0.5], [0, 0, 0], 8, 6), color: '#e0a94a', bone: 'head' },
        { geo: capsule(0.022, 0.08, [0, HY - 0.06, HR - 0.004], [0, 0, Math.PI / 2]), color: '#4a3a2a', bone: 'head' },
        { geo: sphere(0.04, [0.12, 0.88, 0.2], [1, 1, 0.5], [0, 0, 0], 8, 6), color: '#e0a94a', bone: 'body' },
        { geo: roundBox(0.42, 0.05, 0.05, [0, 0.5, 0.2], [0.1, 0, 0], 0.3), color: '#141d2b', bone: 'body' },
      );
      break;
  }
  return buildRig(bones, parts);
}
