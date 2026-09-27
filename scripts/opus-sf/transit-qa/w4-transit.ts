// Wave 4 · lane T: a dev-only QA harness for the new lines (not part of the game; served by the vite dev server at
// /scripts/opus-sf/transit-qa/w4-transit.html). Builds world/sf/lineFleet.ts on the data of transit-w4.json over a plain ground
// and frames one subject for a screenshot; window.__w4 exposes the fleet, the renderer stats and the budget numbers.
//
//   ?view=bus | bus-side | deck | lrv | lrv-cab | kiosk | pole | railstop | portal-<id> | fleet   (subject)
//   ?night=1   ?t=<seconds to simulate first>   ?station=<id> (kiosk / pole / railstop)
import * as THREE from 'three';
import { U } from '../../../src/opus-bay/world/materials';
import { LineFleet } from '../../../src/opus-bay/world/sf/lineFleet';
import { trackPoint } from '../../../src/opus-bay/world/lineTrack';
import type { TransitFile, TransitLine } from '../../../src/opus-bay/world/sf/format';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'bus';
const night = q.get('night') === '1';
const simT = Number(q.get('t') ?? '20');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(night ? '#1b2436' : '#bcd6e6');
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 2000);
const hemi = new THREE.HemisphereLight(night ? '#51607f' : '#fdf3e0', night ? '#1a1c22' : '#8f8a7c', night ? 0.35 : 1.3);
const sun = new THREE.DirectionalLight(night ? '#8ea3d0' : '#fff1d6', night ? 0.25 : 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(hemi, sun, sun.target);
U.uNight.value = night ? 1 : 0;
U.uFade.value = 0;

const file = (await (await fetch('/opus-bay/sf/v1/transit-w4.json')).json()) as TransitFile;
const loop = file.lines.find(l => l.id === 'sf-loop')! as TransitLine & { speeds?: [number, number, number][] };
const metro = file.lines.filter(l => l.kind === 'light-rail');
const fleet = new LineFleet({ loop, metro }, { emitEvents: false });
scene.add(fleet.group);

// run the lines for a while (camera far away: everything is 'far'), then frame the subject
for (let t = 0; t < simT; t += 1 / 30) fleet.update(1 / 30, { x: 0, z: 0 }, { x: 0, z: 0 });

const target = new THREE.Vector3(), eye = new THREE.Vector3();
const bus = fleet.bus.buses[0];
const at = (x: number, y: number, z: number, h: number, back: number, side: number, up: number, look = 1.4) => {
  target.set(x, y + look, z);
  eye.set(x + Math.sin(h) * back + Math.cos(h) * side, y + up, z + Math.cos(h) * back - Math.sin(h) * side);
};
const train = fleet.rail.trains.find(t => !t.hidden && t.track.id === 'n-judah') ?? fleet.rail.trains.find(t => !t.hidden)!;
if (view === 'bus') at(bus.pose.x, bus.pose.y, bus.pose.z, bus.pose.heading, 11, 7, 4.5);
else if (view === 'bus-side') at(bus.pose.x, bus.pose.y, bus.pose.z, bus.pose.heading, 0, 13, 3.2);
else if (view === 'deck') {
  const h = bus.pose.heading;
  target.set(bus.pose.x + Math.sin(h) * 20, bus.pose.y + 2.5, bus.pose.z + Math.cos(h) * 20);
  eye.set(bus.pose.x - Math.sin(h) * 3.2, bus.pose.y + 4.6, bus.pose.z - Math.cos(h) * 3.2);
} else if (view === 'lrv') { const c = fleet.rail.leadCar(train); at(c.x, c.y, c.z, c.heading, 12, 8, 4); }
else if (view === 'lrv-cab') { const c = fleet.rail.leadCar(train); at(c.x, c.y, c.z, c.heading, 9, 2.5, 2.4); }
else if (view.startsWith('portal-')) {
  const p = fleet.portals.find(o => `portal-${o.id}` === view)!;
  target.set(p.x + Math.sin(p.heading) * 4, p.y + 1.8, p.z + Math.cos(p.heading) * 4);
  eye.set(p.x - Math.sin(p.heading) * 16 + Math.cos(p.heading) * 7, p.y + 5, p.z - Math.cos(p.heading) * 16 - Math.sin(p.heading) * 7);
} else if (view === 'kiosk' || view === 'pole' || view === 'railstop') {
  const kind = view === 'kiosk' ? 'kiosk' : view === 'pole' ? 'bus-pole' : 'rail-stop';
  const p = fleet.props.find(o => (q.get('station') ? o.station === q.get('station') : true) && o.kind.startsWith(kind))!;
  target.set(p.x, p.y + 1.4, p.z);
  eye.set(p.x + Math.sin(p.heading) * 7 + Math.cos(p.heading) * 4, p.y + 3.2, p.z + Math.cos(p.heading) * 7 - Math.sin(p.heading) * 4);
} else {
  // the whole fleet from above the Market St subway
  const p = trackPoint(fleet.rail.tracks[0], 560);
  target.set(p.x, p.y, p.z); eye.set(p.x + 60, p.y + 90, p.z - 70);
}
camera.position.copy(eye);
camera.lookAt(target);
U.uCam.value.copy(camera.position);
sun.position.set(target.x + 40, target.y + 70, target.z + 25);
sun.target.position.copy(target);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: night ? '#3a3d42' : '#a9a397', roughness: 1 }));
ground.position.set(target.x, target.y - 1.4 - 0.02, target.z);
if (view.startsWith('portal-') || view === 'kiosk' || view === 'pole' || view === 'railstop') ground.position.y = target.y - 1.8 - 0.02;
ground.receiveShadow = true;
scene.add(ground);

// one more update with the real camera so near / far LODs and visibility match the view
fleet.update(1 / 60, { x: camera.position.x, z: camera.position.z }, { x: target.x, z: target.z });
renderer.info.autoReset = false;
renderer.info.reset();
renderer.render(scene, camera);
const info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs?.length ?? 0 };
(window as unknown as { __w4: unknown }).__w4 = { fleet, info, stats: fleet.stats(), view };
renderer.info.autoReset = true;
const loopFrame = () => { renderer.render(scene, camera); requestAnimationFrame(loopFrame); };
loopFrame();
