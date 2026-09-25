import { createSfDrivingSpawn } from './sf-driving';
import type { SfDrivingSpawn } from './sf-driving';
import { SF_LANDMARKS, isOnLand, nearestRoad } from './sf-world';
import type { SfPoint } from './sf-world';

// Small museums sit close together. Their front doors are a better walking
// departure than a road centreline that can run through the miniature building.
const WALK_ENTRANCES: Record<string, SfPoint> = {
  'japanese-tea-garden': [.48, .93],
  academy: [0, 1.1],
  'de-young': [-.22, 1.01],
  'ocean-beach': [-.15, .85],
  'baker-beach': [.1, .75],
  'lands-end': [1.08, .68],
  ferry: [0, 1.3],
  alcatraz: [0, .9],
  'ucsf-parnassus': [0, 1.8],
  'ucsf-mission-bay': [0, 1.8],
  'sf-state': [0, 1.85],
  exploratorium: [-1.45, 1.72],
  stonestown: [0, 1.82],
  'city-hall': [0, 1.78],
  salesforce: [0, 1.95],
  transamerica: [-.15, 1.65],
  'oracle-park': [0, 2.3],
};

export function findSfArrival(x: number, z: number): string | null {
  let closest = Infinity; let arrival: string | null = null;
  for (const landmark of SF_LANDMARKS) {
    const distance = Math.hypot(x - landmark.position[0], z - landmark.position[1]);
    if (distance < landmark.arrivalRadius && distance < closest) { closest = distance; arrival = landmark.id; }
  }
  return arrival;
}

export function createSfWalkingSpawn(landmarkId: string): SfDrivingSpawn {
  const landmark = SF_LANDMARKS.find(item => item.id === landmarkId);
  const entrance = landmark && WALK_ENTRANCES[landmark.id];
  if (landmark && entrance) {
    const x = landmark.position[0] + entrance[0], z = landmark.position[1] + entrance[1];
    if (isOnLand(x, z) && findSfArrival(x, z) === landmark.id) {
      return { state: { x, z, heading: Math.atan2(-entrance[0], -entrance[1]), speed: 0 },
        streetName: nearestRoad(x, z).road.name, landmarkId: landmark.id };
    }
  }
  return createSfDrivingSpawn(landmarkId);
}

/** A fresh departure must report arrival even when it returns to the same place. */
export function createSfArrivalTracker() {
  let previous: string | null = null;
  let initialized = false;
  return {
    reset() { initialized = false; },
    update(x: number, z: number) {
      const id = findSfArrival(x, z);
      const changed = !initialized || previous !== id;
      initialized = true; previous = id;
      return { id, changed };
    },
  };
}
