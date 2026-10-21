import { lazy, Suspense, type ComponentType } from 'react';

/**
 * A cover family whose code loads after the page (UI9-IMG-A0; captain decision 9: route JS ≤ base). `preload()` starts the
 * chunk: a route's `prepare` awaits it (events, calendar), the module that draws it starts it as it loads, and the
 * prerendered page preloads the chunk (scripts/prerender.tsx). Once the chunk is in, the family renders directly, so a page
 * that waited for it, or comes after it, never shows the empty frame; until then the frame stands in (same box, same
 * ground) inside its own boundary, and a failed load keeps it.
 */
export function deferredFamily<P extends object>(load: () => Promise<ComponentType<P>>, Frame: ComponentType<P>) {
  let ready: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;
  const preload = () => pending ??= load().then(face => (ready = face), () => Frame);
  const Lazy = lazy(() => preload().then(face => ({ default: face }))) as unknown as ComponentType<P>;
  const Family = (props: P) => {
    const Ready = ready;
    return Ready ? <Ready {...props} /> : <Suspense fallback={<Frame {...props} />}><Lazy {...props} /></Suspense>;
  };
  return { Family, preload };
}
