import * as THREE from 'three';
import { getLocale, subscribeLocale } from '../../../i18n/locale';
import { paintedWords } from '../labels';
import { U } from '../materials';
import { registerWarmup, meshWarmup } from '../warmup';

/**
 * Wave 5 · the signs atlas (lane V, W5-V4; plan §3.6 "bilingual painted shop signs from V's new signs atlas"): one
 * 1024² canvas of painted shop-sign plaques for lane L's signature corners (Irving St, Clement St, 24th St, 3rd St …).
 * Generic words only (面包 Bakery, 点心 Dim Sum, 书店 Books, Taquería … never a brand, a real shop's name or a logo),
 * drawn in canvas with the page's own fonts (Noto Sans SC / Plus Jakarta Sans, the system CJK fonts as fallbacks),
 * never by an image model. City chunk only.
 *
 *   SIGNS           the plaques, append only (an id's cell never moves): lines of text + a painted style
 *   signRect(id)    the plaque's uv rectangle in the atlas
 *   SignBatch       quads textured from the atlas (like world/labels.ts LabelBatch): `plaque(…)`, then `build()`
 *   signsMaterial() THE material of every sign mesh (its own instance, "one material per object kind"): lit by the
 *                   scene by day, glowing softly at night (uNight, like the district's labels); warmed by 'v-signs'
 *
 * Use (lane L, a corner): `const sb = new SignBatch(); sb.plaque('bakery', x, y, z, ry, 2.4);` … one Mesh per corner
 * `new THREE.Mesh(sb.build(), signsMaterial())` (receiveShadow true, castShadow false: what 'v-signs' warms), i.e. one
 * draw call for all of a corner's signs. A plaque is 2 : 1 (w × w / 2).
 */

export type SignScript = 'zh' | 'ja' | 'en' | 'es';
export interface SignLine { text: string; script: SignScript }
/** Painted looks: enamel (cream, dark green), lacquer (red, gold), wood (brown, cream), teal / blue / mustard enamel, rose. */
export const SIGN_STYLES = {
  enamel: { bg: '#f4ecd9', edge: '#2f5a4c', ink: '#2f5a4c', sub: '#5b7a6c' },
  lacquer: { bg: '#b8372c', edge: '#e5b54a', ink: '#f6d27a', sub: '#f3e3c0' },
  wood: { bg: '#7a5134', edge: '#c9a46a', ink: '#f6ecd6', sub: '#e7d2ae' },
  teal: { bg: '#2f7f7a', edge: '#f1e6cf', ink: '#fbf5e8', sub: '#d9efe9' },
  blue: { bg: '#2e5a8a', edge: '#f1e6cf', ink: '#fbf5e8', sub: '#d8e4f1' },
  mustard: { bg: '#e0a94a', edge: '#6b3f22', ink: '#4a2c17', sub: '#6b3f22' },
  rose: { bg: '#e7a3a6', edge: '#7a3a45', ink: '#5a2430', sub: '#7a3a45' },
} as const;
export type SignStyle = keyof typeof SIGN_STYLES;

export interface SignSpec { id: string; lines: readonly [SignLine, SignLine?]; style: SignStyle }

const zh = (text: string): SignLine => ({ text, script: 'zh' });
const en = (text: string): SignLine => ({ text, script: 'en' });
const es = (text: string): SignLine => ({ text, script: 'es' });
const ja = (text: string): SignLine => ({ text, script: 'ja' });

/**
 * The plaques (append only: the index is the atlas cell). Chinese first where the street's shops are signed that way
 * (Irving, Clement), Spanish on 24th St (Taquería, Panadería), Japanese on Post St in Japantown (part c, lane L's
 * request: ラーメン, 和菓子, 本), English elsewhere; generic trade words only.
 */
export const SIGNS: readonly SignSpec[] = [
  { id: 'bakery', lines: [zh('面包'), en('Bakery')], style: 'lacquer' },
  { id: 'dim-sum', lines: [zh('点心'), en('Dim Sum')], style: 'lacquer' },
  { id: 'books', lines: [zh('书店'), en('Books')], style: 'enamel' },
  { id: 'flowers', lines: [zh('花店'), en('Flowers')], style: 'rose' },
  { id: 'coffee', lines: [zh('咖啡'), en('Coffee')], style: 'wood' },
  { id: 'grocery', lines: [zh('杂货'), en('Grocery')], style: 'teal' },
  { id: 'produce', lines: [zh('蔬果'), en('Produce')], style: 'enamel' },
  { id: 'tea', lines: [zh('茶'), en('Tea')], style: 'wood' },
  { id: 'noodles', lines: [zh('面馆'), en('Noodles')], style: 'lacquer' },
  { id: 'hardware', lines: [zh('五金'), en('Hardware')], style: 'blue' },
  { id: 'taqueria', lines: [es('Taquería'), en('Tacos · Burritos')], style: 'mustard' },
  { id: 'panaderia', lines: [es('Panadería'), en('Bakery')], style: 'rose' },
  { id: 'mercado', lines: [es('Mercado'), en('Market')], style: 'teal' },
  { id: 'cafe', lines: [en('Café')], style: 'wood' },
  { id: 'books-en', lines: [en('Books')], style: 'enamel' },
  { id: 'records', lines: [en('Records')], style: 'blue' },
  { id: 'vintage', lines: [en('Vintage')], style: 'mustard' },
  { id: 'barber', lines: [en('Barber')], style: 'enamel' },
  { id: 'market', lines: [en('Market')], style: 'teal' },
  { id: 'deli', lines: [en('Deli')], style: 'wood' },
  { id: 'soul-food', lines: [en('Soul Food')], style: 'mustard' },
  { id: 'laundry', lines: [zh('洗衣'), en('Laundry')], style: 'blue' },
  // part c (lane L's Japantown corner): generic Japanese trade words
  { id: 'ramen', lines: [ja('ラーメン'), en('Ramen')], style: 'lacquer' },
  { id: 'sweets', lines: [ja('和菓子'), en('Sweets')], style: 'rose' },
  { id: 'hon', lines: [ja('本'), en('Books')], style: 'enamel' },
];

/** 1024² canvas, 4 × 8 cells of 256 × 128 px (a 244 × 122 plaque, 2 : 1 like its quad, centred in each cell). */
export const SIGN_ATLAS = { size: 1024, cols: 4, rows: 8, cellW: 256, cellH: 128, margin: 6 } as const;

const index = new Map(SIGNS.map((s, i) => [s.id, i]));
/** A sign's cell (its SIGNS index), or -1. */
export const signCell = (id: string) => index.get(id) ?? -1;

/** The plaque's box in the canvas (px, y down): exactly 2 : 1 (like the quads), centred in its cell. */
export function signCellBox(cell: number): { x: number; y: number; w: number; h: number } {
  const col = cell % SIGN_ATLAS.cols, row = Math.floor(cell / SIGN_ATLAS.cols), m = SIGN_ATLAS.margin;
  const w = SIGN_ATLAS.cellW - 2 * m, h = w / 2;
  return { x: col * SIGN_ATLAS.cellW + m, y: row * SIGN_ATLAS.cellH + (SIGN_ATLAS.cellH - h) / 2, w, h };
}

/** The plaque's uv rectangle (v up), half a texel inside its box. Unknown id: null. */
export function signRect(id: string): { u0: number; v0: number; u1: number; v1: number } | null {
  const c = signCell(id);
  if (c < 0) return null;
  const b = signCellBox(c), S = SIGN_ATLAS.size;
  return { u0: (b.x + 0.5) / S, u1: (b.x + b.w - 0.5) / S, v0: 1 - (b.y + b.h - 0.5) / S, v1: 1 - (b.y + 0.5) / S };
}

/** Font stacks (the page loads Noto Sans SC and Plus Jakarta Sans; the system CJK fonts cover the rest). */
export const SIGN_FONTS = {
  zh: "900 {px}px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif",
  /** kana and Japanese kanji forms: the system Japanese fonts first (iOS / macOS Hiragino, Windows Yu Gothic / Meiryo) */
  ja: "900 {px}px 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'Noto Sans JP', 'Noto Sans SC', sans-serif",
  latin: "800 {px}px 'Plus Jakarta Sans', 'Segoe UI', system-ui, -apple-system, sans-serif",
} as const;

/** The part of the canvas 2D API the atlas uses (tests pass a recorder). */
export interface SignCtx {
  save(): void; restore(): void; beginPath(): void; closePath(): void;
  moveTo(x: number, y: number): void; lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  fill(): void; stroke(): void; fillRect(x: number, y: number, w: number, h: number): void; clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  translate(x: number, y: number): void; scale(x: number, y: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(o: number, c: string): void };
  font: string; fillStyle: unknown; strokeStyle: unknown; lineWidth: number; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline; globalAlpha: number;
}

function roundRect(g: SignCtx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

/** Fit one line of text into maxW (px): the font size, then a horizontal squeeze only past 0.8 of it. */
function fitText(g: SignCtx, line: SignLine, px: number, cx: number, cy: number, maxW: number, spacing: number) {
  g.font = (line.script === 'zh' ? SIGN_FONTS.zh : line.script === 'ja' ? SIGN_FONTS.ja : SIGN_FONTS.latin).replace('{px}', String(Math.round(px)));
  const text = line.script === 'zh' || line.script === 'ja' ? [...line.text].join(spacing > 0 ? ' ' : '') : line.text;
  const w = g.measureText(text).width;
  if (w <= maxW) { g.fillText(text, cx, cy); return; }
  g.save();
  g.translate(cx, cy);
  g.scale(Math.max(0.6, maxW / w), 1);
  g.fillText(text, 0, 0);
  g.restore();
}

/** Paint one plaque into its box: a rounded board, a painted edge, a soft top light, the words, two screws. */
export function drawSign(g: SignCtx, spec: SignSpec, box: { x: number; y: number; w: number; h: number }) {
  const st = SIGN_STYLES[spec.style];
  const { x, y, w, h } = box;
  g.save();
  roundRect(g, x, y, w, h, 14);
  g.fillStyle = st.edge;
  g.fill();
  roundRect(g, x + 6, y + 6, w - 12, h - 12, 10);
  g.fillStyle = st.bg;
  g.fill();
  // a soft top light and a darker foot (painted metal / lacquer), inside the board
  const grad = g.createLinearGradient(0, y + 6, 0, y + h - 6);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grad;
  roundRect(g, x + 6, y + 6, w - 12, h - 12, 10);
  g.fill();
  // the words: one line big, or a big first line and a small second one
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const [a, b] = spec.lines;
  // (the words keep clear of the screws: 29 px each side)
  const cx = x + w / 2, maxW = w - 58;
  g.fillStyle = st.ink;
  const cjk = a.script === 'zh' || a.script === 'ja';
  if (!b) fitText(g, a, cjk ? 62 : 46, cx, y + h / 2 + 2, maxW, cjk ? 1 : 0);
  else {
    fitText(g, a, cjk ? 54 : 40, cx, y + h * 0.42, maxW, cjk && [...a.text].length <= 3 ? 1 : 0);
    g.fillStyle = st.sub;
    fitText(g, b, 21, cx, y + h * 0.78, maxW, 0);
  }
  // two screws
  g.fillStyle = st.edge;
  for (const sx of [x + 17, x + w - 17]) { g.beginPath(); g.arc(sx, y + h / 2, 3.2, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/**
 * Paint every plaque into its cell (on a transparent canvas: the gaps between plaques are never sampled). `words`: the
 * Chinese lines in the reader's script (world/labels paintedWords: 繁體 readers get 麵包 · 點心 · 書店); Japanese, Spanish
 * and English lines are never touched.
 */
export function drawSignsAtlas(g: SignCtx, words: (text: string) => string = text => text) {
  g.clearRect(0, 0, SIGN_ATLAS.size, SIGN_ATLAS.size);
  const z = (l: SignLine): SignLine => (l.script === 'zh' ? { ...l, text: words(l.text) } : l);
  SIGNS.forEach((spec, i) => {
    const [a, b] = spec.lines;
    drawSign(g, { ...spec, lines: b ? [z(a), z(b)] : [z(a)] }, signCellBox(i));
  });
}

let tex: THREE.Texture | null = null;
/** The atlas texture (painted on first use, again on a 简体 ↔ 繁體 switch): a CanvasTexture in the browser, a 1 × 1 cream texel without a DOM. */
export function signsTexture(): THREE.Texture {
  if (tex) return tex;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIGN_ATLAS.size;
    const ctx = canvas.getContext('2d') as unknown as SignCtx | null;
    if (ctx && typeof ctx.fillText === 'function') {
      drawSignsAtlas(ctx, paintedWords);
      const t = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
      t.name = 'ob-signs';
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      // a language switch (简体 ↔ 繁體): the plaques re-painted in the new script, one texture upload (≈ 25 plaques, a
      // few ms); English keeps the bilingual plaques as they are. The texture lives for the page: so does this.
      let hant = getLocale() === 'zh-Hant';
      subscribeLocale(() => {
        if ((getLocale() === 'zh-Hant') === hant) return;
        hant = !hant;
        drawSignsAtlas(ctx, paintedWords);
        t.needsUpdate = true;
      });
      return (tex = t);
    }
  }
  const t = new THREE.DataTexture(new Uint8Array([244, 236, 217, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return (tex = t);
}

let material: THREE.MeshStandardMaterial | null = null;
/**
 * The sign material (one instance for every sign mesh: the program 'v-signs' warms): the atlas as colour, lit by the
 * sun by day; at night the plaque glows a little (emissive = the atlas × uNight × 0.6), like a lit shop sign.
 */
export function signsMaterial(): THREE.MeshStandardMaterial {
  if (material) return material;
  const map = signsTexture();
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.72, metalness: 0, emissive: '#ffeccc', emissiveMap: map, emissiveIntensity: 1, alphaTest: 0.5, side: THREE.FrontSide });
  m.name = 'ob-signs';
  m.onBeforeCompile = shader => {
    shader.uniforms.uNight = U.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight * 0.6;');
  };
  m.customProgramCacheKey = () => 'ob-signs';
  return (material = m);
}

/** Quads textured from the signs atlas (position + normal + uv), merged into one geometry per corner. */
export class SignBatch {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  /** plaques placed (an unknown id places nothing) */
  count = 0;

  /**
   * A plaque of sign `id` on a vertical plane facing yaw `ry` (three.js: facing (sin ry, cos ry)), centred at (x, y, z),
   * `w` u wide and w / 2 high, lifted 0.02 u off its wall. Returns false for an unknown id.
   */
  plaque(id: string, x: number, y: number, z: number, ry: number, w: number): boolean {
    const r = signRect(id);
    if (!r) return false;
    const nx = Math.sin(ry), nz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
    const h = w / 2, cx = x + nx * 0.02, cz = z + nz * 0.02;
    const base = this.pos.length / 3;
    for (const [sx, sy, u, v] of [[-1, -1, r.u0, r.v0], [1, -1, r.u1, r.v0], [1, 1, r.u1, r.v1], [-1, 1, r.u0, r.v1]] as const) {
      this.pos.push(cx + (rx * sx * w) / 2, y + (sy * h) / 2, cz + (rz * sx * w) / 2);
      this.nor.push(nx, 0, nz);
      this.uv.push(u, v);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count++;
    return true;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Warm-up (W5-V6 recipe): the sign program as the corners draw it (a plain Mesh, receiving shadows, not casting). */
registerWarmup('v-signs', () => meshWarmup(signsMaterial(), { receiveShadow: true }));
