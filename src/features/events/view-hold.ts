import { useEffect, useRef, useState } from 'react';

/** P28 / N24: a view switch keeps the previous body (dimmed) for 300 ms, then a skeleton that stays at least 400 ms. */
export const DIM_MS = 300, SKELETON_MIN_MS = 400;
/**
 * The phase of a view switch: 'dim' while the next view loads (the previous body stays, at .55, its height held), 'skeleton'
 * once that took 300 ms (and for at least 400 ms, even if the view arrives sooner), else 'idle'. `height` is the previous
 * body's, so the page never collapses while it waits (3800 → 850 → 2400 px before).
 */
export function useViewHold(stale: boolean, body: { current: HTMLElement | null }) {
  const [phase, setPhase] = useState<'idle' | 'dim' | 'skeleton'>('idle');
  const [height, setHeight] = useState(0);
  const shownAt = useRef(0);
  useEffect(() => {
    if (stale) {
      setHeight(body.current?.offsetHeight ?? 0);
      setPhase('dim');
      const timer = setTimeout(() => { shownAt.current = Date.now(); setPhase('skeleton'); }, DIM_MS);
      return () => clearTimeout(timer);
    }
    const left = shownAt.current ? SKELETON_MIN_MS - (Date.now() - shownAt.current) : 0;
    if (left > 0) {
      const timer = setTimeout(() => { shownAt.current = 0; setPhase('idle'); }, left);
      return () => clearTimeout(timer);
    }
    shownAt.current = 0;
    setPhase('idle');
  }, [stale, body]);
  return { phase, height };
}

/**
 * N24 between the column's routes (UI9-R2): /calendar and /events are two route components, so a switch between them
 * mounts a new EventsFrame with no previous body to hold. The frame that unmounts records its body's height here, and
 * the next one, if it mounts within CARRY_MS (an in-app switch), keeps that height under its loading skeleton until its
 * view paints. A later visit (or a full load) starts fresh.
 */
const CARRY_MS = 1500;
let carried = { height: 0, at: 0 };
export function carryHeight(body: HTMLElement | null) {
  carried = { height: body?.offsetHeight ?? 0, at: Date.now() };
}
export function takeCarriedHeight(): number {
  const { height, at } = carried;
  carried = { height: 0, at: 0 };
  return height && Date.now() - at < CARRY_MS ? height : 0;
}
