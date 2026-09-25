import * as THREE from 'three';

export type MapPoint = readonly [number, number];

export function containsPoint(point: MapPoint, ring: readonly MapPoint[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]; const b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Refine the published polygon without replacing its shoreline by a drawn outline. */
export function createTerrainGeometry(rings: readonly (readonly MapPoint[])[], height: (x: number, z: number) => number, offset = 0) {
  const positions: number[] = [];
  const edge = (a: MapPoint, b: MapPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const emit = (a: MapPoint, b: MapPoint, c: MapPoint, depth = 0) => {
    const lengths = [edge(a, b), edge(b, c), edge(c, a)];
    const longest = Math.max(...lengths);
    if (longest > 2.2 && depth < 15) {
      const index = lengths.indexOf(longest);
      const points = [a, b, c];
      const first = points[index]; const second = points[(index + 1) % 3]; const third = points[(index + 2) % 3];
      const middle: MapPoint = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
      emit(first, middle, third, depth + 1); emit(middle, second, third, depth + 1);
      return;
    }
    // The map's second coordinate is world Z. Reverse the polygon triangle to face up.
    for (const p of [a, c, b]) positions.push(p[0], height(p[0], p[1]) + offset, p[1]);
  };
  for (const ring of rings) {
    const contour = ring.map(point => new THREE.Vector2(point[0], point[1]));
    for (const triangle of THREE.ShapeUtils.triangulateShape(contour, [])) emit(ring[triangle[0]], ring[triangle[1]], ring[triangle[2]]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createShoreGeometry(rings: readonly (readonly MapPoint[])[], height: (x: number, z: number) => number) {
  const positions: number[] = [];
  for (const ring of rings) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]; const b = ring[i];
    const ay = height(a[0], a[1]); const by = height(b[0], b[1]);
    positions.push(a[0], ay, a[1], a[0], -.7, a[1], b[0], by, b[1],
      b[0], by, b[1], a[0], -.7, a[1], b[0], -.7, b[1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** One merged mesh for thousands of named road segments. */
export function createRoadGeometry(roads: readonly { path: readonly MapPoint[]; width: number }[], height: (x: number, z: number) => number, widthExtra = 0, yOffset = .06) {
  const positions: number[] = [];
  const joins = new Map<string, { point: MapPoint; radius: number }>();
  for (const road of roads) for (const point of road.path) {
    const key = `${point[0].toFixed(4)}:${point[1].toFixed(4)}`;
    const radius = road.width / 2 + widthExtra;
    if (!joins.has(key) || joins.get(key)!.radius < radius) joins.set(key, { point, radius });
  }
  for (const road of roads) for (let i = 1; i < road.path.length; i++) {
    const a = road.path[i - 1]; const b = road.path[i];
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (distance < .001) continue;
    const nx = -(b[1] - a[1]) / distance * (road.width / 2 + widthExtra);
    const nz = (b[0] - a[0]) / distance * (road.width / 2 + widthExtra);
    const steps = Math.max(1, Math.ceil(distance / .6));
    for (let step = 0; step < steps; step++) {
      const at = step / steps; const bt = (step + 1) / steps;
      const ax = a[0] + (b[0] - a[0]) * at; const az = a[1] + (b[1] - a[1]) * at;
      const bx = a[0] + (b[0] - a[0]) * bt; const bz = a[1] + (b[1] - a[1]) * bt;
      const points: MapPoint[] = [[ax + nx, az + nz], [ax - nx, az - nz], [bx + nx, bz + nz], [bx - nx, bz - nz]];
      for (const index of [0, 2, 1, 1, 2, 3]) {
        const p = points[index]; positions.push(p[0], height(p[0], p[1]) + yOffset, p[1]);
      }
    }
  }
  // Rounded joins close the triangular gaps between adjoining street segments.
  for (const { point, radius } of joins.values()) for (let index = 0; index < 10; index++) {
    const angle = index / 10 * Math.PI * 2; const nextAngle = (index + 1) / 10 * Math.PI * 2;
    const a: MapPoint = [point[0] + Math.cos(angle) * radius, point[1] + Math.sin(angle) * radius];
    const b: MapPoint = [point[0] + Math.cos(nextAngle) * radius, point[1] + Math.sin(nextAngle) * radius];
    for (const p of [point, b, a]) positions.push(p[0], height(p[0], p[1]) + yOffset + .001, p[1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function mapHash(x: number, z: number, seed = 0) {
  const value = Math.sin(x * 12.9898 + z * 78.233 + seed * 39.425) * 43758.5453;
  return value - Math.floor(value);
}
