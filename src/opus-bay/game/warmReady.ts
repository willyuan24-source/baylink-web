import { useSyncExternalStore } from 'react';

/**
 * W9-P1 · "can the game start?" — the warm-ready contract (sf-w9-lead.md §4) and the WebGL probe (the review's R§5 #4 and
 * its R§6 tech row "没有 WebGL 时是死路"). A tiny module of the page's own chunk (OpusBayPage and the title import it; so does
 * GameRoot, which sets the flag): no three, no game state.
 *
 *   warmReady()        true once every shader program the world's first frame needs has linked AND that frame is drawn
 *                      AND the play layer is in (game/GameRoot.tsx sets it). Until then the title's Start shows 准备中…,
 *                      disabled and aria-busy (ui/TitleScreen.tsx): a press during a shader link froze the page for
 *                      seconds (the review: 4.7 s on an idle desktop, 12.6 s on a 4× phone).
 *   useWarmReady()     the same as a React hook.
 *   probeGl(doc)       one throwaway WebGL 2 context before the game mounts (three r186 needs WebGL 2): 'none' (no
 *                      context: the title stays, with the guides / this month / calendar links — the game never mounts),
 *                      'software' (only a software rasteriser: SwiftShader, WARP's Basic Render Driver, llvmpipe — or a
 *                      context only without `failIfMajorPerformanceCaveat`): quality low for the visit + a note, or 'ok'.
 *   glSupport()        the probe's verdict (null before the probe); setGlSupport() records it; useGlSupport() the hook.
 */
export type GlSupport = 'ok' | 'software' | 'none';

let ready = false;
let support: GlSupport | null = null;
const subs = new Set<() => void>();
const notify = () => { for (const f of [...subs]) f(); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const warmReady = (): boolean => ready;
export function setWarmReady(v = true): void { if (ready !== v) { ready = v; notify(); } }
export const useWarmReady = (): boolean => useSyncExternalStore(subscribe, warmReady, warmReady);

export const glSupport = (): GlSupport | null => support;
export function setGlSupport(v: GlSupport | null): void { if (support !== v) { support = v; notify(); } }
export const useGlSupport = (): GlSupport | null => useSyncExternalStore(subscribe, glSupport, glSupport);

/** A renderer string of a software rasteriser (UNMASKED_RENDERER_WEBGL). */
export const SOFTWARE_GL = /swiftshader|basic render driver|llvmpipe|softpipe|software rasterizer|mesa offscreen/i;

type ProbeCanvas = { getContext(type: 'webgl2', attrs?: WebGLContextAttributes): unknown };
type ProbeDoc = { createElement(tag: 'canvas'): ProbeCanvas };

/** One throwaway WebGL 2 context (lost again at once): the verdict and the renderer's name ('' when hidden). */
export function probeGl(doc: ProbeDoc | null = typeof document !== 'undefined' ? document : null): { support: GlSupport; renderer: string } {
  if (!doc?.createElement) return { support: 'ok', renderer: '' };
  const make = (attrs?: WebGLContextAttributes): WebGL2RenderingContext | null => {
    try { return doc.createElement('canvas').getContext('webgl2', attrs) as WebGL2RenderingContext | null; } catch { return null; }
  };
  let gl = make({ failIfMajorPerformanceCaveat: true });
  const caveat = !gl;
  if (!gl) gl = make();
  if (!gl) return { support: 'none', renderer: '' };
  let renderer = '';
  try {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String((info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) ?? '');
  } catch { /* hidden */ }
  try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* the GC frees it */ }
  return { support: caveat || SOFTWARE_GL.test(renderer) ? 'software' : 'ok', renderer };
}

/** Tests. */
export function resetWarmReadyForTests(): void { ready = false; support = null; subs.clear(); }
