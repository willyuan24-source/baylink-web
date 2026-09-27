import { runtime } from './runtime';

/**
 * Player input (owned by actors). Keyboard by event.code, gamepad via navigator.getGamepads, and the touch
 * stick / camera gestures that actors/pointer.ts writes here. Everything ends up in runtime.input (movement
 * vector, run, jump edge, interact / call edges) or in `input` below (camera look + zoom, reset), which the
 * controller and the camera rig consume every frame. No React state.
 *
 * Keyboard E / Enter / Q / M / J / P / Esc are NOT handled here: the DOM overlay (ui/Overlay, ui/Dialogue,
 * photo mode) owns them and calls the flow directly. Mirroring them into runtime.input would double-fire
 * (e.g. advance a dialogue twice), so only the gamepad raises runtime.input.interact / call.
 */

export const input = {
  /** touch joystick, −1..1 (y > 0 = forward) — written by actors/pointer.ts */
  stick: { active: false, x: 0, y: 0 },
  /** camera look from the gamepad right stick, −1..1 */
  lookX: 0,
  lookY: 0,
  /** accumulated pointer drag in CSS px since the camera last consumed it */
  dragX: 0,
  dragY: 0,
  /** accumulated wheel delta (px, + = zoom out) and pinch ratio (> 1 = zoom out) */
  wheel: 0,
  pinch: 1,
  /** performance.now() of the last manual camera input (drag / stick / wheel) */
  lastCameraInputAt: -1e9,
  /** incremented by R / gamepad right-stick click: controller unsticks, camera recenters */
  resetCount: 0,
  /** incremented by E / Enter presses (consumed while riding / sitting: switch spot, stand up) */
  interactCount: 0,
  /** F / gamepad Y taps (enter / exit a vehicle). A hold ≥ CALL_HOLD_MS raises callVehicleCount instead. */
  vehicleCount: 0,
  /** hold F / gamepad Y: call your bike / car over */
  callVehicleCount: 0,
  /** G / gamepad L3: pelican take-off / landing */
  glideCount: 0,
  /** H / gamepad LB: bike bell / toy horn */
  hornCount: 0,
  /** "get off here" requests (the HUD's 提前下车 via actors/moveApi requestHopOff): in a transit car, same as Space / B */
  hopOffCount: 0,
  /** C (or D-pad up / down while in a vehicle): cycle the camera near / far preset */
  camPresetCount: 0,
  /** gamepad triggers, analog 0..1: RT throttle, LT brake (vehicles; RT still runs on foot) */
  throttle: 0,
  brake: 0,
  /** this frame's steering came from an analog source (stick / pad): keyboard steering gets the speed-shaped curve */
  analogSteer: false,
  /**
   * Written by the movement system each frame: 'in' while riding a bike / car / glide, 'near' when a vehicle can be
   * boarded. The gamepad maps Y to the vehicle there (else to the journal) and the D-pad to camera presets 'in' one.
   */
  vehicleContext: 'none' as 'none' | 'near' | 'in',
  /** true while the player is holding a movement key / stick */
  manualMove: false,
  /** true while Space / gamepad B is held (a release before the apex cuts the jump short) */
  jumpHeld: false,
  /** keyboard keys held (event.code) */
  keys: new Set<string>(),
};

let spaceHeld = false;
let padHeld = false;

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const GAME_KEYS = new Set([...MOVE_KEYS, 'ShiftLeft', 'ShiftRight', 'Space', 'KeyR', 'KeyF', 'KeyG', 'KeyH', 'KeyC']);
/** F / Y held this long with no vehicle near = "call my vehicle" */
export const CALL_HOLD_MS = 600;
/** when F / Y went down (performance.now ms), or −1; `fired` once the hold turned into a call */
const hold = { key: -1, keyFired: false, pad: -1, padFired: false };
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}
function isControl(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute?.('role') === 'button' || el.getAttribute?.('role') === 'tab';
}

/**
 * Never calls preventDefault: ui/Overlay ignores defaultPrevented events, and it owns Space / Enter for the
 * title, cinematic skip, rewards and the fishing game (the page itself does not scroll).
 */
export function onKeyDown(e: Pick<KeyboardEvent, 'code' | 'repeat' | 'target' | 'metaKey' | 'ctrlKey' | 'altKey'>) {
  if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
  if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat && !isControl(e.target)) input.interactCount++;
  if (!GAME_KEYS.has(e.code)) return;
  runtime.input.device = 'keyboard';
  if (e.code === 'Space') {
    // Space on a focused button activates the button; dialogue / photo mode / cinematics own Space.
    if (isControl(e.target)) return;
    if (!e.repeat) runtime.input.jump = true;
    spaceHeld = true;
    input.jumpHeld = true;
    return;
  }
  if (e.code === 'KeyR') { if (!e.repeat) input.resetCount++; return; }
  if (e.code === 'KeyF') {
    // near / in a vehicle F acts at once; with none around, a hold (≥ CALL_HOLD_MS) calls yours over
    if (!e.repeat) { if (input.vehicleContext !== 'none') input.vehicleCount++; else { hold.key = nowMs(); hold.keyFired = false; } }
    return;
  }
  if (e.code === 'KeyG') { if (!e.repeat) input.glideCount++; return; }
  if (e.code === 'KeyH') { if (!e.repeat) input.hornCount++; return; }
  if (e.code === 'KeyC') { if (!e.repeat) input.camPresetCount++; return; }
  input.keys.add(e.code);
}

export function onKeyUp(e: Pick<KeyboardEvent, 'code'>) {
  input.keys.delete(e.code);
  if (e.code === 'Space') { spaceHeld = false; input.jumpHeld = padHeld; }
  if (e.code === 'KeyF' && hold.key >= 0) { if (!hold.keyFired) input.vehicleCount++; hold.key = -1; }
}

/** F / Y held past CALL_HOLD_MS → one call (checked every frame by pollInput; the release then does nothing). */
function pollHolds(now: number) {
  if (hold.key >= 0 && !hold.keyFired && now - hold.key >= CALL_HOLD_MS) { hold.keyFired = true; input.callVehicleCount++; }
  if (hold.pad >= 0 && !hold.padFired && now - hold.pad >= CALL_HOLD_MS) { hold.padFired = true; input.callVehicleCount++; }
}

export function clearKeys() {
  input.keys.clear();
  hold.key = -1;
  spaceHeld = false;
  input.jumpHeld = false;
  input.stick.active = false; input.stick.x = 0; input.stick.y = 0;
}

let installed = 0;
/** Window keyboard listeners (idempotent, ref-counted). Returns the uninstaller. */
export function installInput(): () => void {
  if (typeof window === 'undefined') return () => {};
  const down = (e: KeyboardEvent) => onKeyDown(e);
  const up = (e: KeyboardEvent) => onKeyUp(e);
  const blur = () => clearKeys();
  const vis = () => { if (document.hidden) clearKeys(); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', vis);
  installed++;
  if (window.matchMedia?.('(pointer: coarse)').matches && runtime.input.device === 'keyboard') runtime.input.device = 'touch';
  return () => {
    installed--;
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    document.removeEventListener('visibilitychange', vis);
    clearKeys();
  };
}

// ---------------------------------------------------------------------------
// Gamepad
// ---------------------------------------------------------------------------

const pad = { prev: [] as boolean[], index: -1 };
const DEAD = 0.18;

function deadzone(x: number, y: number): [number, number] {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * k, y * k];
}

/** Gamepad Y button handler (journal; Y belongs to the vehicle while one is near / ridden) — set by Actors so input stays free of flow imports. */
export const padActions = { journal: null as null | (() => void), settings: null as null | (() => void) };

function pollGamepad(): { mx: number; my: number; run: boolean; analog: boolean } {
  const out = { mx: 0, my: 0, run: false, analog: false };
  input.lookX = 0; input.lookY = 0;
  input.throttle = 0; input.brake = 0;
  padHeld = false;
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  let gp: Gamepad | null = null;
  for (const p of pads) if (p && p.connected) { gp = p; break; }
  if (!gp) return out;
  const [lx, ly] = deadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
  const [rx, ry] = deadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
  const pressed = gp.buttons.map(b => b.pressed || b.value > 0.5);
  const edge = (i: number) => !!pressed[i] && !pad.prev[i];
  const inVehicle = input.vehicleContext === 'in';
  let dx = lx, dy = -ly;
  // in a vehicle the D-pad's up / down pick the camera preset instead of throttle (the triggers drive)
  if (pressed[12] && !inVehicle) dy += 1;
  if (pressed[13] && !inVehicle) dy -= 1;
  if (pressed[14]) dx -= 1;
  if (pressed[15]) dx += 1;
  out.mx = dx; out.my = dy;
  out.analog = Math.abs(lx) > 0 || Math.abs(ly) > 0;
  const trig = (i: number) => { const b = gp!.buttons[i]; return b ? Math.max(b.value || 0, b.pressed ? 1 : 0) : 0; };
  input.throttle = trig(7); input.brake = trig(6);
  // RT runs on foot; in a vehicle it is the throttle and RB sprints / boosts
  out.run = !!pressed[5] || (!inVehicle && !!pressed[7]) || Math.hypot(lx, ly) > 0.94;
  input.lookX = rx; input.lookY = ry;
  const active = Math.abs(dx) + Math.abs(dy) + Math.abs(rx) + Math.abs(ry) > 0 || pressed.some(Boolean);
  if (active) runtime.input.device = 'gamepad';
  if (rx || ry) input.lastCameraInputAt = performance.now();
  if (edge(0)) runtime.input.interact = true; // A
  if (edge(1)) runtime.input.jump = true; // B
  padHeld = !!pressed[1];
  if (edge(2)) runtime.input.call = true; // X
  // Y: enter / exit while a vehicle is near or ridden; otherwise a hold calls your vehicle and a tap opens the journal
  if (edge(3)) { if (input.vehicleContext !== 'none') input.vehicleCount++; else { hold.pad = performance.now(); hold.padFired = false; } }
  // (a short Y with nothing near is still the journal)
  if (!pressed[3] && pad.prev[3] && hold.pad >= 0) { if (!hold.padFired) padActions.journal?.(); hold.pad = -1; }
  if (edge(4)) input.hornCount++; // LB
  if (edge(10)) input.glideCount++; // L3
  if (inVehicle && (edge(12) || edge(13))) input.camPresetCount++; // D-pad up / down
  if (edge(9)) padActions.settings?.(); // Start
  if (edge(11)) input.resetCount++; // right stick click
  pad.prev = pressed;
  return out;
}

// ---------------------------------------------------------------------------
// Per-frame composition
// ---------------------------------------------------------------------------

/** Compose keyboard + touch stick + gamepad into runtime.input.moveX/moveY/run. Call once per frame. */
export function pollInput() {
  const k = input.keys;
  let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
  let run = k.has('ShiftLeft') || k.has('ShiftRight');
  let analog = false;
  if (input.stick.active) {
    x += input.stick.x; y += input.stick.y;
    if (Math.hypot(input.stick.x, input.stick.y) > 0.92) run = true;
    analog = true;
  }
  const gp = pollGamepad();
  x += gp.mx; y += gp.my; run = run || gp.run;
  input.analogSteer = analog || gp.analog;
  pollHolds(nowMs());
  input.jumpHeld = spaceHeld || padHeld;
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  runtime.input.moveX = x;
  runtime.input.moveY = y;
  runtime.input.run = run;
  input.manualMove = m > 0.05;
}

export const inputInstalled = () => installed > 0;
