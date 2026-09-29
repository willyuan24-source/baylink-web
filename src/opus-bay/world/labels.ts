import * as THREE from 'three';
import { getLocale, subscribeLocale, translateText } from '../../i18n/locale';
import { U } from './materials';

const HAN = /\p{Script=Han}/u;
/**
 * The words a painted sign shows in the reader's edition (the language switch, ui/LangPills): a 繁體 reader gets the
 * Traditional characters (the site's conversion layer, loaded before the switch takes effect); 简体 and English keep
 * the sign's own words (a bilingual sign stays bilingual). Only Chinese text: pass nothing else (Japanese kanji!).
 */
export const paintedWords = (text: string): string => (getLocale() === 'zh-Hant' && HAN.test(text) ? translateText(text, 'zh-Hant') : text);

/**
 * One canvas texture atlas for every painted sign (pier numbers, plaques, clock faces, stop signs,
 * streetcar destination blinds). Labels are placed as small quads in one merged geometry.
 */

export interface LabelSpec {
  text: string;
  /** canvas px size of the cell */
  w: number;
  h: number;
  bg: string;
  fg: string;
  font?: 'serif' | 'sans' | 'cjk';
  border?: string;
  /** relative font size (0..1 of cell height) */
  size?: number;
}

type Rect = { u0: number; v0: number; u1: number; v1: number };

const SIZE = 1024;
/**
 * Overflow guard (wave 5, lane V W5-V2; the capacity scout: the atlas was 76 % full and a label past the bottom drew
 * nowhere while its quad sampled past the canvas edge, i.e. another label's pixels): the bottom LABEL_RESERVE px stay
 * free, a label that does not fit maps to a blank strip of the atlas's base colour there (an empty plaque), is counted in
 * `overflow` and warned about once in DEV. Allocations that fit are exactly as before (the district's labels unchanged).
 */
export const LABEL_RESERVE = 8;
const BLANK: Rect = { u0: 2 / SIZE, v0: 2 / SIZE, u1: 6 / SIZE, v1: 6 / SIZE };
const FONTS = {
  serif: "700 {px}px Georgia, 'Times New Roman', serif",
  sans: "800 {px}px 'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
  cjk: "700 {px}px 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Plus Jakarta Sans', sans-serif",
};

export class LabelAtlas {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private x = 0;
  private y = 0;
  private rowH = 0;
  private rects = new Map<string, Rect>();
  /** the labels with Chinese words (the district's 这周去哪 board): re-painted in their cells on a language switch */
  private zh = new Map<string, { rect: Rect; spec: LabelSpec; painted: string }>();
  private offLocale: (() => void) | null = null;
  /** labels that did not fit (mapped to the blank strip; 0 in a healthy build) */
  overflow = 0;
  readonly texture: THREE.CanvasTexture;
  readonly material: THREE.MeshStandardMaterial;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fillStyle = '#e9e0cf';
    this.ctx.fillRect(0, 0, SIZE, SIZE);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.8, metalness: 0, emissive: '#fff4dc', emissiveMap: this.texture, emissiveIntensity: 0 });
    this.material.name = 'ob-labels';
    this.material.onBeforeCompile = shader => {
      shader.uniforms.uNight = U.uNight;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight * 0.55;');
      shader.fragmentShader = shader.fragmentShader.replace('uniform vec3 emissive;', 'uniform vec3 emissive;');
    };
    this.material.emissiveIntensity = 1;
  }

  /** How much of the atlas height is taken (the current row's bottom edge / the canvas height). */
  get used(): number { return Math.min(1, (this.y + this.rowH) / SIZE); }

  /** A cell for a w × h label, or null when it does not fit above the reserved strip (the guard). */
  private alloc(w: number, h: number): Rect | null {
    if (w > SIZE) return null;
    const newRow = this.x + w > SIZE;
    const y = newRow ? this.y + this.rowH + 2 : this.y;
    if (y + h > SIZE - LABEL_RESERVE) return null;
    if (newRow) { this.x = 0; this.y = y; this.rowH = 0; }
    const r = { u0: this.x / SIZE, v0: 1 - (this.y + h) / SIZE, u1: (this.x + w) / SIZE, v1: 1 - this.y / SIZE };
    const px = this.x, py = this.y;
    this.x += w + 2;
    this.rowH = Math.max(this.rowH, h);
    this.ctx.save();
    this.ctx.translate(px, py);
    return r;
  }

  /** The guard's answer for a label that does not fit: the blank strip (cached under its key, so it is counted once). */
  private overflowed(key: string): Rect {
    this.overflow++;
    if (this.overflow === 1 && import.meta.env?.DEV) console.warn(`[opus-bay labels] the label atlas is full: "${key}" is drawn blank (used ${Math.round(this.used * 100)} %)`);
    this.rects.set(key, BLANK);
    return BLANK;
  }

  label(key: string, spec: LabelSpec): Rect {
    const hit = this.rects.get(key);
    if (hit) return hit;
    const r = this.alloc(spec.w, spec.h);
    if (!r) return this.overflowed(key);
    const words = paintedWords(spec.text);
    this.paint(spec, words);
    this.rects.set(key, r);
    if (HAN.test(spec.text)) {
      this.zh.set(key, { rect: r, spec, painted: words });
      // (the World is built once per page: the atlas follows the language for the page's lifetime)
      this.offLocale ??= subscribeLocale(() => { this.repaintChinese(); });
    }
    this.texture.needsUpdate = true;
    return r;
  }

  /** Paint a label into the cell the context is translated to (alloc's save / translate; restored here). */
  private paint(spec: LabelSpec, words: string) {
    const g = this.ctx;
    g.fillStyle = spec.bg;
    g.fillRect(0, 0, spec.w, spec.h);
    if (spec.border) {
      g.strokeStyle = spec.border;
      g.lineWidth = Math.max(2, spec.h * 0.06);
      g.strokeRect(g.lineWidth, g.lineWidth, spec.w - g.lineWidth * 2, spec.h - g.lineWidth * 2);
    }
    const px = Math.round(spec.h * (spec.size ?? 0.58));
    g.font = FONTS[spec.font ?? 'serif'].replace('{px}', String(px));
    g.fillStyle = spec.fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const maxW = spec.w * 0.9;
    const m = g.measureText(words).width;
    if (m > maxW) { g.save(); g.translate(spec.w / 2, spec.h / 2 + px * 0.04); g.scale(maxW / m, 1); g.fillText(words, 0, 0); g.restore(); }
    else g.fillText(words, spec.w / 2, spec.h / 2 + px * 0.04);
    g.restore();
  }

  /**
   * A language switch: the labels with Chinese words re-painted in the reader's script (简体 ↔ 繁體), each into its own
   * cell — no re-layout, one texture upload. Returns how many changed (0 for English ↔ 简体: the signs keep their words).
   */
  repaintChinese(): number {
    let n = 0;
    for (const z of this.zh.values()) {
      const words = paintedWords(z.spec.text);
      if (words === z.painted) continue;
      this.ctx.save();
      this.ctx.translate(Math.round(z.rect.u0 * SIZE), Math.round((1 - z.rect.v1) * SIZE));
      this.paint(z.spec, words);
      z.painted = words;
      n++;
    }
    if (n) this.texture.needsUpdate = true;
    return n;
  }

  /** Clock face (no hands — the hands are live geometry). */
  clockFace(): Rect {
    const hit = this.rects.get('clock');
    if (hit) return hit;
    const s = 192;
    const r = this.alloc(s, s);
    if (!r) return this.overflowed('clock');
    const g = this.ctx;
    g.fillStyle = '#e9e0cf';
    g.fillRect(0, 0, s, s);
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2); g.fillStyle = '#5f6b64'; g.fill();
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.43, 0, Math.PI * 2); g.fillStyle = '#fbf6ea'; g.fill();
    g.strokeStyle = '#2d3530';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.lineWidth = i % 3 === 0 ? 7 : 3.5;
      const r0 = s * (i % 3 === 0 ? 0.3 : 0.34), r1 = s * 0.4;
      g.beginPath(); g.moveTo(s / 2 + Math.sin(a) * r0, s / 2 - Math.cos(a) * r0); g.lineTo(s / 2 + Math.sin(a) * r1, s / 2 - Math.cos(a) * r1); g.stroke();
    }
    g.restore();
    this.rects.set('clock', r);
    this.texture.needsUpdate = true;
    return r;
  }
}

/** Quads textured from the atlas (position + normal + uv). */
export class LabelBatch {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  idx: number[] = [];

  /** Quad centred at c with half extents along right (rx) and up (ux), facing n. */
  quad(c: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, w: number, h: number, r: Rect) {
    const n = new THREE.Vector3().crossVectors(right, up).normalize();
    const base = this.pos.length / 3;
    const corners: [number, number, number, number][] = [[-1, -1, r.u0, r.v0], [1, -1, r.u1, r.v0], [1, 1, r.u1, r.v1], [-1, 1, r.u0, r.v1]];
    for (const [sx, sy, u, v] of corners) {
      const p = c.clone().addScaledVector(right, (sx * w) / 2).addScaledVector(up, (sy * h) / 2);
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(u, v);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Quad on a vertical plane facing yaw `ry` (three.js: faces (sin ry, cos ry)). */
  facing(x: number, y: number, z: number, ry: number, w: number, h: number, r: Rect) {
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const right = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    this.quad(new THREE.Vector3(x, y, z).addScaledVector(n, 0.02), right, new THREE.Vector3(0, 1, 0), w, h, r);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
