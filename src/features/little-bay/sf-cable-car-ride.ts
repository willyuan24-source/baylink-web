import { projectCoordinate, terrainHeight } from './sf-world';

/** An authored miniature sightseeing line, not a real SFMTA transit itinerary. */
const waypoints = [
  [-122.40768, 37.7848], [-122.40828, 37.78835], [-122.40865, 37.7905],
  [-122.40575, 37.79065], [-122.4051, 37.7938], [-122.4067, 37.7963],
  [-122.4115, 37.8011], [-122.4145, 37.8057], [-122.4134, 37.80845],
].map(projectCoordinate);
const lengths = waypoints.slice(1).map((point, index) => Math.hypot(point[0] - waypoints[index][0], point[1] - waypoints[index][1]));
const total = lengths.reduce((sum, length) => sum + length, 0);
export const SF_CABLE_CAR_SECONDS = 48;

export function sampleSfCableCarRide(seconds: number) {
  const progress = Math.max(0, Math.min(1, Number.isFinite(seconds) ? seconds / SF_CABLE_CAR_SECONDS : 0));
  // Soft departure and arrival, with an otherwise constant cruising speed.
  const fraction = progress * progress * (3 - 2 * progress);
  let distance = total * fraction;
  for (let index = 0; index < lengths.length; index++) {
    if (distance <= lengths[index] || index === lengths.length - 1) {
      const a = waypoints[index], b = waypoints[index + 1];
      const t = Math.min(1, distance / lengths[index]);
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      return { x, z, y: terrainHeight(x, z) + .12, heading: Math.atan2(b[0] - a[0], b[1] - a[1]), progress,
        chapter: progress < .27 ? 'square' : progress < .55 ? 'chinatown' : 'waterfront' };
    }
    distance -= lengths[index];
  }
  throw new Error('A sightseeing line must contain a segment');
}
