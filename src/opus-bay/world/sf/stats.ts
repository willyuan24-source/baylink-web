import type * as THREE from 'three';
import { programsCount } from '../warmup';
import type { CityStreamer } from './stream';

/**
 * City streaming diagnostics: `window.__opusBay.city` (DEV: stats(), the streamer, goto(x, z) for QA) and, with
 * `?debug=1`, a small fixed overlay (tiers on screen, jobs queued / in flight, worker ms, attach ms, pool fill,
 * props, landmark LODs, draw calls, triangles, programs). The overlay is plain DOM, refreshed 4× a second, outside
 * React so it costs nothing when absent.
 */

type Win = { __opusBay?: Record<string, unknown> };

function debugFlag(): boolean {
  try { return new URLSearchParams(location.search).get('debug') === '1'; } catch { return false; }
}

export function mountCityDebug(streamer: CityStreamer, renderer: THREE.WebGLRenderer): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as unknown as Win;
  const api = {
    streamer,
    stats: () => ({ ...streamer.stats(), programs: programsCount(renderer), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    /** QA: focus the streaming on (x, z) (null = back to the player) and resolve when it is ready */
    focus: (x: number | null, z = 0, r = 150) => {
      streamer.focusOverride = x === null ? null : { x, z };
      return x === null ? Promise.resolve() : streamer.whenReady({ x, z }, r);
    },
    whenReady: (x: number, z: number, r = 150) => streamer.whenReady({ x, z }, r),
  };
  if (import.meta.env.DEV) {
    w.__opusBay = { ...(w.__opusBay ?? {}), city: api };
    // other modules re-publish __opusBay on their own schedule: keep ours on it
  }
  const keep = import.meta.env.DEV ? window.setInterval(() => { const o = w.__opusBay; if (o && o.city !== api) o.city = api; }, 500) : 0;
  if (!debugFlag()) return () => window.clearInterval(keep);
  const el = document.createElement('pre');
  el.className = 'ob-city-debug';
  Object.assign(el.style, {
    position: 'fixed', right: '8px', bottom: '96px', zIndex: '60', margin: '0', padding: '6px 8px', pointerEvents: 'none',
    font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace', color: '#f4efe3', background: 'rgba(40, 44, 48, 0.72)', borderRadius: '6px', whiteSpace: 'pre',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  const tick = () => {
    const s = api.stats();
    const p = s.pool;
    el.textContent = [
      `city ${s.status}  l0 ${s.l0} · l1 ${s.l1} · l2 ${s.l2}  (want ${s.want0}/${s.want1})`,
      `jobs q ${s.queued} · run ${s.inflight} · done ${s.jobs}${s.errors ? ` · err ${s.errors}` : ''}  worker ${s.workerMs} ms`,
      `attach ${s.attachMs} ms (max ${s.attachMaxMs})  rasters ${s.resident}`,
      `pool ${p.kind} ${p.visible}/${p.items}  toy ${(p.toyVertices / 1000).toFixed(0)}k/${(p.toyCapacity / 1000).toFixed(0)}k  gnd ${(p.groundVertices / 1000).toFixed(0)}k`,
      `props ${Object.entries(s.props).map(([k, v]) => `${k} ${v}`).join(' ')}`,
      `sites near ${s.sites.near} (${(s.sites.triangles / 1000).toFixed(1)}k)  tris l0 ${(s.l0Triangles / 1000).toFixed(0)}k · l1 ${(s.l1Triangles / 1000).toFixed(0)}k · l2 ${(s.l2Triangles / 1000).toFixed(0)}k${s.heroFar ? '  hero far' : ''}`,
      `calls ${s.calls} · tris ${(s.triangles / 1000).toFixed(0)}k · programs ${s.programs}  focus ${s.focus.x},${s.focus.z}`,
    ].join('\n');
  };
  const id = window.setInterval(tick, 250);
  return () => { window.clearInterval(id); window.clearInterval(keep); el.remove(); };
}
