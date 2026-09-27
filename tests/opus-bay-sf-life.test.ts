/**
 * Lane F city life (tests/opus-bay-sf-life.test.ts): F13 the hero-life pause. Later parts add the crowd and the toy
 * traffic invariants here.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { game } from '../src/opus-bay/core/store';
import { Life } from '../src/opus-bay/world/life';

/** Triangles the visible meshes of a group would draw (instanced meshes × their live count). */
function visibleTriangles(root: THREE.Object3D): { tris: number; meshes: string[] } {
  let tris = 0;
  const meshes: string[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    const g = m.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
    tris += n * inst;
    meshes.push(m.name);
  });
  return { tris, meshes };
}

test('F13: far from the hero slab the district life hides and stops; ferry 0 and the beam keep going', () => {
  game.set({ phase: 'free' } as never);
  const life = new Life([{ x: -30, y: 12, z: -160, length: 60, speed: 0.9 }]);
  const halo: boolean[] = [];
  life.halos = { count: 12, set: (i, _x, _y, _z, on) => { halo[i] = on; } };
  let far = false;
  life.heroFarSource = () => far;
  for (let i = 0; i < 10; i++) life.update(0.1, i * 0.1, 1);
  const near = visibleTriangles(life.group);
  assert.ok(near.meshes.includes('pedestrians') && near.meshes.includes('gulls') && near.meshes.includes('ferry-1'));
  assert.equal(life.paused, false);

  far = true;
  const peopleBefore = life.group.getObjectByName('pedestrians') as THREE.InstancedMesh;
  const m0 = new THREE.Matrix4(), m1 = new THREE.Matrix4();
  peopleBefore.getMatrixAt(0, m0);
  const ferry0 = life.group.getObjectByName('ferry-0') as THREE.Mesh;
  const f0 = new THREE.Vector3().setFromMatrixPosition(ferry0.matrix);
  for (let i = 10; i < 400; i++) life.update(0.1, i * 0.1, 1);
  assert.equal(life.paused, true);
  const paused = visibleTriangles(life.group);
  // ferry 0 (the arrival / rideable ferry) and the Alcatraz beam only
  assert.deepEqual(paused.meshes.sort(), ['ferry-0', 'lighthouse-beam']);
  assert.ok(near.tris - paused.tris > 10_000, `saves ${near.tris - paused.tris} triangles (near ${near.tris}, far ${paused.tris})`);
  // the paused life does not move; ferry 0 keeps its dock / harbour loop
  peopleBefore.getMatrixAt(0, m1);
  assert.ok(m0.equals(m1), 'pedestrians frozen while paused');
  const f1 = new THREE.Vector3().setFromMatrixPosition(ferry0.matrix);
  assert.ok(f0.distanceTo(f1) > 1, `ferry 0 moved ${f0.distanceTo(f1).toFixed(1)} u`);
  // night lights: ferry 0's stay on, ferry 1's and the sailboats' go off
  assert.ok(halo.slice(0, 4).every(Boolean));
  assert.ok(halo.slice(4).every(on => on === false));
  // the water shows ferry 0's wake only
  assert.equal(life.wakes.filter(w => w.w > 0 || w.x !== 0).length <= 1, true);

  // back near: everything shows again and moves on
  far = false;
  for (let i = 400; i < 404; i++) life.update(0.1, i * 0.1, 1);
  assert.equal(life.paused, false);
  const again = visibleTriangles(life.group);
  assert.ok(again.meshes.includes('pedestrians') && again.meshes.includes('ferry-1') && again.meshes.includes('carousel'));
  peopleBefore.getMatrixAt(0, m1);
  assert.ok(!m0.equals(m1), 'pedestrians walk again');
});

test('F13: district mode never pauses (no streamer)', () => {
  const life = new Life([]);
  for (let i = 0; i < 5; i++) life.update(0.1, i * 0.1, 0);
  assert.equal(life.paused, false);
});
