import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Bilingual } from '../core/types';
import { useT } from '../i18n';
import { type StripStation, stripLayout } from './subwayStrip';
import './transit-ui.css';

/**
 * The subway overlay (wave 4 · lane T, plan §3.3): no tunnel geometry is built, so a Muni Metro ride underground shows
 * this full-screen layer instead of the world — dark, tunnel lamps streaking past (CSS only; still under reduced
 * motion), a line strip across the top with the stations and a moving dot, and a card with the line, the destination,
 * the next stop and its time, the tunnel's name and one checked fact. At a station the card offers 在这站下车 (the only
 * way off underground: it fades out and places you at that station's kiosk); while moving it says 隧道里不能下车.
 * Near a mouth whose surface is still streaming in it says 马上出隧道…
 *
 * Prop-driven (integration: game/transit.ts feeds it from the LightRailSystem's RailRideStatus each frame and mounts it
 * in ui/Floating.tsx next to the travel veil; nothing mounts it yet). The 0.6 s fade in / out is the `visible` prop.
 */

export interface SubwayOverlayProps {
  visible: boolean;
  line: { short: string; name: Bilingual; color: string };
  /** where the ride goes (the destination station) */
  destination: Bilingual;
  /** the tunnel span and its stations (TransitTunnel + the line's stops) */
  tunnel: { fromAt: number; toAt: number; name?: Bilingual; fact?: Bilingual; portalA?: Bilingual | null; portalB?: Bilingual | null };
  stations: StripStation[];
  at: number;
  dir: 1 | -1;
  /** moving (streaks run) or standing at a station */
  moving: boolean;
  stopped: string | null;
  next: { id: string; name: Bilingual; eta: number } | null;
  portalWait?: boolean;
  onAlight?: () => void;
}

const STRIP_PAD = 16;

export function SubwayOverlay(p: SubwayOverlayProps) {
  const { t, locale } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(Math.max(120, el.clientWidth - STRIP_PAD * 2)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const zh = locale !== 'en';
  const lay = stripLayout({
    stations: p.stations, fromAt: p.tunnel.fromAt, toAt: p.tunnel.toAt, at: p.at, dir: p.dir,
    portalA: p.tunnel.portalA, portalB: p.tunnel.portalB, stopped: p.stopped, next: p.next?.id ?? null, width,
  }, zh);
  const style = { '--ob-line-color': p.line.color } as CSSProperties;
  const stoppedAt = p.stopped ? p.stations.find(s => s.id === p.stopped) : null;
  return (
    <div ref={ref} className={`ob-subway ${p.visible ? 'is-on' : ''} ${p.moving ? 'is-moving' : ''}`} style={style} role="status" aria-live="polite" aria-hidden={!p.visible}>
      <div className="ob-subway-tunnel" aria-hidden>
        <i /><i /><i /><i /><i /><i />
      </div>
      <div className="ob-subway-strip" aria-hidden>
        <div className="ob-subway-bar" />
        {lay.ticks.map(k => <span key={k.id} className={`ob-subway-tick is-${k.state}`} style={{ left: STRIP_PAD + k.x * width }} />)}
        {lay.labels.map(l => (
          <span key={l.id} className={`ob-subway-label is-${l.row} is-${l.state} is-${l.kind}`} style={{ left: STRIP_PAD + l.left, width: l.w }}>
            {t(l.text)}
          </span>
        ))}
        <span className="ob-subway-dot" style={{ left: STRIP_PAD + lay.dot * width }} />
      </div>
      <div className="ob-subway-card">
        <div className="ob-subway-line">
          <b className="ob-subway-disc">{p.line.short}</b>
          <span>{t(p.line.name)} · {t('开往', 'to')} {t(p.destination)}</span>
        </div>
        {stoppedAt
          ? <div className="ob-subway-next">{t({ zh: `${stoppedAt.name.zh}到了`, en: `${stoppedAt.name.en} — doors open` })}</div>
          : p.next && <div className="ob-subway-next">{t('下一站', 'Next')} {t(p.next.name)} · {t(`约 ${Math.max(1, Math.round(p.next.eta))} 秒`, `~${Math.max(1, Math.round(p.next.eta))}s`)}</div>}
        {p.portalWait && <div className="ob-subway-note">{t('马上出隧道…', 'Coming out of the tunnel…')}</div>}
        {(p.tunnel.name || p.tunnel.fact) && (
          <div className="ob-subway-fact">
            {p.tunnel.name && <b>{t(p.tunnel.name)}</b>}
            {p.tunnel.fact && <span>{t(p.tunnel.fact)}</span>}
          </div>
        )}
        {stoppedAt && p.onAlight
          ? <button type="button" className="ob-subway-alight" onClick={p.onAlight}>{t('在这站下车', 'Get off here')}</button>
          : <div className="ob-subway-note is-muted">{t('隧道里不能下车', 'No getting off inside the tunnel')}</div>}
      </div>
    </div>
  );
}
