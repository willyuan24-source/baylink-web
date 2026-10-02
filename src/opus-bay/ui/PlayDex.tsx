import { useMemo, useState, useSyncExternalStore } from 'react';
import { MapPin, Play } from 'lucide-react';
import { runtime } from '../core/runtime';
import type { Bilingual, Vec2 } from '../core/types';
import { isPaid, ledgerVersion, playState, subscribeLedger, todayKey } from '../economy/ledger';
import { records } from '../economy/records';
import { closePanel } from '../game/flow';
import { goTo } from '../game/goTo';
import { importRetry } from '../game/importRetry';
import { timeLabel } from '../game/tripText';
import { STREET_FACTOR, autoTravelSeconds } from '../game/tripPlan';
import { useT } from '../i18n';
import { GAME_ICONS } from './gameIcons';
import { DEX_GAMES, DEX_GROUPS, TODAY_GAME_COINS, dexMedal, dexPlayed, gameGoTarget, nearestGames, nearestSpot, todayGameSource, type DexGame } from './playDexData';
import './playDex.css';

/**
 * Wave 9 · lane G · the journal's 游乐 tab (registered by play/dexEntry.ts through ui/slots registerJournalTab; this is
 * its lazy body): every mini-game of the city (ui/playDexData.ts) — where it is, a one-line rule, the best medal and
 * best, a silhouette and a clue while it has never been played, and 带我去 to the game's own spot (goTo a point: the trip
 * ends at the prompt), or 现在就玩 for the games that start anywhere. On top, the three nearest (BAYBAY's 附近能玩什么？
 * opens the tab there). Review 2026-10-01 R§5 #13.
 */

const MEDAL_WORDS: Record<1 | 2 | 3, Bilingual> = { 1: { zh: '好', en: 'Good' }, 2: { zh: '很好', en: 'Great' }, 3: { zh: '太棒了', en: 'Brilliant' } };

/** The medal's shape (colour-blind safe, as the result card: ● 好 · ◆ 很好 · ★ 太棒了). */
function MedalShape({ tier }: { tier: 1 | 2 | 3 }) {
  const c = { width: 14, height: 14, viewBox: '0 0 46 46', 'aria-hidden': true as const };
  if (tier === 3) return <svg {...c}><path d="M23 3.5l5.6 12.1 13.2 1.5-9.8 9 2.7 13-11.7-6.6-11.7 6.6 2.7-13-9.8-9 13.2-1.5z" /></svg>;
  if (tier === 2) return <svg {...c}><path d="M23 3l20 20-20 20L3 23z" /></svg>;
  return <svg {...c}><circle cx="23" cy="23" r="18" /></svg>;
}

const walkTime = (from: Vec2, to: Vec2) => timeLabel(autoTravelSeconds(Math.hypot(to.x - from.x, to.z - from.z) * STREET_FACTOR));
/** Closer than this (u) a game is 就在这儿 (goTo's own HERE_SAY_R: a trip would only say so). */
const HERE_R = 10;

/** Start a game that runs anywhere (closes the journal first). */
async function startHere(g: DexGame): Promise<void> {
  closePanel();
  if (g.start === 'hide-seek') { const m = await importRetry(() => import('../play/hideSeek')); m.startHideSeek(); }
  else if (g.start === 'skyline') { const m = await importRetry(() => import('../play/skyline')); m.startSkyline(); }
}

interface RowState { played: boolean; medal: 0 | 1 | 2 | 3; best: Bilingual | null }

function GameRow({ g, st, from, near }: { g: DexGame; st: RowState; from: Vec2; near?: boolean }) {
  const { t } = useT();
  const [going, setGoing] = useState(false);
  const Icon = GAME_ICONS[g.icon];
  const spot = nearestSpot(g, from);
  const here = !!spot && spot.d < HERE_R;
  const go = () => {
    if (!spot || going) return;
    setGoing(true);
    void goTo(gameGoTarget(g, spot.spot), { source: 'play:dex' }).then(r => { if (!r.ok) setGoing(false); }, () => setGoing(false));
  };
  return (
    <li className={`ob-dex-row${st.played ? ' is-played' : ' is-new'}${near ? ' is-near' : ''}`} data-game={g.id}>
      <span className="ob-dex-ico" aria-hidden>
        <Icon size={20} strokeWidth={2.2} />
        {!st.played && <b className="ob-dex-q">?</b>}
      </span>
      <span className="ob-dex-text">
        <span className="ob-dex-name">
          <strong>{t(g.name)}</strong>
          {st.medal > 0 && (
            <span className={`ob-dex-medal tier-${st.medal}`}><MedalShape tier={st.medal as 1 | 2 | 3} />{t(MEDAL_WORDS[st.medal as 1 | 2 | 3])}</span>
          )}
          {st.played && st.medal === 0 && <span className="ob-dex-medal">{t('玩过', 'Played')}</span>}
        </span>
        <small className="ob-dex-where">{t(g.where)}{spot && !here ? ` · ${t(walkTime(from, spot.spot))}` : ''}</small>
        {here && <small className="ob-dex-here">{t('就在这儿：走近找找操作提示', 'Right here: walk up and look for the prompt')}</small>}
        <span className="ob-dex-rule">{st.played ? t(g.rule) : t(g.clue)}</span>
        {st.best && <small className="ob-dex-best">{t(st.best)}</small>}
        {g.needs && <small className="ob-dex-needs">{t('需要：', 'Needs: ')}{t(g.needs)}</small>}
      </span>
      {spot && !here ? (
        <button type="button" className="ob-dex-go" disabled={going} onClick={go} aria-label={t({ zh: `带我去：${g.name.zh}`, en: `Take me to ${g.name.en}` })}>
          <MapPin size={14} aria-hidden /><span>{going ? t('出发…', 'Going…') : t('带我去', 'Take me')}</span>
        </button>
      ) : g.start ? (
        <button type="button" className="ob-dex-go is-play" onClick={() => { void startHere(g); }} aria-label={t({ zh: `现在就玩：${g.name.zh}`, en: `Play now: ${g.name.en}` })}>
          <Play size={14} aria-hidden /><span>{t('现在就玩', 'Play now')}</span>
        </button>
      ) : null}
    </li>
  );
}

export default function PlayDex() {
  const { t } = useT();
  const version = useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  // where the player stands when the page opens (a trip from here closes the journal anyway)
  const [from] = useState<Vec2>(() => ({ x: runtime.player.x, z: runtime.player.z }));
  const states = useMemo(() => {
    const p = playState(), b = p.b ?? {};
    const bests = new Map(records(p, todayKey()).bests.map(r => [r.key, r.value]));
    const out = new Map<string, RowState>();
    for (const g of DEX_GAMES) {
      const medal = dexMedal(g, isPaid);
      out.set(g.id, { played: dexPlayed(g, b, isPaid), medal, best: bests.get(g.id) ?? null });
    }
    return out;
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const played = DEX_GAMES.filter(g => states.get(g.id)?.played).length;
  // W9-G4: today's game coins (the first game finished each Bay day)
  const todayPaid = useMemo(() => isPaid(todayGameSource(todayKey())), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const near = useMemo(() => nearestGames(from, 3), [from]);
  const stOf = (g: DexGame): RowState => states.get(g.id) ?? { played: false, medal: 0, best: null };
  return (
    <div className="ob-dex">
      <div className="ob-dex-head">
        <strong>{t('湾区游乐图鉴', 'Bay play guide')}</strong>
        <span className="ob-dex-count">{t(`玩过 ${played} / ${DEX_GAMES.length}`, `${played} / ${DEX_GAMES.length} played`)}</span>
        <p className="ob-muted">{t('没玩过的只露出剪影和线索；点「带我去」，BAYBAY 直接带你到游戏跟前。', 'Unplayed games show a silhouette and a clue; Take me walks you right up to the game.')}</p>
        <p className={`ob-dex-today${todayPaid ? ' is-done' : ''}`}>
          {todayPaid
            ? t('今日小游戏奖励已领 ✓ 明天再来', 'Today’s game bonus collected ✓ More tomorrow')
            : t(`今日小游戏：今天玩完任意一个小游戏 +${TODAY_GAME_COINS} 金币`, `Today’s game: finish any mini-game today for +${TODAY_GAME_COINS} coins`)}
        </p>
      </div>
      <h3 className="ob-dex-h">{t('离你最近', 'Nearest to you')}</h3>
      <ul className="ob-dex-list">
        {near.map(n => <GameRow key={`near:${n.game.id}`} g={n.game} st={stOf(n.game)} from={from} near />)}
      </ul>
      {DEX_GROUPS.map(gr => {
        const list = DEX_GAMES.filter(g => g.group === gr.id);
        if (!list.length) return null;
        return (
          <section key={gr.id} className="ob-dex-group">
            <h3 className="ob-dex-h">{t(gr.name)}<span className="ob-dex-h-count">{list.filter(g => stOf(g).played).length}/{list.length}</span></h3>
            <ul className="ob-dex-list">
              {list.map(g => <GameRow key={g.id} g={g} st={stOf(g)} from={from} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
