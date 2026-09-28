import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Backpack, Bike, BookOpen, Car, Check, Compass, Info, Lock, Plane, Ribbon, Search, Store, Ticket } from 'lucide-react';
import { charApi } from '../actors/charApi';
import { glideUnlocked, subscribeGlide } from '../actors/moveApi';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import type { WearSlot } from '../data/playSave';
import { holdFraming, releaseFraming } from '../game/cinema';
import { isDiscovered } from '../game/discovery';
import { holdLock } from '../game/playerLock';
import { useT } from '../i18n';
import { Sheet } from '../ui/common';
import { useIsMobile } from '../ui/hooks';
import { openJournal, openOverlay, type OverlayProps } from '../ui/slots';
import { isMarketOpen } from '../world/clock';
import { drawPreview } from './frames';
import { EARN_NAMES, SHELVES, SLOT_NAMES, forSale, shelfItems, type FrameKind, type HatKind, type ItemDef, type Shelf } from './items';
import { coinsTotal, ledgerVersion, subscribeLedger } from './ledger';
import { sayWhenFree } from './lines';
import { buy, canBuy, holds, owns, takeOff, wear, wornItem } from './wallet';
import { compassStarted, flyWithTicket, magnifierStarted, pelicanOut, type ShopProps } from './shopRun';
import { clearPreview, setPreview } from './wear';
import './economy.css';

/**
 * Wave 5 · lane E · W5-E6: the BAYBAY 小铺 sheet (ui/slots overlay 'e-shop') and the 飞行券 picker ('e-ticket').
 *
 * Phones: a bottom sheet at 38 % height (the world and BAYBAY stay in view above it), shelves as chips, one row of big
 * tiles, the chosen item's line and its one button in the footer. Desktop: the side sheet with a tile grid.
 * While open: the feet are held (`holdLock('shop')`) and the camera frames BAYBAY and you (a two-shot); tapping a tile
 * TRIES IT ON (a preview on the real bodies: BAYBAY turns to show it), and closing drops every try-on. Paints try on
 * the rides in the world; frames show on a small card in the tile. Prices are fixed and shown; nothing sells speed,
 * access or places.
 */

const usePelican = () => useSyncExternalStore(subscribeGlide, pelicanOut, pelicanOut);
const useLedger = () => useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);

/** BAYBAY within this of you (u): the camera frames the two of you; farther, it stays where it is */
const FRAME_NEAR = 10;
const BAYBAY_SLOTS: ReadonlySet<string> = new Set(['baybay-scarf', 'baybay-hat']);
const PLAYER_SLOTS: ReadonlySet<string> = new Set(['player-hat', 'player-pack']);

// --- tile pictures -------------------------------------------------------------------------------------------------

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function ScarfArt({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
      <path d="M8 16c8 5 24 5 32 0l-1 7c-8 5-22 5-30 0z" fill={color} />
      <path d="M28 22l6 18-6 1-4-17z" fill={color} />
      <path d="M28 22l6 18-6 1-4-17z" fill="#000" opacity=".12" />
      <path d="M31 38l2 5M29 39l1 5M34 37l3 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 18c8 4 22 4 30 0" stroke="#fff" strokeOpacity=".35" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

function HatArt({ kind }: { kind: HatKind }) {
  if (kind === 'beanie') {
    return (
      <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
        <path d="M11 32c0-12 6-19 13-19s13 7 13 19z" fill="#b8453f" />
        <path d="M17 18c3 3 11 3 14 0M14 24c5 3 15 3 20 0" stroke="#9c3833" strokeWidth="1.5" fill="none" />
        <rect x="9" y="30" width="30" height="7" rx="3.5" fill="#f3e6cc" />
        <circle cx="24" cy="11" r="4.5" fill="#f7eedb" />
      </svg>
    );
  }
  if (kind === 'sun') {
    return (
      <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
        <ellipse cx="24" cy="31" rx="21" ry="7" fill="#e8cf8a" />
        <path d="M15 30c0-9 4-14 9-14s9 5 9 14z" fill="#e3c67d" />
        <path d="M15 27.5c5 2 13 2 18 0v3c-5 2-13 2-18 0z" fill="#1f8f8a" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
      <path d="M12 20c6-3 18-3 24 0l-2 13c-6 2-14 2-20 0z" fill="#f4f1e6" stroke="#d9d3c3" strokeWidth=".8" />
      <ellipse cx="24" cy="19" rx="13" ry="3.4" fill="#fbfaf5" stroke="#d9d3c3" strokeWidth=".8" />
      <path d="M14 29c6 2 14 2 20 0v4c-6 2-14 2-20 0z" fill="#26374f" />
      <path d="M17 33c4 5 10 5 14 0" fill="#141d2b" />
      <circle cx="24" cy="31" r="1.8" fill="#e0a94a" />
    </svg>
  );
}

function BucketHatArt({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden>
      <path d="M6 31c4-3 32-3 36 0-4 4-32 4-36 0z" fill={color} />
      <path d="M13 29c0-9 5-14 11-14s11 5 11 14z" fill={color} />
      <path d="M13 26c5 2 17 2 22 0v3c-5 2-17 2-22 0z" fill="#000" opacity=".2" />
    </svg>
  );
}

function FrameArt({ kind }: { kind: FrameKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawPreview(kind, ref.current); }, [kind]);
  return <canvas ref={ref} width={96} height={80} className="ob-shop-frame-art" aria-hidden />;
}

function GlyphArt({ color, children }: { color: string; children: ReactNode }) {
  return <span className="ob-shop-glyph" style={{ background: color }}>{children}</span>;
}

function ItemArt({ it }: { it: ItemDef }) {
  if (it.slot === 'baybay-scarf') return <ScarfArt color={hex(it.color!)} />;
  if (it.hat) return <HatArt kind={it.hat} />;
  if (it.slot === 'player-hat') return <BucketHatArt color={hex(it.color!)} />;
  if (it.slot === 'player-pack') return <GlyphArt color={hex(it.color!)}><Backpack size={24} aria-hidden /></GlyphArt>;
  if (it.slot === 'bike') return <GlyphArt color={it.swatch!}><Bike size={24} aria-hidden /></GlyphArt>;
  if (it.slot === 'car') return <GlyphArt color={it.swatch!}><Car size={24} aria-hidden /></GlyphArt>;
  if (it.slot === 'pelican') return <GlyphArt color={it.swatch!}><Ribbon size={24} aria-hidden /></GlyphArt>;
  if (it.frame) return <FrameArt kind={it.frame} />;
  if (it.use === 'compass') return <GlyphArt color="#3f7f8f"><Compass size={24} aria-hidden /></GlyphArt>;
  if (it.use === 'magnifier') return <GlyphArt color="#b8862f"><Search size={24} aria-hidden /></GlyphArt>;
  return <GlyphArt color="#1f8f8a"><Ticket size={24} aria-hidden /></GlyphArt>;
}

// --- the sheet -------------------------------------------------------------------------------------------------------

type Tile = { it: ItemDef; owned: boolean; worn: boolean; locked: boolean; held: boolean };

export function ShopSheet({ props, close }: OverlayProps) {
  const { t } = useT();
  useLedger();
  const pelican = usePelican();
  const mobile = useIsMobile();
  const p = (props ?? {}) as ShopProps;
  const [shelf, setShelf] = useState<Shelf>(() => (SHELVES.some(s => s.id === p.shelf) ? (p.shelf as Shelf) : 'baybay'));
  const [sel, setSel] = useState<string | null>(null);
  const [said, setSaid] = useState<Bilingual | null>(null);
  const balance = coinsTotal();
  const market = isMarketOpen();

  // the feet held, the camera on BAYBAY and you above the sheet (when she is close by), the try-ons dropped on close
  useEffect(() => {
    const release = holdLock('shop', 'e-shop');
    const near = Math.hypot(runtime.guide.x - runtime.player.x, runtime.guide.z - runtime.player.z) < FRAME_NEAR;
    const token = near ? holdFraming({ kind: 'two-shot', bottomCover: mobile ? 0.42 : 0.5 }) : 0;
    emit({ type: 'shop', what: 'open' });
    return () => { release(); if (token) releaseFraming(token); clearPreview(); emit({ type: 'shop', what: 'close' }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // a shelf chosen from outside (openShop(from, shelf)) while open
  useEffect(() => { if (p.shelf && SHELVES.some(s => s.id === p.shelf)) setShelf(p.shelf as Shelf); }, [p.shelf]);

  const tiles: Tile[] = shelfItems(shelf, pelican).map(it => {
    const owned = owns(it.id);
    return { it, owned, worn: it.slot !== 'use' && wornItem(it.slot as WearSlot)?.id === it.id, locked: !!it.earn && !owned, held: it.slot === 'use' && owned };
  });
  const groups: { slot: WearSlot | 'use'; tiles: Tile[] }[] = [];
  for (const tile of tiles) { const g = groups.find(x => x.slot === tile.it.slot); if (g) g.tiles.push(tile); else groups.push({ slot: tile.it.slot, tiles: [tile] }); }
  const chosen = sel ? tiles.find(x => x.it.id === sel) ?? null : null;

  const pick = (tile: Tile) => {
    setSel(tile.it.id);
    setSaid(null);
    const slot = tile.it.slot;
    if (slot === 'use') return;
    setPreview(slot, tile.it.id);
    const api = charApi();
    if (BAYBAY_SLOTS.has(slot)) api?.emote('baybay', 'pose');
    else if (PLAYER_SLOTS.has(slot)) api?.emote('player', 'pose');
  };
  const pickShelf = (s: Shelf) => { setShelf(s); setSel(null); setSaid(null); clearPreview(); };

  const onBuy = (it: ItemDef) => {
    const r = buy(it.id, { pelican: glideUnlocked() || pelican });
    if (r !== 'ok') { setSaid(r === 'short' ? { zh: '金币还不够哦，去捡一些再来。', en: 'Not enough coins yet — collect a few more.' } : null); return; }
    if (it.slot !== 'use') { clearPreview(); charApi()?.emote(BAYBAY_SLOTS.has(it.slot) ? 'baybay' : 'player', 'cheer'); sayWhenFree('bought', 3); }
    if (it.use === 'compass') compassStarted();
    if (it.use === 'magnifier') magnifierStarted();
    setSaid(null);
  };

  const footer = chosen ? <Footer tile={chosen} balance={balance} said={said} onBuy={onBuy} onClose={close} /> : (
    <p className="ob-shop-hint">{said ? t(said) : t('点一件试试看：BAYBAY 会转过来给你看。', 'Tap one to try it on — BAYBAY turns round to show you.')}</p>
  );

  return (
    <Sheet
      className="ob-shop"
      snap={38}
      eyebrow={<><Store size={14} aria-hidden />{t('小铺', 'Shop')}</>}
      title={t('BAYBAY 小铺', 'BAYBAY’s shop')}
      headerExtra={<span className="ob-shop-balance" aria-label={t(`金币 ${balance}`, `${balance} coins`)}><span aria-hidden>🪙</span>{balance}</span>}
      onClose={close}
      footer={footer}
    >
      {market && <p className="ob-shop-note">{t('今天集市，小铺在「更多」里。', 'Market day: the stall is the farmers’ today — the shop is under More.')}</p>}
      <div className="ob-shop-shelves" role="tablist" aria-label={t('货架', 'Shelves')}>
        {SHELVES.map(s => (
          <button key={s.id} type="button" role="tab" aria-selected={shelf === s.id} className={shelf === s.id ? 'is-on' : ''} onClick={() => pickShelf(s.id)}>{t(s.name)}</button>
        ))}
      </div>
      <div className="ob-shop-groups">
        {groups.map(g => (
          <section key={g.slot} className="ob-shop-group" aria-label={t(SLOT_NAMES[g.slot])}>
            {!mobile && <h3 className="ob-shop-group-h">{t(SLOT_NAMES[g.slot])}</h3>}
            <ul className="ob-shop-tiles">
              {g.tiles.map(tile => (
                <li key={tile.it.id}>
                  <button
                    type="button"
                    className={`ob-shop-tile ${sel === tile.it.id ? 'is-sel' : ''} ${tile.worn ? 'is-worn' : ''} ${tile.locked ? 'is-locked' : ''}`}
                    aria-pressed={sel === tile.it.id}
                    aria-label={`${t(tile.it.name)} · ${tile.worn ? t('穿着', 'wearing') : tile.held ? t('已有一张', 'one held') : tile.owned ? t('已拥有', 'owned') : tile.locked ? t(EARN_NAMES[tile.it.earn!]) : t(`${tile.it.price} 金币`, `${tile.it.price} coins`)}`}
                    onClick={() => pick(tile)}
                  >
                    <span className="ob-shop-art"><ItemArt it={tile.it} /></span>
                    <span className="ob-shop-name">{t(tile.it.short)}</span>
                    <span className="ob-shop-price">
                      {tile.worn ? <><Check size={12} aria-hidden />{t('穿着', 'On')}</>
                        : tile.held ? t('有一个', 'Held')
                          : tile.owned ? t('已拥有', 'Owned')
                            : tile.locked ? <Lock size={12} aria-label={t('手帐奖励', 'Notebook reward')} />
                              : <><span aria-hidden>🪙</span>{tile.it.price}</>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function Footer({ tile, balance, said, onBuy, onClose }: { tile: Tile; balance: number; said: Bilingual | null; onBuy: (it: ItemDef) => void; onClose: () => void }) {
  const { t } = useT();
  const { it } = tile;
  const pelican = usePelican();
  let action: ReactNode = null;
  if (tile.locked) {
    action = <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={() => { onClose(); openJournal('notebook'); }}><BookOpen size={15} aria-hidden />{t('去手帐', 'Notebook')}</button>;
  } else if (it.slot === 'use') {
    if (it.use === 'fly-ticket' && tile.held) action = <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" onClick={() => openOverlay('e-ticket')}><Plane size={15} aria-hidden />{t('用飞行券', 'Use it')}</button>;
    else if (tile.held) action = <span className="ob-shop-on">{it.use === 'compass' ? t('罗盘开着：看右上角的箭头', 'On: follow the arrow top right') : t('放大镜开着：找金色小旗', 'On: look for the gold flags')}</span>;
  } else if (tile.owned) {
    const slot = it.slot as WearSlot;
    action = tile.worn
      ? <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={() => { takeOff(slot); clearPreview(); }}>{t('取下', 'Take off')}</button>
      : <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" onClick={() => { wear(it.id); clearPreview(); }}>{t('穿上', 'Wear')}</button>;
  }
  if (!action && forSale(it) && !tile.owned) {
    const why = canBuy(it.id, { pelican });
    action = why === 'short'
      ? <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" disabled>{t(`还差 ${it.price - balance} 金币`, `${it.price - balance} more coins`)}</button>
      : <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" disabled={why !== 'ok'} onClick={() => onBuy(it)}>{t('买下', 'Buy')} · <span aria-hidden>🪙</span>{it.price}</button>;
  }
  const line = said ?? (tile.locked ? EARN_NAMES[it.earn!] : it.note ?? null);
  return (
    <div className="ob-shop-foot">
      <div className="ob-shop-foot-text">
        <strong>{t(it.name)}</strong>
        {line && <small>{t(line)}{it.source && !said && !tile.locked && <a className="ob-shop-src" href={it.source.url} target="_blank" rel="noopener noreferrer" title={t(`来源（${it.source.verifiedAt} 核对）`, `Source (checked ${it.source.verifiedAt})`)}><Info size={12} aria-label={t('来源', 'Source')} /></a>}</small>}
      </div>
      {action}
    </div>
  );
}

// --- the 飞行券 picker -------------------------------------------------------------------------------------------------

interface Dest { id: string; name: Bilingual; x: number; z: number; look: { x: number; z: number }; seen: boolean; d: number }

/** The 16 must-sees, the ones not visited first, then the farthest first (a ticket is for going far). */
function useDestinations(): Dest[] | null {
  const [list, setList] = useState<Dest[] | null>(null);
  useEffect(() => {
    let live = true;
    void import('../data/sf/attractions').then(m => {
      if (!live) return;
      const p = { x: runtime.player.x, z: runtime.player.z };
      const out = m.ATTRACTIONS.filter(a => a.rank === 1 && !a.offWalk).map(a => {
        const d = m.tripDestination(a);
        return { id: d.placeId, name: d.name, x: d.x, z: d.z, look: { x: a.x, z: a.z }, seen: isDiscovered(d.placeId), d: Math.hypot(d.x - p.x, d.z - p.z) };
      }).filter(d => d.d > 60);
      out.sort((a, b) => Number(a.seen) - Number(b.seen) || b.d - a.d);
      setList(out);
    });
    return () => { live = false; };
  }, []);
  return list;
}

export function TicketPicker({ close }: OverlayProps) {
  const { t } = useT();
  useLedger();
  const pelican = usePelican();
  const list = useDestinations();
  const held = holds('fly-ticket');
  const [failed, setFailed] = useState(false);
  const rows = useMemo(() => list ?? [], [list]);
  useEffect(() => { if (pelican) close(); }, [pelican, close]);
  return (
    <Sheet className="ob-ticket" snap={60} eyebrow={<><Ticket size={14} aria-hidden />{t('飞行券', 'Flight ticket')}</>} title={t('用飞行券飞去哪里？', 'Where shall we fly?')} onClose={close}>
      <p className="ob-muted">{held ? t('飞一次用掉一张。还没去过的地方，落地就算第一次来。', 'One flight uses the ticket. A place you have not been to counts as found when you land.') : t('飞行券用完了，小铺里还有。', 'No ticket left — the shop has more.')}</p>
      {failed && <p className="ob-shop-note">{t('现在飞不了，先下车或走到空地上再试。', 'Can’t take off right now — get off or step into the open and try again.')}</p>}
      {!list && <p className="ob-muted">{t('地点加载中…', 'Loading places…')}</p>}
      <ul className="ob-ticket-list">
        {rows.map(d => (
          <li key={d.id}>
            <button type="button" disabled={!held} onClick={() => { if (!flyWithTicket(d)) setFailed(true); }}>
              <span className="ob-ticket-name">{t(d.name)}</span>
              {!d.seen && <span className="ob-ticket-new">{t('没去过', 'New')}</span>}
              <Plane size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

