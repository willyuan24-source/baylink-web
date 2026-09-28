import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import {
  Binoculars, Bird, BusFront, CableCar, Car, Castle, CircleHelp, CloudFog, Cookie, Crown, Droplets, Fish, Flag, Flower2, Footprints, GraduationCap, Landmark,
  Laugh, Megaphone, Mountain, Navigation, Octagon, Orbit, Phone, Plane, Rainbow, Sailboat, Shell, ShoppingBag, Signpost, Sparkles, Stamp, Store, Sun, TrainFront, TramFront, Trees, Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Bilingual } from '../core/types';
import { ATTRACTION_AREAS, type AttractionArea } from '../data/sf/attractionTypes';
import { discoveredIds, visitedZoneIds } from '../game/discovery';
import { goTo } from '../game/goTo';
import { EGG_AREAS, EGG_AREA_NAMES, EGGS } from '../eggs/registry';
import { useT } from '../i18n';
import { VIEW_SPOTS } from '../play/viewSpots';
import { FootprintsTab } from '../ui/Footprints';
import { itemById, PAGE_ITEM, type PageId } from './items';
import { isPaid, ledgerVersion, playState, subscribeLedger } from './ledger';
import { notebookPages, notebookVersion, stampWorld, subscribeNotebook } from './notebookRun';
import { openShop } from './shopRun';
import { todayLine } from './today';
import { PAGE_COINS, PAGE_NAMES, STAMPS, stamped, type StampDef, type StampGlyph, type StampWorld } from './stamps';
import './economy.css';

/**
 * Wave 5 · lane E · W5-E5: the 手帐 tab of the Journal (ui/slots registerJournalTab 'notebook'). Pages: 印章 (16
 * must-sees + six journeys), 小发现 (lane D's eggs: silhouettes and riddles until found), 看风景 (lane A's view spots,
 * 带我去 for the ones not sat at yet), 足迹 (lane N's page). Each page shows how full it is and what a full page gives
 * (30 金币 and a cosmetic). The header is today's real San Francisco (lane R's sun and moon) and 明天可能不一样 —
 * never a streak. A stamp new since the last look lands with a thud (per viewer, localStorage; none with reduced motion).
 */

type NbPage = PageId | 'steps';
const PAGE_KEY = 'opus-bay:e-notebook-page';
const SEEN_KEY = 'opus-bay:e-notebook-seen:v1';

const STAMP_GLYPHS: Record<StampGlyph, LucideIcon> = {
  Landmark, Sailboat, Waves, Signpost, Castle, Trees, Mountain, ShoppingBag, GraduationCap, Bird, CableCar, TramFront, BusFront, TrainFront,
};

/** Each egg's silhouette / stamp glyph (a shape, never a copy of anything real). */
const EGG_GLYPHS: Record<string, LucideIcon> = {
  'telegraph-hill-parrots': Bird, 'pier39-sea-lion-season': Fish, 'musee-laughing-lady': Laugh, 'chinatown-telephone-exchange': Phone,
  'fortune-cookie-trail': Cookie, 'emperor-norton-bridge-decree': Crown, 'wave-organ-high-tide': Waves, 'crissy-field-dusk-landing': Plane,
  'baybay-otter-roots': Shell, 'octagon-house-time-capsule': Octagon, 'alcatraz-pelican-island': Bird, 'ggb-foghorn-duet': Megaphone,
  'golden-gate-humpback': Fish, 'lands-end-labyrinth': Orbit, 'china-beach-fishermen': Sailboat, 'dahlia-dell-100': Flower2,
  'tiled-steps-sea-to-stars': Sparkles, 'karl-the-fog-diary': CloudFog, 'ingleside-sundial-real-time': Sun, 'golden-hydrant-1906': Droplets,
  'castro-rainbow-steps': Rainbow, 'herons-head-from-above': Bird, 'sf-250-birthday-trail': Flag, 'alta-plaza-chipped-steps': Car,
};

const readJson = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } };
const writeJson = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: this visit only */ } };

/** Keys seen at the last look (the thud plays for the others once). */
function useSeen(keys: readonly string[]): (key: string) => boolean {
  const [seen] = useState(() => new Set(readJson<string[]>(SEEN_KEY, []).filter(k => typeof k === 'string')));
  useEffect(() => {
    const all = new Set([...seen, ...keys]);
    if (all.size !== seen.size) writeJson(SEEN_KEY, [...all].slice(-400));
  }, [keys, seen]);
  return key => seen.has(key);
}

function Disc({ Glyph, ink, on, fresh, tilt, label }: { Glyph: LucideIcon; ink: string; on: boolean; fresh?: boolean; tilt?: number; label?: string }) {
  return (
    <span className={`ob-nb-disc ${on ? 'is-on' : 'is-off'} ${fresh ? 'is-new' : ''}`} style={{ '--ink': ink, '--tilt': `${tilt ?? 0}deg` } as CSSProperties} aria-hidden={label ? undefined : true} aria-label={label}>
      <Glyph size={22} />
    </span>
  );
}

/** A small stable tilt per key (stamps are never quite straight). */
const tiltOf = (key: string) => { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h % 13) + 13) % 13 - 6; };

function PageBar({ id, got, total }: { id: PageId; got: number; total: number }) {
  const { t } = useT();
  const full = total > 0 && got >= total, paid = isPaid(`page:${id}`);
  const item = itemById(PAGE_ITEM[id]);
  return (
    <div className={`ob-nb-bar ${full ? 'is-full' : ''}`}>
      <div className="ob-nb-bar-top">
        <strong>{got}<small>/{total}</small></strong>
        <span>{full && paid ? t(`集满啦！+${PAGE_COINS} 金币，${item?.name.zh ?? ''}在小铺里`, `Full! +${PAGE_COINS} coins; the ${item?.name.en ?? ''} is in the shop`) : t(`集满这一页：+${PAGE_COINS} 金币 · ${item?.name.zh ?? ''}`, `Fill this page: +${PAGE_COINS} coins · ${item?.name.en ?? ''}`)}</span>
        {full && paid && <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={() => openShop('more', item?.shelf)}><Store size={14} aria-hidden />{t('去看看', 'See it')}</button>}
      </div>
      <span className="ob-nb-meter" aria-hidden><span style={{ width: `${total ? Math.min(100, (got / total) * 100) : 0}%` }} /></span>
    </div>
  );
}

function StampsPage({ seen, goSteps, w }: { seen: (k: string) => boolean; goSteps: () => void; w: StampWorld }) {
  const { t } = useT();
  const p = playState();
  const cell = (s: StampDef, i: number) => {
    const on = stamped(p, i, w);
    return (
      <li key={s.id} className={on ? 'is-on' : ''}>
        <Disc Glyph={STAMP_GLYPHS[s.glyph]} ink={s.ink} on={on} fresh={on && !seen(`stamp:${s.id}`)} tilt={tiltOf(s.id)} />
        <span className="ob-nb-cap">{t(s.name)}</span>
      </li>
    );
  };
  const places = discoveredIds().length, zones = visitedZoneIds().length;
  return (
    <>
      <section className="ob-block">
        <h3 className="ob-h3"><Landmark size={15} aria-hidden />{t('必看地标', 'Must-see landmarks')}</h3>
        <ul className="ob-nb-grid">{STAMPS.map((s, i) => (s.group === 'landmark' ? cell(s, i) : null))}</ul>
      </section>
      <section className="ob-block">
        <h3 className="ob-h3"><Stamp size={15} aria-hidden />{t('路上', 'On the way')}</h3>
        <ul className="ob-nb-grid">{STAMPS.map((s, i) => (s.group === 'journey' ? cell(s, i) : null))}</ul>
      </section>
      <button type="button" className="ob-nb-more" onClick={goSteps}>
        <Footprints size={15} aria-hidden />
        <span>{t(`还去过 ${places} 个地方，走过 ${zones} 个街区`, `${places} places found, ${zones} neighbourhoods walked`)}</span>
        <small>{t('足迹 ›', 'Footprints ›')}</small>
      </button>
    </>
  );
}

function FindsPage({ seen }: { seen: (k: string) => boolean }) {
  const { t } = useT();
  return (
    <>
      {EGG_AREAS.map(area => {
        const eggs = EGGS.filter(e => e.area === area);
        if (!eggs.length) return null;
        return (
          <section key={area} className="ob-block">
            <h3 className="ob-h3"><Sparkles size={15} aria-hidden />{t(EGG_AREA_NAMES[area])}</h3>
            <ul className="ob-nb-grid is-finds">
              {eggs.map(e => {
                const on = isPaid(`egg:${e.id}`);
                const G = EGG_GLYPHS[e.id] ?? CircleHelp;
                return (
                  <li key={e.id} className={on ? 'is-on' : 'is-riddle'}>
                    <Disc Glyph={G} ink="#8a5a9c" on={on} fresh={on && !seen(`egg:${e.id}`)} tilt={tiltOf(e.id)} />
                    <span className="ob-nb-cap">{on ? t(e.stamp) : t(e.riddle)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

const VIEW_AREAS: readonly AttractionArea[] = ['north-downtown', 'bridge-presidio', 'coast', 'park-sunset', 'twin-peaks-mission', 'south'];

function ViewsPage({ seen }: { seen: (k: string) => boolean }) {
  const { t } = useT();
  const [going, setGoing] = useState<string | null>(null);
  const go = (id: string, x: number, z: number, name: Bilingual) => {
    setGoing(id);
    void goTo({ point: { x, z }, name }, { source: 'economy:notebook' }).finally(() => setGoing(null));
  };
  return (
    <>
      <p className="ob-muted">{t('在观景点坐下 5 秒，BAYBAY 陪你慢慢看。', 'Sit at a view spot for 5 seconds and BAYBAY takes it in with you.')}</p>
      {VIEW_AREAS.map(area => {
        const spots = VIEW_SPOTS.filter(v => v.area === area && !v.retired);
        if (!spots.length) return null;
        return (
          <section key={area} className="ob-block">
            <h3 className="ob-h3"><Binoculars size={15} aria-hidden />{t(ATTRACTION_AREAS[area])}</h3>
            <ul className="ob-nb-list">
              {spots.map(v => {
                const on = isPaid(`view:${v.id}`);
                return (
                  <li key={v.id} className={on ? 'is-on' : ''}>
                    <Disc Glyph={Binoculars} ink="#b8862f" on={on} fresh={on && !seen(`view:${v.id}`)} tilt={tiltOf(v.id)} />
                    <span className="ob-nb-row-text"><strong>{t(v.name)}</strong><small>{on ? t(v.line) : t('还没坐下来看过', 'Not sat here yet')}</small></span>
                    {!on && (
                      <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" disabled={going === v.id} onClick={() => go(v.id, v.x, v.z, v.name)}>
                        <Navigation size={14} aria-hidden />{t('带我去', 'Take me')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export default function Notebook() {
  const { t } = useT();
  const lv = useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  const nv = useSyncExternalStore(subscribeNotebook, notebookVersion, notebookVersion);
  const [page, setPageState] = useState<NbPage>(() => { const v = readJson<string>(PAGE_KEY, 'stamps'); return (['stamps', 'finds', 'views', 'steps'] as string[]).includes(v) ? (v as NbPage) : 'stamps'; });
  const setPage = (p: NbPage) => { setPageState(p); writeJson(PAGE_KEY, p); };
  const pages = notebookPages();
  // what counts as "seen" now: every stamp, find and view the save holds (the thud plays once for the new ones)
  const p = playState();
  // (read again after each ledger / notebook change)
  const w = useMemo(() => { void lv; void nv; return stampWorld(); }, [lv, nv]);
  const keys = useMemo(() => [
    ...STAMPS.filter((_, i) => stamped(p, i, w)).map(s => `stamp:${s.id}`),
    ...EGGS.filter(e => isPaid(`egg:${e.id}`)).map(e => `egg:${e.id}`),
    ...VIEW_SPOTS.filter(v => isPaid(`view:${v.id}`)).map(v => `view:${v.id}`),
  ], [p, w]);
  const seen = useSeen(keys);
  const today = todayLine();
  const tabs: { id: NbPage; label: string; count?: string }[] = [
    { id: 'stamps', label: t(PAGE_NAMES.stamps), count: pages ? `${pages.stamps.got}/${pages.stamps.total}` : undefined },
    { id: 'finds', label: t(PAGE_NAMES.finds), count: pages ? `${pages.finds.got}/${pages.finds.total}` : undefined },
    { id: 'views', label: t(PAGE_NAMES.views), count: pages ? `${pages.views.got}/${pages.views.total}` : undefined },
    { id: 'steps', label: t('足迹', 'Footprints') },
  ];
  const state = page !== 'steps' ? pages?.[page] : undefined;
  return (
    <div className="ob-nb">
      <header className="ob-nb-head">
        <p className="ob-nb-today">{t(today)}</p>
        <p className="ob-nb-tomorrow">{t('明天可能不一样。', 'Tomorrow may be different.')}</p>
      </header>
      <div className="ob-nb-pages" role="tablist" aria-label={t('手帐的页', 'Notebook pages')}>
        {tabs.map(x => (
          <button key={x.id} type="button" role="tab" aria-selected={page === x.id} className={page === x.id ? 'is-on' : ''} onClick={() => setPage(x.id)}>
            <span>{x.label}</span>{x.count && <small>{x.count}</small>}
          </button>
        ))}
      </div>
      {state && page !== 'steps' && <PageBar id={page} got={state.got} total={state.total} />}
      {page === 'stamps' && <StampsPage seen={seen} goSteps={() => setPage('steps')} w={w} />}
      {page === 'finds' && <FindsPage seen={seen} />}
      {page === 'views' && <ViewsPage seen={seen} />}
      {page === 'steps' && <FootprintsTab embedded />}
    </div>
  );
}
