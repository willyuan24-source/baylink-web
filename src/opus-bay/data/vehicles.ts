import { DISTRICT } from './district';

/**
 * Where the rideable toys wait (plan §6.3 / §6.4). World units, headings in the three.js convention (faces
 * (sin h, cos h)). Every spot is checked by tests/opus-bay-sf-modes.test.ts: the hull fits (actors/vehicles/collide
 * poseCheck) and a door slot is reachable.
 *
 * - One chunky toy bike at each district bike rack (DISTRICT.props kind 'bike-rack'), parked beside it, plus bikes on
 *   their kickstands at the ferry gate (you see one the moment you step off the ferry), Pier 33 and mid-Embarcadero.
 *   A bike left more than 80 u behind rolls quietly back to its spot (actors/vehicles/fleet.ts).
 * - The kiddie toy car at the Ferry Building plaza edge, facing up the promenade; unlocked from the start (open
 *   question §12.2 answered: free — the district has no roads, so it drives the promenade and plazas).
 * City mode adds spots from the streamed props later (bike racks at stops and landmarks); this list stays the hero's.
 */

export type RideKind = 'bike' | 'car';
export interface VehicleSpot {
  id: string;
  kind: RideKind;
  x: number;
  z: number;
  heading: number;
  /** parked at a rack prop (else on a kickstand) */
  rack?: boolean;
  /** frame colour index (models.ts BIKE_LIVERIES) */
  livery?: number;
  name: { zh: string; en: string };
}

/** Hand-placed spots (probed against core/terrain; see the test). */
export const VEHICLE_SPOTS: readonly VehicleSpot[] = [
  { id: 'car-ferry-plaza', kind: 'car', x: 158, z: 0.5, heading: -Math.PI / 2, name: { zh: '玩具小车', en: 'Toy car' } },
  { id: 'bike-ferry-gate', kind: 'bike', x: 152, z: -19, heading: Math.PI / 2, livery: 0, name: { zh: '小单车', en: 'Toy bike' } },
  { id: 'bike-pier33', kind: 'bike', x: -97.7, z: -19, heading: Math.PI / 2, livery: 1, name: { zh: '小单车', en: 'Toy bike' } },
  { id: 'bike-embarcadero', kind: 'bike', x: -53.7, z: -17, heading: Math.PI / 2, livery: 2, name: { zh: '小单车', en: 'Toy bike' } },
];

/** Offset of a parked bike from its rack: 1 u to the rack's left, parallel to it. */
const RACK_SIDE = 1.0;

/** Every bike spot: one per district rack, then the hand-placed ones. */
export function bikeSpots(): VehicleSpot[] {
  const out: VehicleSpot[] = [];
  DISTRICT.props.filter(p => p.kind === 'bike-rack').forEach((rack, i) => {
    const rot = rack.rotationY ?? 0;
    out.push({
      id: `bike-rack-${i}`, kind: 'bike', x: rack.x + Math.cos(rot) * RACK_SIDE, z: rack.z - Math.sin(rot) * RACK_SIDE, heading: rot,
      rack: true, livery: (i + 1) % 3, name: { zh: '小单车', en: 'Toy bike' },
    });
  });
  for (const s of VEHICLE_SPOTS) if (s.kind === 'bike') out.push(s);
  return out;
}

/** All spots (bikes, then the car). */
export function vehicleSpots(): VehicleSpot[] { return [...bikeSpots(), ...VEHICLE_SPOTS.filter(s => s.kind === 'car')]; }

/** A bike abandoned farther than this from the player returns to its spot. */
export const RETURN_DISTANCE = 80;

/**
 * Places to sit (E): every district bench (props kind 'bench': seat top 0.5 u, facing the bench's rotation) and a
 * couple of sunny steps on the Filbert Steps. `x / z` is the seat, `heading` the way the sitter faces, `y` the seat
 * height above the ground there.
 */
export interface SeatSpot { id: string; x: number; z: number; heading: number; y: number; kind: 'bench' | 'step' }

export function seatSpots(): SeatSpot[] {
  const out: SeatSpot[] = [];
  DISTRICT.props.filter(p => p.kind === 'bench').forEach((b, i) => {
    const r = b.rotationY ?? 0;
    out.push({ id: `seat:bench-${i}`, x: b.x + Math.sin(r) * 0.08, z: b.z + Math.cos(r) * 0.08, heading: r, y: 0.5, kind: 'bench' });
  });
  const mid = DISTRICT.anchors['filbert-steps-mid'], bottom = DISTRICT.anchors['filbert-steps-bottom'];
  if (mid && bottom) {
    // sit facing down the steps (toward the Bay)
    const down = Math.atan2(bottom.x - mid.x, bottom.z - mid.z);
    out.push({ id: 'seat:filbert-steps', x: mid.x, z: mid.z, heading: down, y: 0.05, kind: 'step' });
  }
  return out;
}
