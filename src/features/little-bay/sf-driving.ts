import { SF_ALCATRAZ_DEPARTURE, SF_CITY_RINGS, SF_LANDMARKS, isOnLand, nearestRoad } from './sf-world';
import type { SfPoint, SfRoadHit } from './sf-world';
import type { SfMovementInput } from './sf-movement-input';

export type SfDriveInput = SfMovementInput;
export type SfVehicleState = { x: number; z: number; heading: number; speed: number };
export type SfDrivingSpawn = { state: SfVehicleState; streetName: string; landmarkId: string };
export const SF_DRIVING_EMPTY_INPUT: SfDriveInput = { forward: false, backward: false, left: false, right: false };
export const SF_DRIVING_SPAWN_CLEARANCE = 2.2;
export const SF_DRIVING_FORWARD_SPEED = 5.6;
export const SF_DRIVING_REVERSE_SPEED = 3.8;

const LANDMARK_OBSTACLES: Record<string, number> = {
  park: 2.05, palace: 1.6, presidio: 1.3, ferry: 2.1, coit: .7,
  'painted-ladies': 1.9, skystar: .85, 'union-square': .65,
};

function isHiddenBySfLandmark(x: number, z: number) {
  return SF_LANDMARKS.some(landmark => {
    const radius = LANDMARK_OBSTACLES[landmark.id];
    return radius !== undefined && Math.hypot(x - landmark.position[0], z - landmark.position[1]) < radius + .18;
  });
}

export function sfDrivingPosition(x: number, z: number): { allowed: boolean; road: SfRoadHit } {
  const road = nearestRoad(x, z, true);
  return {
    // Roads identify the surroundings; the whole land surface is freely explorable.
    allowed: isOnLand(x, z),
    road,
  };
}

function hasForwardClearance(point: SfPoint, heading: number) {
  for (let step = 0; step <= 12; step++) {
    const distance = step / 12 * SF_DRIVING_SPAWN_CLEARANCE;
    const x = point[0] + Math.sin(heading) * distance, z = point[1] + Math.cos(heading) * distance;
    if (!isOnLand(x, z) || isHiddenBySfLandmark(x, z)) return false;
  }
  return true;
}

const spawnCache = new Map<string, SfDrivingSpawn>();

/** Start near a recognisable street, with a visible and usable departure direction. */
export function createSfDrivingSpawn(landmarkId: string): SfDrivingSpawn {
  const cached = spawnCache.get(landmarkId);
  if (cached) return { ...cached, state: { ...cached.state } };
  const landmark = SF_LANDMARKS.find(item => item.id === landmarkId) ?? SF_LANDMARKS.find(item => item.id === 'park')!;
  // The island has no car connection. Defensive callers start at the mainland ferry terminal.
  const anchor = landmark.id === 'alcatraz' ? SF_ALCATRAZ_DEPARTURE.position : landmark.position;
  const candidates = new Map<string, SfRoadHit>();
  const add = (x: number, z: number) => {
    const hit = nearestRoad(x, z, true);
    candidates.set(`${hit.point[0].toFixed(3)}:${hit.point[1].toFixed(3)}`, hit);
  };
  add(...anchor);
  for (const radius of [1.7, 3.2, 4.5, 6, 8, 12]) for (let index = 0; index < 24; index++) {
    const angle = index / 24 * Math.PI * 2;
    add(anchor[0] + Math.cos(angle) * radius, anchor[1] + Math.sin(angle) * radius);
  }
  const sorted = [...candidates.values()].sort((a, b) =>
    Math.hypot(a.point[0] - anchor[0], a.point[1] - anchor[1]) - Math.hypot(b.point[0] - anchor[0], b.point[1] - anchor[1]));
  for (const candidate of sorted) for (const heading of [candidate.heading, candidate.heading + Math.PI]) {
    if (!hasForwardClearance(candidate.point, heading)) continue;
    const result = { state: { x: candidate.point[0], z: candidate.point[1], heading, speed: 0 }, streetName: candidate.road.name, landmarkId: landmark.id };
    spawnCache.set(landmarkId, result);
    return { ...result, state: { ...result.state } };
  }
  throw new Error(`No unobstructed driving start near ${landmark.id}`);
}

const shorelineSegments = SF_CITY_RINGS.flatMap(ring => ring.map((point, index) => {
  const next = ring[(index + 1) % ring.length];
  return { x: point[0], z: point[1], dx: next[0] - point[0], dz: next[1] - point[1] };
}));

function staysOnLand(x: number, z: number, dx: number, dz: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .06));
  for (let step = 1; step <= steps; step++) {
    if (!isOnLand(x + dx * step / steps, z + dz * step / steps)) return false;
  }
  return true;
}

/** Keep the coastline, but preserve the part of motion that runs along its edge. */
function moveOnLand(x: number, z: number, dx: number, dz: number) {
  if (staysOnLand(x, z, dx, dz)) return { x: x + dx, z: z + dz, blocked: false };

  let closestDistance = Infinity;
  let tangent: SfPoint = [0, 0];
  for (const segment of shorelineSegments) {
    const lengthSquared = segment.dx ** 2 + segment.dz ** 2;
    if (!lengthSquared) continue;
    const t = Math.max(0, Math.min(1, ((x - segment.x) * segment.dx + (z - segment.z) * segment.dz) / lengthSquared));
    const distance = (x - segment.x - t * segment.dx) ** 2 + (z - segment.z - t * segment.dz) ** 2;
    if (distance < closestDistance) {
      closestDistance = distance;
      const length = Math.sqrt(lengthSquared);
      tangent = [segment.dx / length, segment.dz / length];
    }
  }
  const alongShore = dx * tangent[0] + dz * tangent[1];
  const candidates: SfPoint[] = [[tangent[0] * alongShore, tangent[1] * alongShore], [dx, 0], [0, dz]];
  let result = { x, z, blocked: true };
  let progress = 0;
  for (const [slideX, slideZ] of candidates) {
    const candidateProgress = slideX * dx + slideZ * dz;
    if (candidateProgress <= progress || !staysOnLand(x, z, slideX, slideZ)) continue;
    progress = candidateProgress;
    result = { x: x + slideX, z: z + slideZ, blocked: true };
  }
  return result;
}

/** Pure, frame-rate independent movement; input never moves a paused vehicle. */
export function stepSfVehicle(previous: SfVehicleState, input: SfDriveInput, seconds: number, active = true) {
  const state = { ...previous };
  if (!active || !Number.isFinite(seconds) || seconds <= 0) {
    if (!active) state.speed = 0;
    return { state, blocked: false, streetName: nearestRoad(state.x, state.z, true).road.name };
  }
  const delta = Math.min(seconds, .04);
  const acceleration = Number(input.forward) - Number(input.backward);
  const steering = Number(input.left) - Number(input.right);
  const targetSpeed = acceleration > 0 ? SF_DRIVING_FORWARD_SPEED : acceleration < 0 ? -SF_DRIVING_REVERSE_SPEED : 0;
  state.speed += (targetSpeed - state.speed) * (1 - Math.exp(-(acceleration ? 3.5 : 5) * delta));
  state.heading += steering * 2.2 * delta * (state.speed < -.15 ? -1 : 1);
  const position = moveOnLand(state.x, state.z, Math.sin(state.heading) * state.speed * delta, Math.cos(state.heading) * state.speed * delta);
  if (position.x === state.x && position.z === state.z && position.blocked) state.speed *= Math.exp(-4 * delta);
  state.x = position.x;
  state.z = position.z;
  return { state, blocked: position.blocked, streetName: nearestRoad(state.x, state.z, true).road.name };
}

/** Touch steering points the car toward a camera-relative direction with proportional throttle. */
export function stepSfDirectionalVehicle(previous: SfVehicleState, direction: { x: number; z: number }, seconds: number, active = true) {
  const state = { ...previous };
  if (!active || !Number.isFinite(seconds) || seconds <= 0) {
    if (!active) state.speed = 0;
    return { state, blocked: false, streetName: nearestRoad(state.x, state.z, true).road.name };
  }
  const delta = Math.min(seconds, .04);
  const x = Number.isFinite(direction.x) ? direction.x : 0;
  const z = Number.isFinite(direction.z) ? direction.z : 0;
  const strength = Math.min(1, Math.hypot(x, z));
  let alignment = 1;
  if (strength > 1e-6) {
    const turn = Math.atan2(Math.sin(Math.atan2(x, z) - state.heading), Math.cos(Math.atan2(x, z) - state.heading));
    const remainingTurn = turn * Math.exp(-14 * delta);
    state.heading += turn - remainingTurn;
    // Turn in place when the thumb reverses direction; do not drive away from it.
    alignment = Math.max(0, Math.cos(remainingTurn));
  }
  const targetSpeed = strength * SF_DRIVING_FORWARD_SPEED;
  state.speed = Math.max(0, state.speed) + (targetSpeed - Math.max(0, state.speed)) * (1 - Math.exp(-(strength ? 7 : 12) * delta));
  if (!strength && state.speed < .005) state.speed = 0;
  const distance = state.speed * alignment * delta;
  const position = moveOnLand(state.x, state.z, Math.sin(state.heading) * distance, Math.cos(state.heading) * distance);
  if (position.x === state.x && position.z === state.z && position.blocked) state.speed *= Math.exp(-4 * delta);
  state.x = position.x;
  state.z = position.z;
  return { state, blocked: position.blocked, streetName: nearestRoad(state.x, state.z, true).road.name };
}
