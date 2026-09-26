// Verify re-implemented projection against district.ts project() on known points.
import { project, unproject, COIT_POS } from '../../../baylink-opus/src/opus-bay/data/district.ts';
const RAD = Math.PI / 180, K = 0.14, ROT = 46 * RAD, LAT0 = 37.802338, LNG0 = -122.40001;
const MX = 111320 * Math.cos(LAT0 * RAD), MZ = 110540, C = Math.cos(ROT), S = Math.sin(ROT);
function proj(lat: number, lng: number) { const e = (lng - LNG0) * MX, n = (lat - LAT0) * MZ; return { x: K * (e * C - n * S), z: K * (-e * S - n * C) }; }
const pts: [string, number, number][] = [
  ['Coit Tower', 37.80238, -122.40583], ['Transamerica', 37.79517, -122.40279], ['Salesforce Tower', 37.78978, -122.39691],
  ['Embarcadero Plaza', 37.7949, -122.39465], ['GG Bridge S tower', 37.8102, -122.4775], ['Ocean Beach', 37.76, -122.511],
];
for (const [n, la, lo] of pts) { const a = project(la, lo), b = proj(la, lo); const u = unproject(a); console.log(n.padEnd(20), JSON.stringify(a), `mine=(${b.x.toFixed(3)},${b.z.toFixed(3)})`, `dx=${(a.x - b.x).toFixed(4)} dz=${(a.z - b.z).toFixed(4)}`, `inv=(${u.lat.toFixed(6)},${u.lng.toFixed(6)})`); }
console.log('COIT_POS', COIT_POS);
