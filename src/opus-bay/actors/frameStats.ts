import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { projectNorm } from './camera';
import { BAYBAY_HEIGHT, PLAYER_HEIGHT } from './dims';
import { view } from './view';

// ---------------------------------------------------------------------------
// C9 · QA helper: where the horizon and the two heroes sit in the frame (0 = top, 1 = bottom of the canvas)
// ---------------------------------------------------------------------------

const tmpF = new THREE.Vector3();
const r3 = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);

/** Vertical extent of a standing character (feet → head, plus a shoulder's width to each side) in normalised canvas units. */
function extent(camera: THREE.PerspectiveCamera, x: number, y: number, z: number, height: number, halfW: number) {
  camera.getWorldDirection(tmpF);
  const rx = -tmpF.z, rz = tmpF.x, L = Math.hypot(rx, rz) || 1;
  const pts = [
    projectNorm(camera, x, y, z), projectNorm(camera, x, y + height, z),
    projectNorm(camera, x + (rx / L) * halfW, y + height * 0.5, z + (rz / L) * halfW), projectNorm(camera, x - (rx / L) * halfW, y + height * 0.5, z - (rz / L) * halfW),
  ];
  if (pts.some(p => p === null)) return null;
  const ys = pts.map(p => p!.y), xs = pts.map(p => p!.x);
  return { top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
}

export function frameStats(camera: THREE.PerspectiveCamera) {
  camera.updateMatrixWorld();
  camera.getWorldDirection(tmpF);
  const hx = tmpF.x, hz = tmpF.z, hl = Math.hypot(hx, hz) || 1;
  const cp = camera.position;
  const hp = projectNorm(camera, cp.x + (hx / hl) * 2000, 0, cp.z + (hz / hl) * 2000);
  const horizonY = hp && hp.y >= 0 && hp.y <= 1 ? hp.y : null;
  const p = runtime.player, g = runtime.guide;
  const pe = extent(camera, view.ready ? view.x : p.x, view.ready ? view.y : p.y, view.ready ? view.z : p.z, PLAYER_HEIGHT, 0.5);
  const ge = extent(camera, g.x, g.y, g.z, BAYBAY_HEIGHT, 0.45);
  const onScreen = (e: ReturnType<typeof extent>) => !!e && e.bottom > 0 && e.top < 1 && e.right > 0 && e.left < 1;
  const W = typeof window !== 'undefined' ? window.innerWidth : 0, H = typeof window !== 'undefined' ? window.innerHeight : 0;
  const px = (e: ReturnType<typeof extent>) => (e ? { left: Math.round(e.left * W), top: Math.round(e.top * H), right: Math.round(e.right * W), bottom: Math.round(e.bottom * H) } : null);
  return {
    horizonY: r3(horizonY),
    playerTop: r3(pe?.top ?? null), playerBottom: r3(pe?.bottom ?? null), playerH: r3(pe ? pe.bottom - pe.top : null),
    guideOnScreen: onScreen(ge),
    guideTop: r3(ge?.top ?? null), guideBottom: r3(ge?.bottom ?? null), guideH: r3(ge ? ge.bottom - ge.top : null),
    /** CSS px rects (for DOM overlap checks) */
    playerRect: px(pe), guideRect: px(ge),
    fov: Math.round(camera.fov * 10) / 10,
    viewOffsetY: camera.view?.enabled ? camera.view.offsetY : 0,
    gap: Math.round(Math.hypot(g.x - p.x, g.z - p.z) * 10) / 10,
  };
}
