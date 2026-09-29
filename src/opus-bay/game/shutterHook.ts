/**
 * W6-P4 (lane P, MF9 / D16) · the Canvas ticker's hook into the photo capture without importing it (game/photo.ts and
 * its frame decorators stay out of GameRoot). photo.ts registers its consumer when it loads — with the play layer's
 * photo mode (ui/playParts.tsx) or an activity's lazy chunk — and a shutter can only be requested through photo.ts, so a
 * pressed shutter always finds the consumer (Systems calls this every frame, as it called consumeShutter).
 */
type Consumer = (canvas: HTMLCanvasElement) => void;

let consumer: Consumer | null = null;

export function setShutterConsumer(fn: Consumer | null): void { consumer = fn; }

/** Call from useFrame: game/photo.ts consumeShutter once photo.ts is in (nothing to do before: no shutter yet). */
export function consumeShutter(canvas: HTMLCanvasElement): void { consumer?.(canvas); }
