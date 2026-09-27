import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { CELL } from '../core/geo';
import { heightAt, inSlab, standAt } from '../core/terrain';
import { type CableLine, type TransitData, pointAt } from '../data/transit';
import { BOX, Batch, type Info, M } from './builder';
import { TOY } from './materials';
import { RAIL_GAUGE } from './turntable';

/**
 * Cable-car rails and cable slot where the streamed city draws none (lane F, checkpoint F5). The city's L0 streets
 * (world/sf/build.ts) already lay the OSM cable tracks; F adds the pieces they miss:
 *   - the hero slab spans (California from Drumm to Sansome, the Taylor & Bay tail): the city clips its streets there;
 *   - the turntable stubs beyond the published path (Hyde & Beach 11.7 u, Taylor & Bay 5.6 u; Powell & Market's rails
 *     are the landmark's);
 *   - the Powell & Jackson corner, where the route relation leaves the drawn track by up to 3.6 u (RAIL_GAPS_V1).
 * Pieces are grouped by 64 u cell and built only where the terrain is exact (hero, or a resident city chunk) within the
 * L0 radius, at heightAt + 0.02 (rail tops at +0.08, where the cars' wheels run), at most one cell per frame, merged into
 * one TOY mesh (1 draw call; none beyond L0).
 */

/** Arc spans (extended path, u) of the v1 data where the city's drawn cable track and the route path part (> 0.6 u). */
export const RAIL_GAPS_V1: Record<string, [number, number][]> = { 'powell-hyde': [[154, 168]] };

const NEAR_IN = 150, NEAR_OUT = 190;
const STEP = 1;
const RAIL: Info = [0, -100, 0, 0];

/** A track F lays besides the cable lines' spans (the city F-line: data/fline.ts via world/flineLayer.ts). */
export interface RailTrack { track: Pick<CableLine, 'xyz' | 'cum' | 'length'>; cable: boolean; a?: number; b?: number }

interface Piece { line: Pick<CableLine, 'xyz' | 'cum' | 'length'>; a: number; b: number; cable: boolean }
interface Cell { key: number; cx: number; cz: number; pieces: Piece[]; built: Batch | null; probe: { x: number; z: number } }

/** Ground height where the terrain is exact (hero slab, or a resident city chunk), else null. */
export function residentGround(x: number, z: number): number | null {
  return inSlab(x, z) || standAt(x, z) !== -1 ? heightAt(x, z) : null;
}

/** Every extra piece of track F draws, per line (pure: the test checks them against the data). */
export function extraSpans(data: TransitData): { line: string; a: number; b: number; why: 'hero' | 'stub' | 'gap' }[] {
  const out: { line: string; a: number; b: number; why: 'hero' | 'stub' | 'gap' }[] = [];
  for (const line of data.lines) {
    for (const [a, b] of line.heroSpans) out.push({ line: line.id, a, b: b >= line.s0 + line.osmLength - 0.5 ? line.length : b, why: 'hero' });
    if (line.turntableEnd && !line.turntableEnd.landmark) {
      const a = line.s0 + line.osmLength;
      if (!out.some(o => o.line === line.id && o.a <= a && o.b >= line.length)) out.push({ line: line.id, a: a - 1, b: line.length, why: 'stub' });
    }
    for (const [a, b] of RAIL_GAPS_V1[line.id] ?? []) out.push({ line: line.id, a, b, why: 'gap' });
  }
  return out;
}

export class RailLayer {
  readonly mesh: THREE.Mesh;
  private cells = new Map<number, Cell>();
  private dirty = false;
  private check = 0;

  constructor(data: TransitData, extra: RailTrack[] = []) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), TOY);
    this.mesh.name = 'cable-rails';
    this.mesh.matrixAutoUpdate = false;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    const spans: { line: Piece['line']; a: number; b: number; cable: boolean }[] = extraSpans(data).map(span => ({ line: data.lines.find(l => l.id === span.line)!, a: span.a, b: span.b, cable: true }));
    for (const t of extra) spans.push({ line: t.track, a: t.a ?? 0, b: t.b ?? t.track.length, cable: t.cable });
    const p = { x: 0, y: 0, z: 0, heading: 0, grade: 0 };
    for (const span of spans) {
      const line = span.line;
      for (let s = span.a; s < span.b - 1e-3; s += STEP) {
        const e = Math.min(span.b, s + STEP);
        pointAt(line, (s + e) / 2, p);
        const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL), key = (cx + 1024) * 4096 + (cz + 1024);
        let cell = this.cells.get(key);
        if (!cell) { cell = { key, cx, cz, pieces: [], built: null, probe: { x: p.x, z: p.z } }; this.cells.set(key, cell); }
        const last = cell.pieces[cell.pieces.length - 1];
        if (last && last.line === line && Math.abs(last.b - s) < 1e-3) last.b = e;
        else cell.pieces.push({ line, a: s, b: e, cable: span.cable });
      }
    }
  }

  /** Build one cell's rails (null while the terrain there is not exact yet). */
  private build(cell: Cell): Batch | null {
    if (residentGround(cell.probe.x, cell.probe.z) === null) return null;
    const b = new Batch();
    const pa = { x: 0, y: 0, z: 0, heading: 0, grade: 0 }, pb = { ...pa };
    for (const piece of cell.pieces) {
      let e: number;
      for (let s = piece.a; s < piece.b - 1e-3; s = e) {
        // the F-line's plain rails take 2 u steps where the track is straight (0.8 on curves and on cable tracks)
        e = Math.min(piece.b, s + (piece.cable ? 0.8 : 2));
        pointAt(piece.line, s, pa); pointAt(piece.line, e, pb);
        if (!piece.cable && e - s > 0.81) {
          const h0 = pa.heading;
          pointAt(piece.line, e - 0.05, pb);
          if (Math.abs(Math.atan2(Math.sin(pb.heading - h0), Math.cos(pb.heading - h0))) > 0.06) e = Math.min(piece.b, s + 0.8);
          pointAt(piece.line, e, pb);
        }
        // F-line sidings on city streets sit on top of the city's asphalt and rails (LIFT.rail 0.075 in world/sf/build.ts)
        const lift = piece.cable || inSlab((pa.x + pb.x) / 2, (pa.z + pb.z) / 2) ? 0.02 : 0.085;
        const ya = (residentGround(pa.x, pa.z) ?? pa.y) + lift, yb = (residentGround(pb.x, pb.z) ?? pb.y) + lift;
        const dx = pb.x - pa.x, dz = pb.z - pa.z, len = Math.hypot(dx, dz);
        if (len < 1e-3) continue;
        const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(yb - ya, len);
        const cx = (pa.x + pb.x) / 2, cz = (pa.z + pb.z) / 2, cy = (ya + yb) / 2;
        const lx = Math.cos(yaw), lz = -Math.sin(yaw);
        for (const o of [-RAIL_GAUGE, RAIL_GAUGE]) b.add(BOX(), M(cx + lx * o, cy - 0.03, cz + lz * o, yaw, 0.1, 0.06, len + 0.02, pitch), '#8d8a84', RAIL);
        if (!piece.cable) {
          // the F-line's paved track bed across the hero plaza (the district's trackbed colour)
          if (lift < 0.05) b.add(BOX(), M(cx, cy - 0.034, cz, yaw, RAIL_GAUGE * 2 + 0.55, 0.014, len + 0.04, pitch), '#a39886', RAIL);
          continue;
        }
        b.add(BOX(), M(cx, cy - 0.03, cz, yaw, 0.07, 0.052, len + 0.02, pitch), '#3f3a35', RAIL);
        // sleepers-in-the-road plates every other step (a hint of the conduit covers)
        if (Math.round(s / 0.8) % 3 === 0) b.add(BOX(), M(cx, cy - 0.035, cz, yaw, RAIL_GAUGE * 2 + 0.4, 0.045, 0.22, pitch), '#6d6861', RAIL);
      }
    }
    return b;
  }

  update(dt: number) {
    if ((this.check -= dt) > 0 && !this.dirty) return;
    this.check = 0.25;
    const p = runtime.player;
    let built = false;
    for (const cell of this.cells.values()) {
      const d = Math.hypot((cell.cx + 0.5) * CELL - p.x, (cell.cz + 0.5) * CELL - p.z);
      if (cell.built && d > NEAR_OUT) { cell.built = null; this.dirty = true; continue; }
      if (!cell.built && d < NEAR_IN && !built) {
        cell.built = this.build(cell);
        if (cell.built) { built = true; this.dirty = true; }
      }
    }
    if (!this.dirty) return;
    this.dirty = built; // another cell may be waiting: look again next frame
    this.merge();
  }

  private merge() {
    const all = new Batch();
    for (const c of this.cells.values()) if (c.built) all.merge(c.built);
    this.mesh.geometry.dispose();
    this.mesh.geometry = all.vertexCount ? all.build() : new THREE.BufferGeometry();
    this.mesh.visible = all.vertexCount > 0;
  }

  stats() { let cells = 0, tris = 0; for (const c of this.cells.values()) if (c.built) { cells++; tris += c.built.idx.length / 3; } return { cells, total: this.cells.size, triangles: tris }; }

  dispose() { this.mesh.geometry.dispose(); }
}
