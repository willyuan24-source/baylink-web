import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { heightAt } from '../core/terrain';
import { DISTRICT } from '../data/district';
import { getLocale } from '../../i18n/locale';
import { pick } from '../i18n';
import { updateFocus, updateGuide } from './brain';
import { currentFraming, measureBottomCover, stepCinema } from './cinema';
import { BAYBAY_HEAD_Y, PLAYER_HEAD_Y } from '../actors/dims';
import * as flowActions from './flow';
import { busy, callBaybay, finishRide, objectiveTarget, performInteraction, requestInteract, teleportPlayer, walkTo } from './flow';
import { flow } from './flowStore';
import { BAYBAY_ID, JOGGER_ID, buildInteractables, interactableById, postcardIdOf, setInteractables, type Interactable } from './interactables';
import { consumeShutter } from './photo';
import { domAnchors, overlayInsets } from './projector';
import { gameTimeLabel } from './travel';
import { readQa } from './qa';
import { stepRide } from './ride';

/**
 * Canvas-side game systems: click/hover proxies, the gold focus marker, postcard glints, the objective
 * beacon and one ticker that runs cinematics, rides, input edges, 10 Hz focus + guide brain,
 * DOM projection (bubbles / waypoint), photo capture and the debug readout.
 */
export function Systems() {
  const list = useMemo(() => buildInteractables(), []);
  useLayoutEffect(() => { setInteractables(list); }, [list]);
  return (
    <>
      <Proxies list={list} />
      <FocusMarker />
      <PostcardGlints list={list} />
      <Beacon />
      <Ticker />
      <QaBridge />
    </>
  );
}

// ---------------------------------------------------------------------------
// Click / hover proxies (one instanced mesh + one for BAYBAY; invisible material)
// ---------------------------------------------------------------------------

type Hit = { id: string; x: number; y: number; z: number; r: number; card?: string };

const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
const hitGeometry = new THREE.SphereGeometry(1, 10, 8);
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpVec = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

function activate(id: string) {
  if (busy()) return;
  const it = interactableById(id);
  if (!it) return;
  emit({ type: 'ui', action: 'select' });
  const p = runtime.player;
  const d = Math.hypot(p.x - it.x, p.z - it.z);
  if (d <= it.radius) { performInteraction(id); return; }
  // F15: walking up to BAYBAY or a resident stops 1.8u short (never into them)
  if (it.source === 'baybay' || it.source === 'npc') {
    const k = Math.max(0, d - 1.8) / d;
    walkTo({ x: p.x + (it.x - p.x) * k, z: p.z + (it.z - p.z) * k }, id);
  } else walkTo(it, id);
}

let hovered: string | null = null;
function setHover(id: string | null) {
  if (hovered === id) return;
  hovered = id;
  game.set({ hover: id });
  document.body.style.cursor = id ? 'pointer' : '';
  if (id) emit({ type: 'ui', action: 'hover' });
}

function Proxies({ list }: { list: Interactable[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const baybay = useRef<THREE.Mesh>(null);
  const hits = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    for (const it of list) {
      // (moving things have no fixed click proxy: BAYBAY has her own below; parked bikes / the toy car are boarded with F / E)
      if (it.source === 'baybay' || it.id === JOGGER_ID || it.source === 'vehicle') continue;
      out.push({ id: it.id, x: it.x, y: heightAt(it.x, it.z) + 1.1, z: it.z, r: Math.min(2.2, Math.max(1.1, it.radius * 0.45)), card: it.source === 'postcard' ? postcardIdOf(it) : undefined });
      const landmark = it.poi?.landmarkId ? DISTRICT.landmarks.find(item => item.id === it.poi?.landmarkId) : undefined;
      if (landmark) {
        const scale = Math.min(2, Math.max(0.6, landmark.scale || 1));
        out.push({ id: it.id, x: landmark.position.x, y: (landmark.baseY ?? heightAt(landmark.position.x, landmark.position.z)) + 4 * scale, z: landmark.position.z, r: 3.4 * scale });
      }
    }
    return out;
  }, [list]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const apply = () => {
      const collected = game.get().postcards;
      hits.forEach((hit, i) => {
        const hidden = !!hit.card && collected.includes(hit.card);
        tmpMatrix.compose(tmpVec.set(hit.x, hit.y, hit.z), tmpQuat.identity(), tmpScale.setScalar(hidden ? 0.0001 : hit.r));
        m.setMatrixAt(i, tmpMatrix);
      });
      m.count = hits.length;
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    };
    apply();
    let last = game.get().postcards;
    return game.subscribe(() => { const now = game.get().postcards; if (now !== last) { last = now; apply(); } });
  }, [hits]);

  useFrame(() => {
    const b = baybay.current;
    if (!b) return;
    b.position.set(runtime.guide.x, runtime.guide.y + 0.8, runtime.guide.z);
  });

  const idOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId !== undefined ? hits[e.instanceId]?.id ?? null : null);
  useEffect(() => () => { setHover(null); }, []);

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[hitGeometry, hitMaterial, Math.max(1, hits.length)]}
        frustumCulled={false}
        onPointerMove={e => { const id = idOf(e); if (!id) return; e.stopPropagation(); setHover(id); }}
        onPointerOut={() => setHover(null)}
        onClick={e => { const id = idOf(e); if (!id) return; e.stopPropagation(); if (e.delta > 8) return; activate(id); }}
      />
      <mesh
        ref={baybay}
        geometry={hitGeometry}
        material={hitMaterial}
        scale={1.1}
        onPointerMove={e => { e.stopPropagation(); setHover(BAYBAY_ID); }}
        onPointerOut={() => setHover(null)}
        onClick={e => { e.stopPropagation(); if (e.delta > 8) return; activate(BAYBAY_ID); }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Gold focus marker (one ring + one chevron, shared)
// ---------------------------------------------------------------------------

const GOLD = new THREE.Color('#e0a94a');

function FocusMarker() {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const chevron = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  // F7: a calm signal — slim ring, faint glow, small chevron just above the thing (it must not dominate the frame)
  const materials = useMemo(() => ({
    ring: new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color('#f6c86a'), transparent: true, opacity: 0.1, depthWrite: false, toneMapped: false }),
    chevron: new THREE.MeshBasicMaterial({ color: new THREE.Color('#f3c15f'), toneMapped: false, transparent: true }),
  }), []);
  const geometries = useMemo(() => ({
    ring: new THREE.RingGeometry(1, 1.07, 48).rotateX(-Math.PI / 2),
    glow: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    chevron: new THREE.ConeGeometry(0.17, 0.3, 4).rotateX(Math.PI),
  }), []);
  useEffect(() => () => { Object.values(materials).forEach(m => m.dispose()); Object.values(geometries).forEach(g => g.dispose()); }, [materials, geometries]);
  const pos = useRef(new THREE.Vector3());
  const shown = useRef(0);
  const top = useRef(1.9);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const s = game.get();
    const f = flow.get();
    let id = s.photoMode || f.cinematic ? null : s.hover ?? s.focus;
    // phones: the bottom bar's 问 BAYBAY covers her, so no ring around BAYBAY unless she is calling you
    if (id === BAYBAY_ID && !s.hover && runtime.input.device === 'touch' && !f.callPending && !(f.bubble?.who === BAYBAY_ID && f.bubble.tone === 'call')) id = null;
    const it = id ? interactableById(id) : undefined;
    const target = shown.current;
    shown.current += ((it ? 1 : 0) - target) * Math.min(1, dt * 10);
    if (shown.current < 0.02) { g.visible = false; return; }
    g.visible = true;
    if (it) {
      const y = it.source === 'baybay' ? runtime.guide.y : heightAt(it.x, it.z);
      const r = it.source === 'baybay' ? 1 : Math.min(1.5, Math.max(0.9, it.radius * 0.45));
      const want = tmpVec.set(it.x, y + 0.07, it.z);
      if (pos.current.distanceToSquared(want) > 16) pos.current.copy(want); else pos.current.lerp(want, Math.min(1, dt * 14));
      g.scale.setScalar(r * (0.85 + 0.15 * shown.current));
      top.current = it.source === 'baybay' ? BAYBAY_HEAD_Y + 0.3 : it.source === 'postcard' ? 1.95 : it.source === 'npc' ? 2.1 : 1.9;
    }
    g.position.copy(pos.current);
    const t = clock.elapsedTime;
    const focused = !!it && s.focus === id;
    const night = s.timeOfDay === 'night' ? 0.8 : 1;
    if (ring.current) {
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (focused ? 0.75 : 0.35) * shown.current * night;
      ring.current.scale.setScalar(1 + 0.04 * Math.sin(t * 3.2));
    }
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = (focused ? 0.1 : 0.05) * shown.current * night * (0.8 + 0.2 * Math.sin(t * 4));
    if (chevron.current) {
      chevron.current.visible = focused;
      (chevron.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * night;
      // bob just above the thing's top (the group is scaled by the ring radius)
      chevron.current.position.y = (top.current + 0.25 + 0.12 * Math.sin(t * 3)) / Math.max(0.5, g.scale.x);
      chevron.current.scale.setScalar(1 / Math.max(0.5, g.scale.x));
      chevron.current.rotation.y = t * 1.8;
    }
  });
  return (
    <group ref={group} visible={false} renderOrder={5}>
      <mesh ref={ring} geometry={geometries.ring} material={materials.ring} renderOrder={5} />
      <mesh ref={glow} geometry={geometries.glow} material={materials.glow} renderOrder={4} />
      <mesh ref={chevron} geometry={geometries.chevron} material={materials.chevron} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Postcard collectibles: floating gold cards + ground glow (2 instanced draws)
// ---------------------------------------------------------------------------

/** A tiny illustrated postcard face: cream card, gold frame, teal stamp, writing lines. */
function postcardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 88;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e0a94a';
  ctx.fillRect(0, 0, 128, 88);
  ctx.fillStyle = '#fffaf1';
  ctx.fillRect(7, 7, 114, 74);
  ctx.fillStyle = '#2f8f88';
  ctx.fillRect(92, 14, 20, 24);
  ctx.fillStyle = '#fffaf1';
  ctx.fillRect(95, 17, 14, 18);
  ctx.fillStyle = '#d8744a';
  ctx.beginPath(); ctx.arc(102, 26, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(47,143,136,.55)';
  ctx.lineWidth = 3;
  for (const y of [48, 60, 72]) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(80, y); ctx.stroke(); }
  ctx.fillStyle = '#e0a94a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('SF', 18, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function radialTexture(inner: string, outer: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function PostcardGlints({ list }: { list: Interactable[] }) {
  const cards = useRef<THREE.InstancedMesh>(null);
  const glows = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => list.filter(it => it.source === 'postcard').map(it => ({ id: postcardIdOf(it), x: it.x, z: it.z, y: heightAt(it.x, it.z) })), [list]);
  const assets = useMemo(() => {
    const glowTexture = radialTexture('rgba(246,196,96,0.9)', 'rgba(246,196,96,0)');
    const cardTexture = postcardTexture();
    return {
      cardGeometry: new THREE.BoxGeometry(0.78, 0.54, 0.04),
      cardMaterial: new THREE.MeshStandardMaterial({ map: cardTexture, emissive: new THREE.Color('#e0a94a'), emissiveMap: cardTexture, emissiveIntensity: 0.45, roughness: 0.55, metalness: 0 }),
      cardTexture,
      glowGeometry: new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2),
      glowMaterial: new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.75 }),
      glowTexture,
    };
  }, []);
  useEffect(() => () => { assets.cardGeometry.dispose(); assets.cardMaterial.dispose(); assets.cardTexture.dispose(); assets.glowGeometry.dispose(); assets.glowMaterial.dispose(); assets.glowTexture.dispose(); }, [assets]);
  const euler = useMemo(() => new THREE.Euler(), []);

  useFrame(({ clock }) => {
    const c = cards.current, g = glows.current;
    if (!c || !g || !items.length) return;
    const collected = game.get().postcards;
    const fly = flow.get().postcardFly;
    const t = clock.elapsedTime;
    items.forEach((item, i) => {
      // F12: the card you just picked up flies into your hands (0.35 s ease-in, two spins) before the reward opens
      const flying = !!fly && fly.id === item.id;
      const k = flying ? Math.min(1, (performance.now() - fly!.at) / 350) : 0;
      const e = k * k;
      const hidden = collected.includes(item.id) && (!flying || k >= 1);
      const s = hidden ? 0.0001 : 1 - 0.35 * e;
      euler.set(0.18 * Math.sin(t * 1.3 + i), t * 1.5 + i * 1.7 + e * Math.PI * 4, 0.1 * Math.sin(t * 0.9 + i));
      tmpQuat.setFromEuler(euler);
      const hover = item.y + 1.15 + 0.16 * Math.sin(t * 2.2 + i);
      if (flying) {
        const p = runtime.player;
        tmpVec.set(item.x + (p.x - item.x) * e, hover + (p.y + 1.1 - hover) * e, item.z + (p.z - item.z) * e);
      } else tmpVec.set(item.x, hover, item.z);
      tmpMatrix.compose(tmpVec, tmpQuat, tmpScale.setScalar(s));
      c.setMatrixAt(i, tmpMatrix);
      tmpMatrix.compose(tmpVec.set(item.x, item.y + 0.05, item.z), tmpQuat.identity(), tmpScale.setScalar(hidden || flying ? 0.0001 : 0.85 + 0.15 * Math.sin(t * 2.6 + i)));
      g.setMatrixAt(i, tmpMatrix);
    });
    c.instanceMatrix.needsUpdate = true;
    g.instanceMatrix.needsUpdate = true;
  });
  if (!items.length) return null;
  return (
    <>
      <instancedMesh ref={cards} args={[assets.cardGeometry, assets.cardMaterial, items.length]} frustumCulled={false} castShadow={false} />
      <instancedMesh ref={glows} args={[assets.glowGeometry, assets.glowMaterial, items.length]} frustumCulled={false} renderOrder={3} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Objective beacon: a soft gold light column at the next destination
// ---------------------------------------------------------------------------

function Beacon() {
  const mesh = useRef<THREE.Mesh>(null);
  const assets = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, 'rgba(246,196,96,0)');
    gradient.addColorStop(0.6, 'rgba(246,196,96,0.32)');
    gradient.addColorStop(1, 'rgba(236,176,70,0.7)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return {
      texture,
      geometry: new THREE.CylinderGeometry(0.75, 0.95, 18, 20, 1, true).translate(0, 9, 0),
      material: new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    };
  }, []);
  useEffect(() => () => { assets.texture.dispose(); assets.geometry.dispose(); assets.material.dispose(); }, [assets]);
  const fade = useRef(0);
  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const found = game.get().photoMode ? null : objectiveTarget();
    const target = found?.soft ? null : found; // soft free-roam hints get no light column
    const far = target ? Math.hypot(target.x - runtime.player.x, target.z - runtime.player.z) > 7 : false;
    fade.current += ((far ? 1 : 0) - fade.current) * Math.min(1, dt * 4);
    m.visible = fade.current > 0.02;
    if (!m.visible || !target) return;
    m.position.set(target.x, heightAt(target.x, target.z), target.z);
    (m.material as THREE.MeshBasicMaterial).opacity = fade.current * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 2.4));
  });
  return <mesh ref={mesh} geometry={assets.geometry} material={assets.material} visible={false} renderOrder={2} />;
}

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------

const projected = new THREE.Vector3();
const lastWrites = new WeakMap<HTMLElement, string>();
function writeTransform(el: HTMLElement, value: string) {
  if (lastWrites.get(el) === value) return;
  lastWrites.set(el, value);
  el.style.transform = value;
}

function Ticker() {
  const gl = useThree(s => s.gl);
  const camera = useThree(s => s.camera);
  const scene = useThree(s => s.scene);
  const clock = useRef({ tenHz: 0, frames: 0, fpsAt: 0, objects: 0, objectsAt: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now();
    const c = clock.current;
    runtime.time += dt;

    stepCinema(dt);

    const ride = stepRide(dt);
    if (ride) {
      const current = flow.get().ride;
      if (current && (current.stage !== ride.stage || current.eta !== ride.eta)) flow.set({ ride: { ...current, stage: ride.stage, eta: ride.eta } });
      if (ride.done) finishRide();
    }

    // input edges mirrored by actors (E/Enter/gamepad A, Q/gamepad X)
    if (runtime.input.interact) { runtime.input.interact = false; if (!isTypingTarget()) requestInteract('runtime'); }
    if (runtime.input.call) { runtime.input.call = false; callBaybay(); }

    c.tenHz += dt;
    if (c.tenHz >= 0.1) { c.tenHz = 0; updateFocus(); updateGuide(now); }

    project(camera, gl.domElement, now);
    consumeShutter(gl.domElement);

    if (domAnchors.debug) {
      if (!c.fpsAt) c.fpsAt = now;
      c.frames++;
      if (now - c.fpsAt >= 500) {
        const fps = (c.frames * 1000) / (now - c.fpsAt);
        c.frames = 0; c.fpsAt = now;
        runtime.perf.fps = fps;
        if (now - c.objectsAt > 2000) { let n = 0; scene.traverse(() => { n++; }); c.objects = n; c.objectsAt = now; }
        const info = gl.info;
        const s = game.get();
        domAnchors.debug.textContent = `${fps.toFixed(0)} fps · ${info.render.calls} calls · ${(info.render.triangles / 1000).toFixed(1)}k tris · ${c.objects} obj · ${info.memory.geometries} geo · ${info.memory.textures} tex · ${info.programs?.length ?? 0} prog\n`
          + `player ${runtime.player.x.toFixed(1)}, ${runtime.player.z.toFixed(1)} · guide ${runtime.guide.state}${runtime.guide.target ? '→' : ''} · focus ${s.focus ?? '-'} · ${s.mode}/${flow.get().tourPhase}/${flow.get().weekStage} · tier ${runtime.perf.tier}`;
      }
    }
  });
  return null;
}

const isTypingTarget = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable || (el.tagName === 'BUTTON' && !!el.closest('.ob-overlay')) || (el.tagName === 'A' && !!el.closest('.ob-overlay')));
};

let waypointTextAt = 0;
let bubbleBoxKey = -1;
const bubbleBox = { w: 250, h: 48 };
let labelHalf = 60;
const focusProj = new THREE.Vector3();
function project(camera: THREE.Camera, canvas: HTMLCanvasElement, now: number) {
  const fullW = canvas.clientWidth, h = canvas.clientHeight;
  // an open side sheet covers the right edge: keep bubbles and the waypoint in the visible part
  const w = Math.max(240, fullW - overlayInsets.right);
  const mobile = fullW <= 720;
  // the top HUD row (place name, objective pill) ends here; nothing projected may slide under it
  const topRow = mobile ? 58 : 70;
  // speech bubble over BAYBAY (or an NPC)
  const bubbleEl = domAnchors.bubble;
  if (bubbleEl) {
    const who = flow.get().bubble?.who;
    let wx = runtime.guide.x, wy = runtime.guide.y + BAYBAY_HEAD_Y + 0.25, wz = runtime.guide.z;
    if (who && who !== BAYBAY_ID) { const it = interactableById(who); if (it) { wx = it.x; wz = it.z; wy = heightAt(it.x, it.z) + 2.4; } }
    projected.set(wx, wy, wz).project(camera);
    const rawX = (projected.x + 1) / 2 * fullW, rawY = (1 - projected.y) / 2 * h;
    // measure each new bubble once (a layout read per bubble, not a forced layout every few frames)
    const key = flow.get().bubble?.key ?? -1;
    if (key !== bubbleBoxKey) {
      const inner = bubbleEl.firstElementChild as HTMLElement | null;
      if (inner && inner.offsetWidth) { bubbleBox.w = inner.offsetWidth; bubbleBox.h = inner.offsetHeight || bubbleBox.h; bubbleBoxKey = key; }
    }
    const offscreen = projected.z > 1 || rawX < 40 || rawX > w - 40 || rawY < 60 || rawY > h - 20;
    // (w already excludes an open side sheet, so "under the sheet" counts as off-screen)
    const docked = offscreen ? '1' : '0';
    if (bubbleEl.dataset.docked !== docked) bubbleEl.dataset.docked = docked;
    const minY = topRow + 10 + bubbleBox.h + 10; // the bubble sits above its anchor point
    if (offscreen) {
      // BAYBAY is off-screen: dock the bubble next to the "ask BAYBAY" button (phones: under the top row).
      const dockX = w - (overlayInsets.right ? 250 : 190);
      writeTransform(bubbleEl, mobile ? `translate3d(${(w / 2).toFixed(0)}px, ${Math.max(minY, h * 0.2).toFixed(0)}px, 0)` : `translate3d(${dockX.toFixed(0)}px, ${(h - 104).toFixed(0)}px, 0)`);
    } else {
      const half = bubbleBox.w / 2 + 8; // keep the whole bubble on screen
      let x = rawX;
      // F7: a focus ring close under the bubble — lean the bubble away from it so it never covers the target
      const s = game.get();
      const it = who === BAYBAY_ID && s.focus && s.focus !== BAYBAY_ID ? interactableById(s.focus) : undefined;
      if (it) {
        focusProj.set(it.x, heightAt(it.x, it.z) + 0.5, it.z).project(camera);
        const fx = (focusProj.x + 1) / 2 * fullW, fy = (1 - focusProj.y) / 2 * h;
        if (Math.abs(fx - rawX) < half + 40 && fy > rawY - bubbleBox.h - 20 && fy < rawY + 160) x = fx < rawX ? Math.max(rawX, fx + half + 36) : Math.min(rawX, fx - half - 36);
      }
      x = Math.min(w - half, Math.max(half, x));
      const y = Math.min(h - 60, Math.max(minY, rawY));
      writeTransform(bubbleEl, `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`);
    }
  }
  // touch onboarding: tap marker on the ground between the player and BAYBAY
  const tap = domAnchors.tapHint;
  if (tap && tap.dataset.show === '1') {
    const p = runtime.player, g = runtime.guide;
    const mx = p.x + (g.x - p.x) * 0.55, mz = p.z + (g.z - p.z) * 0.55;
    projected.set(mx, heightAt(mx, mz) + 0.05, mz).project(camera);
    writeTransform(tap, `translate3d(${((projected.x + 1) / 2 * fullW).toFixed(1)}px, ${((1 - projected.y) / 2 * h).toFixed(1)}px, 0)`);
  }
  // fishing: "!" over the player's head at the bite
  const alertEl = domAnchors.alert;
  if (alertEl && alertEl.dataset.show === '1') {
    projected.set(runtime.player.x, runtime.player.y + PLAYER_HEAD_Y, runtime.player.z).project(camera);
    writeTransform(alertEl, `translate3d(${((projected.x + 1) / 2 * fullW).toFixed(1)}px, ${((1 - projected.y) / 2 * h).toFixed(1)}px, 0)`);
  }
  // objective waypoint (edge arrow when off-screen)
  const wp = domAnchors.waypoint;
  if (wp) {
    const target = game.get().photoMode || flow.get().cinematic || game.get().dialogue.nodeId ? null : objectiveTarget();
    const d = target ? Math.hypot(target.x - runtime.player.x, target.z - runtime.player.z) : 0;
    if (!target || d < 6) { if (wp.dataset.show !== '0') wp.dataset.show = '0'; return; }
    if (wp.dataset.show !== '1') wp.dataset.show = '1';
    const soft = target.soft ? '1' : '0';
    if (wp.dataset.soft !== soft) wp.dataset.soft = soft;
    projected.set(target.x, heightAt(target.x, target.z) + 3.2, target.z).project(camera);
    let nx = projected.x, ny = projected.y;
    const behind = projected.z > 1;
    if (behind) { nx = -nx; ny = -ny; }
    // screen px on the full canvas, then keep it inside the visible part (left of an open side sheet)
    let x = (nx + 1) / 2 * fullW, y = (1 - ny) / 2 * h;
    const padX = Math.max(40, w * 0.07), padY = Math.max(56, h * 0.07);
    const cx = w / 2, cy = h / 2;
    const off = behind || x < padX || x > w - padX || y < padY || y > h - padY;
    if (off) {
      const dx = x - cx || 1e-3, dy = y - cy || 1e-3;
      const k = Math.min((cx - padX) / Math.abs(dx), (cy - padY) / Math.abs(dy));
      x = cx + dx * k; y = cy + dy * k;
    }
    const angle = Math.atan2(y - cy, x - cx);
    // keep the pin + label clear of the top HUD row (place name, objective pill)
    y = Math.max(y, Math.max(topRow + 26, h * 0.1));
    writeTransform(wp, `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`);
    // the label is centred under the pin: slide it (not the pin) so it stays inside the screen
    const margin = 10;
    const shift = Math.max(0, margin + labelHalf - x) + Math.min(0, w - margin - labelHalf - x);
    const dx = `${shift.toFixed(0)}px`;
    if (wp.style.getPropertyValue('--ob-label-dx') !== dx) wp.style.setProperty('--ob-label-dx', dx);
    const edge = off ? '1' : '0';
    if (wp.dataset.edge !== edge) wp.dataset.edge = edge;
    wp.style.setProperty('--ob-angle', `${angle.toFixed(3)}rad`);
    if (domAnchors.waypointLabel && now - waypointTextAt > 250) {
      waypointTextAt = now;
      // F8: how long the walk takes in the game ("约 8 秒"), not map metres (the district is compressed)
      const locale = getLocale();
      const text = `${pick(target.name, locale)} · ${pick(gameTimeLabel(d), locale)}`;
      if (domAnchors.waypointLabel.textContent !== text) { domAnchors.waypointLabel.textContent = text; labelHalf = (domAnchors.waypointLabel.offsetWidth || 120) / 2; wp.style.setProperty("--ob-label-half", `${labelHalf.toFixed(0)}px`); }
    }
  }
}

// ---------------------------------------------------------------------------
// QA bridge: ?at=<anchor>, window.__opusBay (DEV)
// ---------------------------------------------------------------------------

function QaBridge() {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    const qa = readQa();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let unsub = () => {};
    if (qa.at) {
      const at = DISTRICT.anchors?.[qa.at] ?? interactableById(qa.at);
      if (at) {
        for (const ms of [50, 400, 1000]) timers.push(setTimeout(() => teleportPlayer({ x: at.x, z: at.z }), ms));
        // slow loads: the start flow can re-place the player after those; apply once more when play begins
        let placed = game.get().phase === 'playing';
        unsub = game.subscribe(() => {
          if (placed || game.get().phase !== 'playing') return;
          placed = true;
          timers.push(setTimeout(() => teleportPlayer({ x: at.x, z: at.z }), 50));
        });
      }
    }
    return () => { timers.forEach(clearTimeout); unsub(); };
  }, []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    const mine = { game, runtime, emit, district: DISTRICT, flow, actions: flowActions, cinema: { currentFraming, measureBottomCover } };
    w.__opusBay = { ...(w.__opusBay ?? {}), ...mine, renderer: (w.__opusBay?.renderer as unknown) ?? gl };
    // other modules re-publish the object on their own schedules: keep the flow hooks on it (QA scripts rely on them)
    const id = window.setInterval(() => { const o = w.__opusBay; if (o && o.actions !== flowActions) Object.assign(o, mine); }, 500);
    return () => window.clearInterval(id);
  }, [gl]);
  return null;
}
