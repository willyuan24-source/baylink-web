/**
 * W7-Q9 · the production ?debug=1 overlay's phone lines (ui/Floating.tsx DebugOverlay loads this chunk only with
 * ?debug=1). The owner's machine is Windows: no Web Inspector for an iPhone, so the real-device pass reads these two
 * lines off a screenshot (docs/opus-bay/iphone-checklist.md):
 *
 *   iOS 18.6 Safari · 390×664 · vv 664@0 · safe 47/0/34/0 · dpr 3 → 1.25 · mid (device)
 *   pool batched (multi_draw y) · psc n · cbf y/y · audio running a1 u1 p1 · clips 12 4.1MB ev0 · album idb/p? · lost 0/0
 *
 * viewport = innerWidth × innerHeight; vv = visualViewport height @ offsetTop; safe = env(safe-area-inset-top / right /
 * bottom / left) measured on a probe; dpr = the screen's → the renderer's; the quality and why (world/quality.ts);
 * the city cell pool (batched needs WEBGL_multi_draw, else the tile pool; ?pool= forces one); psc =
 * KHR_parallel_shader_compile; cbf = EXT_color_buffer_float / _half_float; audio = the context's state, a(ctivated),
 * u(nlocked inside a tap), p(rimes); clips = decoded voice clips held, their MB, evicted; album = IndexedDB or memory /
 * persisted (y, n, ?); lost = GL context losses / restores.
 */
import { audioProbe } from '../audio/unlock';
import { albumKind, albumPersistedNow } from '../game/album';
import { qualityDecision } from '../world/quality';
import { game } from '../core/store';
import { glHealth } from './glHealth';

interface RendererLike {
  getPixelRatio?(): number;
  extensions?: { has(name: string): boolean };
}

const yn = (v: boolean | null | undefined) => (v == null ? '?' : v ? 'y' : 'n');

/** "iOS 18.6 Safari", "iOS 17.5 WeChat 8.0.49", "iOS 17.5 CriOS 126", "Android 14 Chrome 140", "Windows Chrome 140" … */
export function shortUa(ua: string): string {
  const ios = /OS (\d+)[_.](\d+)(?:[_.]\d+)? like Mac OS X/.exec(ua);
  const osPart = ios ? `iOS ${ios[1]}.${ios[2]}` : /Android (\d+)/.exec(ua) ? `Android ${/Android (\d+)/.exec(ua)![1]}` : /Macintosh/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '?';
  const app = /MicroMessenger\/([\d.]+)/.exec(ua) ? `WeChat ${/MicroMessenger\/([\d.]+)/.exec(ua)![1]}`
    : /CriOS\/(\d+)/.exec(ua) ? `CriOS ${/CriOS\/(\d+)/.exec(ua)![1]}`
      : /FxiOS\/(\d+)/.exec(ua) ? `FxiOS ${/FxiOS\/(\d+)/.exec(ua)![1]}`
        : /FBAN|FBAV|Instagram|Line\//.test(ua) ? 'in-app'
          : /Edg\/(\d+)/.exec(ua) ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`
            : /Chrome\/(\d+)/.exec(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}`
              : /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}`
                : /Version\/([\d.]+).*Safari/.exec(ua) ? `Safari ${/Version\/([\d.]+).*Safari/.exec(ua)![1]}`
                  : /AppleWebKit/.test(ua) ? 'WebKit' : '?';
  return `${osPart} ${app}`;
}

let probe: HTMLElement | null = null;
/** env(safe-area-inset-*) in px (top/right/bottom/left), measured on a hidden probe. */
function safeArea(): string {
  try {
    if (!probe) {
      probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.append(probe);
    }
    const cs = getComputedStyle(probe);
    return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(v => Math.round(parseFloat(v) || 0)).join('/');
  } catch { return '?'; }
}

function poolKind(r: RendererLike | null): string {
  const forced = /[?&]pool=(tile|batched)(?:&|$)/.exec(location.search)?.[1];
  const multi = r?.extensions?.has('WEBGL_multi_draw');
  const kind = forced ?? (multi == null ? '?' : multi ? 'batched' : 'tile');
  return `pool ${kind}${forced ? ' (forced)' : ''} (multi_draw ${yn(multi)})`;
}

/** The two lines (a snapshot; DebugOverlay refreshes it once a second). */
export function iosDebugLine(): string {
  const r = glHealth.gl as unknown as RendererLike | null;
  const vv = window.visualViewport;
  const decision = qualityDecision();
  const q = game.get().settings.quality;
  const glDpr = r?.getPixelRatio?.();
  const ext = (n: string) => yn(r?.extensions?.has(n));
  const ctx = audioProbe.ctx;
  const mb = (audioProbe.clipBytes / 2 ** 20).toFixed(1);
  const line1 = [
    shortUa(navigator.userAgent),
    `${innerWidth}×${innerHeight}`,
    vv ? `vv ${Math.round(vv.height)}@${Math.round(vv.offsetTop)}` : 'vv ?',
    `safe ${safeArea()}`,
    `dpr ${+devicePixelRatio.toFixed(2)} → ${glDpr != null ? +glDpr.toFixed(2) : '?'}`,
    `${q}${decision ? ` (${decision.reason}${decision.quality !== q ? ` ${decision.quality}→${q}` : ''})` : ''}`,
  ].join(' · ');
  const line2 = [
    poolKind(r),
    `psc ${ext('KHR_parallel_shader_compile')}`,
    `cbf ${ext('EXT_color_buffer_float')}/${ext('EXT_color_buffer_half_float')}`,
    `audio ${ctx ? ctx.state : 'none'} a${+audioProbe.activated} u${+audioProbe.unlocked} p${audioProbe.primes}`,
    `clips ${audioProbe.clips} ${mb}MB ev${audioProbe.evicted}`,
    `album ${albumKind() ?? '-'}/p${yn(albumPersistedNow())}`,
    `lost ${glHealth.losses}/${glHealth.restores}`,
  ].join(' · ');
  return `${line1}\n${line2}`;
}
