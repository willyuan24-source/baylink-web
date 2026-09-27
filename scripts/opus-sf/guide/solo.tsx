/**
 * Lane G (wave 4) QA harness for the guidance pieces before they are wired into the game (early phase: new files only).
 * Dev server only: http://localhost:5304/scripts/opus-sf/guide/solo.html?view=…
 *
 *   view=hud    the phone / desktop HUD with the real CSS (opus-bay.css + guide-ui.css) and mock game pills: the trip
 *               pill, the ride banner + arrival toast in the top stack, the arrival card, the docked bubble, the phone
 *               bar, the touch action, the 跳 column, a waypoint laid out by game/waypoint.ts; &card=1 the trip card,
 *               &pano=1 panorama tags, &ride=0 no ride banner, &wp=x,y target (px) for the waypoint, &quiet=1.
 *               window.__guideQa = { overlaps: [...pairs], boxes } (the no-overlap rules of plan §4.2)
 *   view=flags  a plain three.js scene with the real FlagLayer (world/sf/flags.ts): T1 flags at 220–1550 u and a gold
 *               target at 2,400 u; &t=seconds freezes the wave. window.__flagQa = { programs / calls with and without }
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { BookOpen, Ellipsis, Map as MapIcon, MapPin, Bus, ArrowBigUp } from 'lucide-react';
import '../../../src/opus-bay/opus-bay.css';
import { type FlagPick, type FlagSource, layoutPanoramaTags, pickFlags, pickPanoramaTags, tagWidth } from '../../../src/opus-bay/game/flags';
import { type TripLineInfo, planTrips } from '../../../src/opus-bay/game/tripPlan';
import type { TripState } from '../../../src/opus-bay/game/tripTypes';
import { placeBubble } from '../../../src/opus-bay/game/hudLayout';
import { layoutWaypoint, waypointSafeArea } from '../../../src/opus-bay/game/waypoint';
import { ArrivalCard, ArrivalToast } from '../../../src/opus-bay/ui/ArrivalCard';
import { tripPillText } from '../../../src/opus-bay/ui/guideText';
import { PanoramaTags } from '../../../src/opus-bay/ui/PanoramaTags';
import { placePanoramaTags } from '../../../src/opus-bay/ui/panoramaPlace';
import { TripCard, TripPill } from '../../../src/opus-bay/ui/TripPill';
import { FlagLayer, flagScaleDistance } from '../../../src/opus-bay/world/sf/flags';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'hud';

// ---------------------------------------------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------------------------------------------

const N: TripLineInfo = {
  id: 'n-judah', kind: 'light-rail', name: { zh: 'N 线', en: 'N Judah' }, short: 'N', length: 1580, tunnels: [{ fromAt: 0, toAt: 516 }],
  stops: [
    { id: 'embarcadero', at: 0, x: 131, z: 79, name: { zh: '内河码头站', en: 'Embarcadero' }, major: true },
    { id: 'carl-cole', at: 804, x: -20, z: 834, name: { zh: '海特区', en: 'Carl & Cole' }, major: true },
    { id: 'irving-9th', at: 1022, x: -133.5, z: 1006, name: { zh: '金门公园', en: '9th Ave & Irving' }, major: true },
    { id: 'la-playa', at: 1568, x: -465, z: 1417, name: { zh: '海洋海滩', en: 'Judah & La Playa' }, major: true },
  ],
};
const lines = new Map([[N.id, N]]);
const option = planTrips({ x: -30, z: 820 }, { placeId: 'ocean-beach', x: -480, z: 1440, name: { zh: '海洋海滩', en: 'Ocean Beach' } }, {
  lines: () => [N], walk: (a, b) => ({ length: Math.hypot(b.x - a.x, b.z - a.z) * 1.3 }),
}).find(o => o.mode === 'line')!;
const trip: TripState = { placeId: 'ocean-beach', option, legs: option.legs, leg: 1, startedAt: 0 };

type Rect = { l: number; t: number; r: number; b: number };
const rectOf = (el: Element): Rect => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
const hit = (a: Rect, b: Rect) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;

function Hud() {
  const w = window.innerWidth, h = window.innerHeight;
  const phone = w <= 720;
  const [card, setCard] = useState(q.get('card') === '1');
  const pano = q.get('pano') === '1';
  const ride = q.get('ride') !== '0';
  const quiet = q.get('quiet') === '1';
  const wpRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<HTMLDivElement | null>(null);
  const text = tripPillText(trip, 118, { lines, compact: phone, phase: 'riding' });
  // BAYBAY's docked bubble (Systems.tsx: phones x = w/2, anchor y = max(minY, 0.2 h); desktop right side, y = h − 104)
  const bw = phone ? 250 : 280, bh = 48;
  const bx = phone ? w / 2 : w - 190, by0 = phone ? Math.max(58 + 10 + bh + 10, h * 0.2) : h - 104;
  const bubbleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // the waypoint, laid out by game/waypoint.ts against the fixed HUD boxes measured here
    const fixed = [...document.querySelectorAll('.ob-hud > *, .ob-topstack > *, .ob-arrival-card, .ob-move-buttons')].map(rectOf).filter(r => r.r - r.l > 2);
    // the bubble as the game places it (game/hudLayout placeBubble: below a top box, above a bottom one)
    const bp = placeBubble(bx, by0, bw, bh, fixed, h, 58 + 10 + bh + 10, h - 60);
    bubbleRef.current!.style.transform = `translate3d(${bp.x}px, ${bp.y}px, 0)`;
    const bubble: Rect = { l: bp.x - bw / 2, t: bp.y - 10 - bh, r: bp.x + bw / 2, b: bp.y - 10 };
    const [tx, ty] = (q.get('wp') ?? `${w * 0.62},${h * 0.5}`).split(',').map(Number);
    const L = layoutWaypoint({ x: tx, y: ty, behind: false, area: waypointSafeArea({ w, h, phone }), labelW: 150, bubble, boxes: fixed });
    const el = wpRef.current!;
    el.dataset.show = L.hidden ? '0' : '1';
    el.dataset.edge = L.edge ? '1' : '0';
    el.dataset.label = L.label.mode;
    el.style.transform = `translate3d(${L.x}px, ${L.y}px, 0)`;
    el.style.setProperty('--ob-angle', `${L.angle}rad`);
    const label = el.querySelector<HTMLElement>('.ob-waypoint-label')!;
    label.textContent = L.label.mode === 'short' ? '约 2 分钟' : '海洋海滩 · 约 2 分钟';
    if (L.label.box) label.style.setProperty('left', `${(L.label.box.l + L.label.box.r) / 2 - L.x}px`);
    if (L.label.box) label.style.setProperty('top', `${L.label.box.t - L.y}px`);
    // panorama tags: fake anchors across the upper half
    if (pano && panoRef.current) {
      const tags = PANO_TAGS;
      const inputs = tags.map((t, i) => ({ id: t.id, x: w * (0.12 + 0.11 * i), y: h * (0.34 + 0.03 * (i % 3)), w: tagWidth(t.name.zh), h: 26, rank: t.rank }));
      const placed = layoutPanoramaTags(inputs, { l: 12, t: phone ? 72 : 80, r: w - 12, b: h - (phone ? 124 : 120) }, [...fixed, bubble]);
      placePanoramaTags(panoRef.current, placed, new Map(inputs.map(p => [p.id, { x: p.x, y: p.y }])));
    }
    // the no-overlap check (plan §4.2): every pair of these must be disjoint (read once the entrances have settled)
    window.setTimeout(() => check(L, el, label), 900);
  });

  const check = (L: ReturnType<typeof layoutWaypoint>, el: HTMLElement, label: HTMLElement) => {
    // the game re-reads the HUD boxes once their entrance animations settle (hudLayout SETTLE_MS): place the bubble again
    const settled = [...document.querySelectorAll('.ob-hud > *, .ob-topstack > *, .ob-arrival-card, .ob-move-buttons')].map(rectOf).filter(r => r.r - r.l > 2);
    // (measured like Systems.tsx does: the bubble's own size, a 2-line bubble is taller than 48 px)
    const inner = bubbleRef.current!.firstElementChild as HTMLElement;
    const mw = inner.offsetWidth || bw, mh = inner.offsetHeight || bh;
    const bp = placeBubble(bx, by0, mw, mh, settled, h, 58 + 10 + mh + 10, h - 60);
    bubbleRef.current!.style.transform = `translate3d(${bp.x}px, ${bp.y}px, 0)`;
    const named: [string, Element | null][] = [
      ['area', document.querySelector('.ob-area')], ['trip-pill', document.querySelector('.ob-trip-pill')],
      ['ride', document.querySelector('.ob-ride')], ['arrival-toast', document.querySelector('.ob-arrival-toast')],
      ['arrival-card', document.querySelector('.ob-arrival-card')], ['bar', document.querySelector('.ob-bar')],
      ['touch-action', document.querySelector('.ob-touch-action')], ['hop', document.querySelector('.ob-move-buttons')],
      ['bubble', document.querySelector('.ob-bubble')], ['waypoint-pin', L.hidden ? null : el.querySelector(L.edge ? '.ob-waypoint-arrow' : '.ob-waypoint-pin')],
      ['waypoint-label', L.hidden || L.label.mode === 'none' ? null : label], ['hud-buttons', document.querySelector('.ob-hud-buttons')],
      ...[...document.querySelectorAll('.ob-pano-tag[data-show="1"]')].map((e, i): [string, Element] => [`tag-${i}`, e]),
    ];
    const boxes = named.filter(([, e]) => !!e).map(([n, e]) => ({ n, ...rectOf(e!) }));
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (!(boxes[i].n.startsWith('waypoint') && boxes[j].n.startsWith('waypoint')) && hit(boxes[i], boxes[j])) overlaps.push(`${boxes[i].n} × ${boxes[j].n}`);
    (window as unknown as { __guideQa: unknown }).__guideQa = { w, h, overlaps, waypoint: { mode: L.label.mode, edge: L.edge, hidden: L.hidden }, boxes };
    console.log('guideQa', JSON.stringify({ w, h, overlaps }));
  };

  return (
    <div className="ob-page">
      <div className="ob-root" style={{ background: 'linear-gradient(180deg, #bcd9e6 0%, #e9dcc0 46%, #cdb68e 47%, #b99c72 100%)' }}>
        <div className={`ob-overlay ${card && phone ? 'has-panel' : ''}`}>
          <div ref={wpRef} className="ob-waypoint" data-show="0">
            <span className="ob-waypoint-arrow"><MapPin size={16} /></span>
            <span className="ob-waypoint-pin" />
            <span className="ob-waypoint-label" />
          </div>
          {pano && <PanoramaTags tags={PANO_TAGS} onPick={id => console.log('pick', id)} register={el => { panoRef.current = el; }} />}
          <div ref={bubbleRef} className="ob-bubble-anchor" data-docked="1">
            <div className="ob-bubble is-baybay" style={{ width: bw - 24, boxSizing: 'border-box' }}>
              <span>下一站就是金门公园，左手边是加州科学院～</span>
            </div>
          </div>
          <div className={`ob-hud ${phone ? 'is-narrow' : ''}`}>
            <div className="ob-area ob-area-city has-street">
              <MapPin size={15} aria-hidden />
              <span className="ob-area-lines">
                <span className="ob-area-top"><span className="ob-area-name">内日落区</span><span className="ob-area-en">Inner Sunset</span></span>
                <span className="ob-area-street">Irving St</span>
              </span>
            </div>
            <TripPill text={text} dots={{ done: 1, now: 1, total: 3 }} onOpen={() => setCard(c => !c)} open={card} />
            {phone ? (
              <nav className="ob-bar">
                <button type="button" className="ob-bar-btn is-baybay"><span className="ob-face" style={{ width: 28, height: 28, borderRadius: '50%', background: '#2f8f88', display: 'block' }} /><span>问 BAYBAY</span></button>
                <button type="button" className="ob-bar-btn"><MapIcon size={20} /><span>地图</span></button>
                <button type="button" className="ob-bar-btn"><BookOpen size={20} /><span>旅行本</span></button>
                <button type="button" className="ob-bar-btn"><Ellipsis size={20} /><span>更多</span></button>
              </nav>
            ) : (
              <nav className="ob-hud-buttons">{[0, 1, 2, 3, 4].map(i => <button key={i} type="button" className="ob-round" />)}</nav>
            )}
            {phone && <button type="button" className="ob-touch-action"><Bus size={28} /><span>上观光巴士</span></button>}
          </div>
          {phone && (
            <div className="ob-move-buttons" style={{ position: 'absolute', right: 'calc(18px + var(--ob-sr))', bottom: 'calc(150px + var(--ob-sb))', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" className="ob-hop" style={{ width: 56, height: 56, borderRadius: '50%', background: '#fffaf1', border: '1px solid #e7dccb', display: 'grid', placeItems: 'center' }}><ArrowBigUp size={22} /></button>
            </div>
          )}
          <ArrivalCard arrival={{ place: 'cal-academy', name: { zh: '加州科学院', en: 'California Academy of Sciences' }, tier: 1, quiet, next: { zh: '日本茶园', en: 'Japanese Tea Garden' }, color: '#8a5a9c' }} ms={600000} onInfo={() => {}} onPhoto={() => {}} onNext={() => {}} onClose={() => {}} />
          {card && <TripCard trip={trip} lines={lines} title={{ zh: '去海洋海滩', en: 'To Ocean Beach' }} left={{ zh: '还要约 2 分钟', en: '~2 min to go' }} onSkip={() => {}} onChange={() => {}} onEnd={() => {}} onClose={() => setCard(false)} />}
          <div className="ob-topstack">
            {ride && (
              <div className="ob-ride" role="status">
                <Bus size={20} aria-hidden /><span>N 线 · 开往 海洋海滩 · 下一站 <strong>9th & Irving</strong></span>
                <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm">下一站下车</button>
                <button type="button" className="ob-btn ob-btn-soft ob-btn-sm">直接到站</button>
              </div>
            )}
            <div className="ob-toasts"><ArrivalToast arrival={{ name: { zh: '加州科学院', en: 'California Academy of Sciences' }, quiet }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PANO_TAGS = pickPanoramaTags({ x: 0, z: 0 }, 0, [
  { id: 'ggb', rank: 1, cat: 'landmark', x: -300, z: -1500, name: { zh: '金门大桥', en: 'Golden Gate Bridge' } },
  { id: 'coit', rank: 1, cat: 'viewpoint', x: 200, z: -1200, name: { zh: '科伊特塔', en: 'Coit Tower' } },
  { id: 'ferry', rank: 1, cat: 'landmark', x: 500, z: -1100, name: { zh: '渡轮大厦', en: 'Ferry Building' } },
  { id: 'city-hall', rank: 1, cat: 'landmark', x: 100, z: -600, name: { zh: '市政厅', en: 'City Hall' } },
  { id: 'sutro', rank: 2, cat: 'landmark', x: -120, z: -200, name: { zh: '苏特罗塔', en: 'Sutro Tower' } },
  { id: 'dolores', rank: 2, cat: 'park', x: 300, z: -350, name: { zh: '多洛雷斯公园', en: 'Dolores Park' } },
  { id: 'castro', rank: 2, cat: 'culture', x: 150, z: -300, name: { zh: '卡斯特罗', en: 'The Castro' }, short: { zh: '卡斯特罗', en: 'Castro' } },
  { id: 'palace', rank: 1, cat: 'landmark', x: -500, z: -1300, name: { zh: '艺术宫', en: 'Palace of Fine Arts' } },
] as FlagSource[]);

// ---------------------------------------------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------------------------------------------

function Flags() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current!;
    const w = window.innerWidth, h = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#bcd9e6');
    scene.fog = new THREE.Fog('#d7e2e0', 300, 2600);
    scene.add(new THREE.HemisphereLight('#fff6e5', '#8a7a60', 1.6));
    const sun = new THREE.DirectionalLight('#fff1d6', 1.4); sun.position.set(-200, 300, 100); scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ color: '#d9c8a4' }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    // toy blocks along the street
    const blockMat = new THREE.MeshLambertMaterial({ color: '#efe3cf' });
    for (let i = 0; i < 60; i++) {
      const s = 8 + (i * 37) % 14, hh = 6 + (i * 53) % 22;
      const b = new THREE.Mesh(new THREE.BoxGeometry(s, hh, s), blockMat);
      const side = i % 2 ? 1 : -1;
      b.position.set(side * (18 + (i * 13) % 30), hh / 2, -40 - i * 28);
      scene.add(b);
    }
    const phone = w <= 720;
    const fov = phone ? 62 : 42;
    const camera = new THREE.PerspectiveCamera(fov, w / h, 0.5, 3000);
    camera.position.set(0, 16, 26);
    camera.lookAt(0, 10, -120);
    const player = { x: 0, z: 0 };
    const yaw = 0;
    const T1: FlagSource[] = [
      { id: 'near', rank: 1, cat: 'landmark', x: -40, z: -220, flag: { x: -40, z: -220, h: 42 } },
      { id: 'museum', rank: 1, cat: 'museum', x: 160, z: -480 },
      { id: 'campus', rank: 1, cat: 'campus', glyph: 'GraduationCap', x: -260, z: -880, flag: { x: -260, z: -880, h: 55 } },
      { id: 'mall', rank: 1, cat: 'shopping', x: 380, z: -1180 },
      { id: 'park', rank: 1, cat: 'park', x: -600, z: -1450, flag: { x: -600, z: -1450, h: 60 } },
      { id: 'coast', rank: 1, cat: 'coast', glyph: 'Sailboat', x: 120, z: -1520 },
    ];
    const max = Number(q.get('max') ?? (phone ? 3 : 6));
    const picks: FlagPick[] = pickFlags({ player, yaw, attractions: T1, discovered: () => false, max, target: q.get('target') === '0' ? null : { x: 60, z: -2400 } });
    const layer = new FlagLayer({ ground: () => 0 });
    // programs / calls without the flags, then with them
    const frozen = q.get('t');
    const t0 = performance.now();
    const time = () => (frozen ? Number(frozen) : (performance.now() - t0) / 1000);
    renderer.render(scene, camera);
    const without = { programs: renderer.info.programs?.length ?? 0, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    scene.add(layer.mesh);
    layer.setPicks(picks, 0);
    let raf = 0, frames = 0;
    const loop = () => {
      layer.update(camera, Math.max(0.5, time()), h);
      renderer.render(scene, camera);
      if (++frames === 3) {
        const withF = { programs: renderer.info.programs?.length ?? 0, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
        const qa = { w, h, fov, picks: picks.map(p => `${p.key}:${p.role}:${Math.round(p.d)}`), scaleDist: flagScaleDistance(h, fov), without, with: withF };
        (window as unknown as { __flagQa: unknown }).__flagQa = qa;
        console.log('flagQa', JSON.stringify(qa));
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); layer.dispose(); renderer.dispose(); host.innerHTML = ''; };
  }, []);
  return <div ref={ref} style={{ position: 'fixed', inset: 0 }} />;
}

createRoot(document.getElementById('root')!).render(view === 'flags' ? <Flags /> : <Hud />);
