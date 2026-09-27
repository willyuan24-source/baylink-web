// Exact re-implementation of baylink-opus/src/opus-bay/data/district.ts project() (lines 42-58), verified.
const RAD = Math.PI / 180, K = 0.14, ROT = 46 * RAD, LAT0 = 37.802338, LNG0 = -122.40001;
const MX = 111320 * Math.cos(LAT0 * RAD), MZ = 110540, C = Math.cos(ROT), S = Math.sin(ROT);
export const PROJ = { K, ROT_DEG: 46, LAT0, LNG0, MX, MZ };
export function projectRaw(lat, lng, k = K) { const e = (lng - LNG0) * MX, n = (lat - LAT0) * MZ; return { x: k * (e * C - n * S), z: k * (-e * S - n * C) }; }
export function project(lat, lng) { const p = projectRaw(lat, lng); return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 }; }
export function unproject(x, z, k = K) { const X = x / k, Z = z / k; const e = X * C - Z * S, n = -X * S - Z * C; return { lat: LAT0 + n / MZ, lng: LNG0 + e / MX }; }
