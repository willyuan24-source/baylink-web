import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Info, Loader, Navigation, X, ZoomIn } from 'lucide-react';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { goTo } from '../game/goTo';
import type { PlaceTripDest } from '../game/placeTrips';
import { planTrips } from '../game/tripPlan';
import { peekTripProviders, tripProviders, tripRouteCache } from '../game/tripProviders';
import type { TripOption } from '../game/tripTypes';
import { useT } from '../i18n';
import { LINE_ICONS, MODE_ICONS } from './mapIcons';
import { goButtonLabel, optionAria, optionLineGlyph, tripSecondsLabel } from './tripRows';

/**
 * Wave 5 · lane N · W5-N4: the phone map's quick ways to go (plan sf-w5-plan.md MF4 "Phone map"; the pure layout is
 * ui/mapGo.ts). At most two taps from the open map to moving:
 *
 *   <MapGoCard>       pinned over the bottom of the map frame: the selected place (or a long-pressed spot, 去这里), its
 *                     area and time, one big go button with the way and the time (飞过去 · 约 7 秒 / BAYBAY 带路 · 约 1
 *                     分钟), 其他方式 (the full card under the map, its list open), ✕
 *   <ClusterChooser>  the same place for a "+n" badge: its places, each with a small go button, and 放大看看
 *   <RowGo>           that small go button (the chooser's rows, the search results): the way's icon and time; a tap
 *                     goes through goTo() (the planner again with the routes, ≤ 0.9 s)
 *   useQuickWays      the 推荐 way to several places at once from the route cache only (peekTripProviders)
 */

function WayIcon({ o, size = 16 }: { o: TripOption; size?: number }) {
  const glyph = optionLineGlyph(o);
  const Icon = glyph ? LINE_ICONS[glyph] : o.mode === 'walk' || o.mode === 'run' ? Navigation : MODE_ICONS[o.mode];
  return <Icon size={size} aria-hidden />;
}

/** A quick row's destination (the key names it in the result map). */
export interface QuickDest extends PlaceTripDest { key: string }

/** A quick list settles this long (ms) before its first rows ask for their routes (typing in the search) */
const QUICK_SETTLE_MS = 350;

/**
 * The 推荐 way to each destination from where the player stands, again whenever a route lands. The first `requestFirst`
 * destinations ask for their routes once the list has settled (the times then match the trip the go starts: one ETA
 * source), the others answer from the route cache (straight × 1.25 until a route is known). Null for a destination
 * nothing reaches (or the player is there).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useQuickWays(dests: readonly QuickDest[], requestFirst = 0): ReadonlyMap<string, TripOption | null> {
  const [rev, setRev] = useState(0);
  useEffect(() => tripRouteCache().subscribe(() => setRev(r => r + 1)), []);
  const key = dests.map(d => `${d.key}@${Math.round(d.x)},${Math.round(d.z)}`).join('|');
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (!requestFirst || !key) return;
    const id = window.setTimeout(() => setSettled(key), QUICK_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [key, requestFirst]);
  const asking = requestFirst > 0 && settled === key;
  return useMemo(() => {
    const out = new Map<string, TripOption | null>();
    if (!dests.length) return out;
    const from = { x: runtime.player.x, z: runtime.player.z };
    const peek = peekTripProviders(), full = asking ? tripProviders() : peek;
    const recOf = (d: QuickDest, i: number): TripOption | null => {
      try { const options = planTrips(from, d, i < requestFirst ? full : peek); return options.find(o => o.recommended) ?? options[0] ?? null; } catch { return null; }
    };
    dests.forEach((d, i) => out.set(d.key, recOf(d, i)));
    return out;
  }, [key, rev, asking, requestFirst]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** goTo a quick row's destination (the map's big-button source: carried at once); resolves once it started or failed. */
// eslint-disable-next-line react-refresh/only-export-components
export function goQuick(d: QuickDest): Promise<boolean> {
  const target = { placeId: d.attraction ?? d.placeId, point: { x: d.x, z: d.z }, ...(d.name ? { name: d.name } : {}) };
  return goTo(target, { source: 'map' }).then(r => r.ok, () => false);
}

/** The small go button of a row: [icon] 约 7 秒 (the aria label says the way). */
export function RowGo({ option, onGo, busy = false }: { option: TripOption | null | undefined; onGo: () => void; busy?: boolean }) {
  const { t } = useT();
  if (!option) return null;
  return (
    <button type="button" className={`mw-rowgo${option.mode === 'fly' ? ' is-fly' : ''}`} onClick={e => { e.stopPropagation(); onGo(); }} disabled={busy}
      aria-label={t({ zh: `出发：${optionAria(option).zh}`, en: `Go: ${optionAria(option).en}` })}>
      {busy ? <Loader size={15} aria-hidden className="mw-spin" /> : <WayIcon o={option} size={15} />}
      <span>{t(tripSecondsLabel(option.seconds))}</span>
    </button>
  );
}

/**
 * The card pinned over the map (phones; a long-pressed spot on every device). `option` = the planner's 推荐 (the same
 * one the full card's button takes: one ETA source); `busy` while the first plan is still coming; none: no way there.
 */
export function MapGoCard({ title, meta, option, busy = false, onGo, onMore, onClose, short = false, noWay, more = 'ways' }: {
  title: Bilingual; meta?: string | null; option: TripOption | null; busy?: boolean; onGo: (o: TripOption) => void; onMore?: (() => void) | null; onClose: () => void;
  /** a short frame: title and meta on one line */
  short?: boolean;
  /** the words when nothing reaches it (default: 这里暂时去不了) */
  noWay?: Bilingual;
  /** what the button beside the go opens: the full card's other ways (default) or an event's card ('info') */
  more?: 'ways' | 'info';
}) {
  const { t } = useT();
  const [going, setGoing] = useState(false);
  useEffect(() => { setGoing(false); }, [title.zh, title.en]);
  return (
    <div className={`mw-gocard${short ? ' is-short' : ''}`} role="group" aria-label={t(title)} onPointerDown={e => e.stopPropagation()}>
      <div className="mw-gocard-head">
        <strong title={t(title)}>{t(title)}</strong>
        {meta && <small>{meta}</small>}
        <button type="button" className="mw-gocard-x" onClick={onClose} aria-label={t('关闭', 'Close')}><X size={16} aria-hidden /></button>
      </div>
      <div className="mw-gocard-row">
        {option ? (
          <button type="button" className="ob-btn ob-btn-primary mw-go" disabled={going} aria-label={t(optionAria(option))}
            onClick={() => { setGoing(true); onGo(option); }}>
            <WayIcon o={option} /><span>{t(goButtonLabel(option))}</span>
          </button>
        ) : (
          <span className="mw-gocard-wait" aria-live="polite">
            {busy ? <><Loader size={15} aria-hidden className="mw-spin" />{t('BAYBAY 在看路线…', 'BAYBAY is checking the way…')}</> : t(noWay ?? { zh: '这里暂时去不了', en: 'No way there right now' })}
          </span>
        )}
        {onMore && (more === 'info'
          ? <button type="button" className="ob-icon-btn mw-44 mw-gocard-more" onClick={onMore} aria-label={t('活动详情', 'Event details')}><Info size={18} aria-hidden /></button>
          : <button type="button" className="ob-icon-btn mw-44 mw-gocard-more" onClick={onMore} aria-label={t('其他方式和详情', 'Other ways and details')}><ChevronDown size={18} aria-hidden /></button>)}
      </div>
    </div>
  );
}

/** One place of a "+n" badge. */
export interface ChooserRow extends QuickDest { name: Bilingual; sub?: string | null }

/** The "+n" badge's places over the map: a row each (tap: select it; its go button: go at once), 放大看看, ✕. */
export function ClusterChooser({ rows, ways, onPick, onZoom, onClose }: {
  rows: readonly ChooserRow[]; ways: ReadonlyMap<string, TripOption | null>; onPick: (r: ChooserRow) => void; onZoom: () => void; onClose: () => void;
}) {
  const { t } = useT();
  const [going, setGoing] = useState<string | null>(null);
  return (
    <div className="mw-gocard mw-chooser" role="group" aria-label={t('这里的地方', 'Places here')} onPointerDown={e => e.stopPropagation()}>
      <div className="mw-gocard-head">
        <strong>{t({ zh: `这里有 ${rows.length} 个地方`, en: `${rows.length} places here` })}</strong>
        <button type="button" className="mw-chooser-zoom" onClick={onZoom}><ZoomIn size={15} aria-hidden /><span>{t('放大看看', 'Zoom in')}</span></button>
        <button type="button" className="mw-gocard-x" onClick={onClose} aria-label={t('关闭', 'Close')}><X size={16} aria-hidden /></button>
      </div>
      <ul className="mw-chooser-list">
        {rows.map(r => (
          <li key={r.key}>
            <button type="button" className="mw-chooser-name" onClick={() => onPick(r)}>
              <span>{t(r.name)}</span>
              {r.sub && <small>{r.sub}</small>}
            </button>
            <RowGo option={ways.get(r.key)} busy={going === r.key} onGo={() => { setGoing(r.key); void goQuick(r).then(ok => { if (!ok) setGoing(null); }); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
