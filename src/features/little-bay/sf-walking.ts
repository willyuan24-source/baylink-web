export type SfWalkDirection = { x: number; z: number };

export type SfWalkerState = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Radians; zero faces +Z, matching BayBay's model. */
  heading: number;
  speed: number;
  /** Actual accumulated ground distance, suitable for footstep animation. */
  distance: number;
  /** Angular velocity in radians per second, suitable for a gentle body lean. */
  turn: number;
};

export type SfWalkingOptions = {
  active?: boolean;
  maxSpeed?: number;
  canMove?: (x: number, z: number) => boolean;
  destination?: SfWalkDirection | null;
};

const MAX_FRAME_SECONDS = .1;
const MAX_SUBSTEP_SECONDS = 1 / 120;
const ARRIVAL_RADIUS = .025;

const shortestAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function createSfWalkerState(x: number, z: number, heading = 0): SfWalkerState {
  return { x, z, vx: 0, vz: 0, heading, speed: 0, distance: 0, turn: 0 };
}

/**
 * Camera-relative input is converted to a world direction by the caller. Walking
 * accelerates, brakes and turns smoothly, with short collision steps so a slow
 * frame cannot carry BayBay through furniture. Keyboard input overrides a tap.
 */
export function stepSfWalker(
  previous: SfWalkerState,
  direction: SfWalkDirection,
  seconds: number,
  options: SfWalkingOptions = {},
): SfWalkerState {
  const state = { ...previous };
  if (options.active === false) return { ...state, vx: 0, vz: 0, speed: 0, turn: 0 };
  if (!Number.isFinite(seconds) || seconds <= 0) return state;

  const delta = Math.min(seconds, MAX_FRAME_SECONDS);
  const steps = Math.ceil(delta / MAX_SUBSTEP_SECONDS);
  const dt = delta / steps;
  const maxSpeed = Number.isFinite(options.maxSpeed) ? Math.max(0, options.maxSpeed!) : 2.4;
  const inputX = Number.isFinite(direction.x) ? direction.x : 0;
  const inputZ = Number.isFinite(direction.z) ? direction.z : 0;
  const inputLength = Math.hypot(inputX, inputZ);
  const destination = inputLength < 1e-6 && options.destination
    && Number.isFinite(options.destination.x) && Number.isFinite(options.destination.z)
    ? options.destination : null;
  const canMove = options.canMove ?? (() => true);

  for (let step = 0; step < steps; step++) {
    let desiredX = inputLength > 1e-6 ? inputX / inputLength * maxSpeed : 0;
    let desiredZ = inputLength > 1e-6 ? inputZ / inputLength * maxSpeed : 0;
    let remaining = Infinity;
    let targetX = 0;
    let targetZ = 0;
    if (destination) {
      targetX = destination.x - state.x;
      targetZ = destination.z - state.z;
      remaining = Math.hypot(targetX, targetZ);
      if (remaining <= ARRIVAL_RADIUS && canMove(destination.x, destination.z)) {
        state.distance += remaining;
        state.x = destination.x;
        state.z = destination.z;
        state.vx = state.vz = state.speed = state.turn = 0;
        break;
      }
      if (remaining > 1e-6) {
        const approachSpeed = Math.min(maxSpeed, remaining * 5);
        desiredX = targetX / remaining * approachSpeed;
        desiredZ = targetZ / remaining * approachSpeed;
      }
    }

    const moving = Math.hypot(desiredX, desiredZ) > 1e-6;
    const response = moving ? 11 : 16;
    const decay = Math.exp(-response * dt);
    // Exact integration for this target velocity avoids a different walk speed
    // at 30, 60 and 120 Hz and gives a short, controlled braking distance.
    let dx = desiredX * dt + (state.vx - desiredX) * (1 - decay) / response;
    let dz = desiredZ * dt + (state.vz - desiredZ) * (1 - decay) / response;
    state.vx = desiredX + (state.vx - desiredX) * decay;
    state.vz = desiredZ + (state.vz - desiredZ) * decay;

    let arrived = false;
    if (destination && remaining > 1e-6) {
      const advance = (dx * targetX + dz * targetZ) / remaining;
      const lateral = Math.abs(dx * targetZ - dz * targetX) / remaining;
      if (advance >= remaining && lateral <= ARRIVAL_RADIUS) {
        dx = targetX;
        dz = targetZ;
        arrived = true;
      }
    }

    if (!canMove(state.x + dx, state.z + dz)) {
      const alongX = Math.abs(dx) > 1e-10 && canMove(state.x + dx, state.z);
      const alongZ = Math.abs(dz) > 1e-10 && canMove(state.x, state.z + dz);
      // If the combined move clips a corner, retain one free axis instead of
      // accumulating velocity against the obstacle or sticking to its edge.
      if (alongX && (!alongZ || Math.abs(dx) >= Math.abs(dz))) {
        dz = 0;
        state.vz = 0;
      } else if (alongZ) {
        dx = 0;
        state.vx = 0;
      } else {
        dx = dz = state.vx = state.vz = 0;
      }
      arrived = false;
    }

    state.x += dx;
    state.z += dz;
    state.distance += Math.hypot(dx, dz);
    state.speed = Math.hypot(state.vx, state.vz);
    if (state.speed > .025) {
      const turn = shortestAngle(Math.atan2(state.vx, state.vz) - state.heading) * (1 - Math.exp(-14 * dt));
      state.heading = shortestAngle(state.heading + turn);
      state.turn = turn / dt;
    } else {
      state.turn *= Math.exp(-16 * dt);
      if (!moving && state.speed < .005) state.vx = state.vz = state.speed = 0;
    }
    if (arrived) {
      state.vx = state.vz = state.speed = state.turn = 0;
      break;
    }
  }
  return state;
}
