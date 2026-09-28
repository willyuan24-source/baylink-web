import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Ear, ExternalLink, Gem, Sparkles } from 'lucide-react';
import { runtime } from '../core/runtime';
import { game, useGame } from '../core/store';
import type { Bilingual } from '../core/types';
import { useT } from '../i18n';
import type { OverlayProps } from '../ui/slots';
import { cardEntry, type CardEntry, type CardKind } from './cards';
import './eggs.css';

/**
 * Wave 5 · lane D (W5-D2) · the find card (plan §3.1 UI): a small card above the phone bar (desktop: bottom-left, like
 * the arrival card). Compact first — 小发现 · +10 金币 and the name — then, on a tap (phones) or E (desktop), the fact and
 * its sources with the day they were checked (DESIGN §8). The compact card leaves by itself after CARD_MS unless the
 * pointer or the focus is on it; an opened card stays until × / Esc / E. Registered as the `egg-card` overlay (ui/slots);
 * props: `{ id, coins?, kind? }` (part c: `kind` 'sound' — 城市之声 — and 'pebble' — BAYBAY's pebbles — use the same card;
 * an egg with a secret postcard, lane V's W5-V8, shows it when the card is opened).
 */

export const CARD_MS = 6000;
export interface FactCardProps { id: string; coins?: number; kind?: CardKind }

const BADGE = { egg: Sparkles, sound: Ear, pebble: Gem } as const;

/** The opened card: the secret postcard (an egg that has one), the fact, its sources and the day they were checked. */
export function CardBody({ entry }: { entry: CardEntry }) {
  const { t } = useT();
  const sources = entry.sources;
  return (
    <div className="ob-egg-body">
      {entry.postcard && (
        <figure className="ob-egg-postcard">
          <img src={entry.postcard.small} alt={t(entry.postcard.alt)} width={600} height={450} loading="lazy" decoding="async" />
          <figcaption>{t('彩蛋明信片', 'Secret postcard')} · {t(entry.postcard.title)}</figcaption>
        </figure>
      )}
      <p className="ob-egg-fact">{t(entry.fact)}</p>
      {sources.length > 0 && (
        <p className="ob-egg-sources">
          <span>{t('出处', 'Sources')}</span>
          {sources.map(s => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
              {host(s.url)}<ExternalLink size={11} aria-hidden />
            </a>
          ))}
          <small>{t(`${sources[0].verifiedAt} 核对`, `checked ${sources[0].verifiedAt}`)}</small>
        </p>
      )}
    </div>
  );
}

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/** E on desktop opens / closes the card when nothing else is in focus (or the focus is an egg's or a city sound's own spot). */
const cardKeyFree = (f: string | null | undefined) => !f || f.startsWith('egg:') || f.startsWith('sound:');
const keyForCard = () => cardKeyFree(game.get().focus);

/** A paper closes itself when the player walks (or is carried) more than `r` u away from where it opened. */
function useWalkAway(close: () => void, r = 8) {
  const ref = useRef(close);
  useEffect(() => { ref.current = close; }, [close]);
  useEffect(() => {
    const x0 = runtime.player.x, z0 = runtime.player.z;
    const id = window.setInterval(() => { if (Math.hypot(runtime.player.x - x0, runtime.player.z - z0) > r) ref.current(); }, 400);
    return () => window.clearInterval(id);
  }, [r]);
}

/** The arrival card (lane N) owns the same corner: the find card stands above it while it is up. */
function useAboveArrival(): boolean {
  const [raised, setRaised] = useState(false);
  useEffect(() => {
    const check = () => setRaised(!!document.querySelector('.ob-arrival-card'));
    check();
    const id = window.setInterval(check, 400);
    return () => window.clearInterval(id);
  }, []);
  return raised;
}

export function FactCard({ props, close }: OverlayProps) {
  const { t } = useT();
  const p = (props ?? {}) as FactCardProps;
  const entry = cardEntry(p.kind ?? 'egg', p.id);
  const [open, setOpen] = useState(false);
  // the E keycap only when E opens the card (another prompt in focus keeps E for itself)
  const eOpens = useGame(s => cardKeyFree(s.focus));
  const [held, setHeld] = useState(false);
  const raised = useAboveArrival();
  const left = useRef(CARD_MS);
  const state = useRef({ open, close });
  useEffect(() => { state.current = { open, close }; }, [open, close]);
  // the compact card's timer (paused while held; gone once opened)
  useEffect(() => {
    if (held || open) return;
    const start = performance.now();
    const id = window.setTimeout(() => state.current.close(), left.current);
    return () => { window.clearTimeout(id); left.current = Math.max(900, left.current - (performance.now() - start)); };
  }, [held, open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code !== 'KeyE' || !keyForCard()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state.current.open) state.current.close(); else setOpen(true);
    };
    // capture: before the game's own E (flow's interact) sees it
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  if (!entry) return null;
  const coins = p.coins ?? entry.coins;
  const Badge = BADGE[entry.kind];
  return (
    <section
      className={`ob-egg-card is-${entry.kind} ${open ? 'is-open' : ''} ${raised ? 'is-raised' : ''}`}
      aria-label={t(entry.name)}
      onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false); }}
      style={{ ['--ob-egg-ms' as string]: `${CARD_MS}ms` }}
    >
      <button type="button" className="ob-egg-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="ob-egg-badge" aria-hidden><Badge size={24} /></span>
        <span className="ob-egg-titles">
          <span className="ob-egg-kicker">{t(entry.kicker)}{coins > 0 ? <> · <b>{t(`+${coins} 金币`, `+${coins} coins`)}</b></> : null}</span>
          <span className="ob-egg-name">{t(entry.name)}</span>
          {!open && (
            <span className="ob-egg-more">
              {entry.postcard ? t('看看故事和明信片', 'The story & postcard') : t('看看故事', 'The story')}
              {eOpens && <kbd className="ob-egg-key">E</kbd>}<ChevronDown size={14} aria-hidden />
            </span>
          )}
        </span>
      </button>
      {open && <CardBody entry={entry} />}
      <button type="button" className="ob-egg-close" onClick={() => close()} aria-label={t('关闭', 'Close')}>×</button>
      {!open && <i className={`ob-egg-timer ${held ? 'is-held' : ''}`} aria-hidden />}
    </section>
  );
}

/**
 * A paper in our own words (the `egg-note` overlay): Emperor Norton's proclamation (a scroll with a crown) and the Octagon
 * House time capsule (an 1861-style note, then the player's own page with a few numbers from the save).
 */
export interface NoteProps { style: 'scroll' | 'letter'; title: Bilingual; lines: readonly Bilingual[]; sign?: Bilingual; statsTitle?: Bilingual; stats?: readonly { label: Bilingual; value: string }[] }

export function NoteCard({ props, close }: OverlayProps) {
  const { t } = useT();
  const p = props as NoteProps | undefined;
  useWalkAway(close);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || (e.code !== 'KeyE' && e.code !== 'Enter') || !keyForCard()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close]);
  if (!p) return null;
  return (
    <section className={`ob-egg-note is-${p.style}`} role="dialog" aria-label={t(p.title)}>
      {p.style === 'scroll' && <span className="ob-egg-crown" aria-hidden>♛</span>}
      <h3 className="ob-egg-note-title">{t(p.title)}</h3>
      {p.lines.map((l, i) => <p key={i} className="ob-egg-note-line">{t(l)}</p>)}
      {p.sign && <p className="ob-egg-note-sign">{t(p.sign)}</p>}
      {p.statsTitle && <h4 className="ob-egg-note-sub">{t(p.statsTitle)}</h4>}
      {p.stats && (
        <ul className="ob-egg-note-stats">
          {p.stats.map(s => <li key={s.label.en}><b>{s.value}</b><span>{t(s.label)}</span></li>)}
        </ul>
      )}
      <button type="button" className="ob-btn ob-btn-soft ob-btn-sm ob-egg-note-ok" onClick={() => close()}>{t('收好', 'Keep it')}</button>
    </section>
  );
}

/** The phone rings (egg 4): the operator's question and the people to put through (props: `{ choices, onPick(i) }`). */
export interface OperatorProps { choices: readonly Bilingual[]; onPick: (i: number) => void }

export function OperatorBubble({ props, close }: OverlayProps) {
  const { t } = useT();
  const p = (props ?? {}) as Partial<OperatorProps>;
  useWalkAway(close);
  useEffect(() => {
    const id = window.setTimeout(() => close(), 20000);
    return () => window.clearTimeout(id);
  }, [close]);
  return (
    <section className="ob-egg-operator" role="dialog" aria-label={t('接线员', 'The operator')}>
      <p className="ob-egg-operator-who">{t('接线员 · 美玲', 'Operator · Mei-Ling')}</p>
      <p className="ob-egg-operator-line">{t('喂？这里是电话局。你找谁？', 'Hello? Exchange here. Who would you like?')}</p>
      <div className="ob-egg-operator-choices">
        {(p.choices ?? []).map((c, i) => (
          <button key={c.en} type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={() => { p.onPick?.(i); close(); }}>{t(c)}</button>
        ))}
      </div>
      <button type="button" className="ob-egg-close" onClick={() => close()} aria-label={t('挂电话', 'Hang up')}>×</button>
    </section>
  );
}
