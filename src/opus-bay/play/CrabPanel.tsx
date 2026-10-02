import { X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { useGame } from '../core/store';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { cancelCrab, crabCall, crabDrop, crabGame, crabSeq, NETS, setCrabHold, subscribeCrab } from './crab';
import { drawGauge, drawWater } from './crabArt';
import { CRAB_NAME } from './sfgamesLines';
import './sfgames.css';

/** A mouse press never focuses a game button: Space stays the game's key (a focused button would take it). */
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

/**
 * Wave 7 · lane M · crabbing's panel (overlay 'play-crab', its own chunk): the water under Pier 7 on a canvas (drawn
 * every animation frame from play/crab.ts's CrabGame; React re-renders on a new phase or a crab on / off the net), the
 * nets left, the points; one big button per step — 放网, then 拉！ (press and HOLD: the net comes up while it is held),
 * then on the gauge 放回去 / 够 4 英寸，留下 (56 px). Keys: Space (drop, hold to haul), ← / 1 release, → / 2 keep, Esc.
 */

export default function CrabPanel() {
  const { t } = useT();
  // (W9-G-review G-RV-2) Settings pauses the game: the panel hides under the sheet like the wave-8 panels (sfgames8.css)
  const paused = useGame(s => s.paused);
  const device = useDevice();
  useSyncExternalStore(subscribeCrab, crabSeq, crabSeq);
  const game = crabGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let id = 0;
    const draw = (now: number) => {
      const cv = canvasRef.current, g = crabGame();
      if (cv && g) {
        const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        if (c) {
          c.setTransform(dpr * w / 100, 0, 0, dpr * h / 90, 0, 0);
          const cr = g.phase === 'measure' ? g.caught[g.measuring] : null;
          if (cr) drawGauge(c, cr, null, now / 1000);
          else drawWater(c, g, now / 1000);
        }
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(id); setCrabHold(false); };
  }, []);

  if (!game) return null;
  const key = (k: string) => (device !== 'touch' ? <Keycap>{k}</Keycap> : null);
  const hold = {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ } setCrabHold(true); },
    onPointerUp: () => setCrabHold(false), onPointerCancel: () => setCrabHold(false), onLostPointerCapture: () => setCrabHold(false),
  };
  const cr = game.phase === 'measure' ? game.caught[game.measuring] : null;
  const hint = game.phase === 'ready' ? t('放下网，饵会引螃蟹爬进来', 'Drop the net: the bait draws the crabs in')
    : game.phase === 'sink' ? t('网在往下沉……', 'The net is sinking…')
    : game.phase === 'soak' ? (game.eating > 0 ? t('绳子在动！按住「拉！」一口气拉上来', 'The rope twitches! Hold “Pull!” and haul in one go') : t('等螃蟹爬进网……', 'Wait for crabs to crawl in…'))
    : game.phase === 'pull' ? (game.holding ? t('拉！别停！', 'Pull! Don’t stop!') : t('按住别松手！', 'Keep holding!'))
    : cr ? (cr.kind === 'dungeness' ? t('珍宝蟹（白色钳尖）· 看尺子', 'Dungeness (white claw tips) · read the gauge') : t('石蟹（黑色钳尖）· 看尺子：够 4 英寸吗？', 'Rock crab (black claw tips) · 4 inches or more?'))
    : '';
  return (
    <div className={`ob-sfg-panel is-crab${paused ? ' is-paused' : ''}`} role="dialog" aria-label={t(CRAB_NAME)}>
      <div className="ob-sfg-head">
        <strong>{t(CRAB_NAME)}</strong>
        <span className="ob-sfg-nets" aria-label={t(`第 ${game.net} / ${NETS} 网`, `Net ${game.net} of ${NETS}`)}>
          {Array.from({ length: NETS }, (_, i) => <i key={i} className={i < game.net - 1 ? 'is-done' : i === game.net - 1 ? 'is-on' : ''} />)}
        </span>
        <span className="ob-sfg-score">{game.score}</span>
        <button type="button" className="ob-sfg-x" onClick={cancelCrab} aria-label={t('放弃', 'Give up')}><X size={20} /></button>
      </div>
      <canvas ref={canvasRef} className="ob-sfg-canvas is-crab" aria-hidden="true" />
      <p className="ob-sfg-hint">{hint}</p>
      <div className="ob-sfg-controls">
        {game.phase === 'ready' && <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-go" onClick={crabDrop}>{t('放网', 'Drop the net')}{key(t('空格', 'Space'))}</button>}
        {(game.phase === 'sink' || game.phase === 'soak' || game.phase === 'pull') && (
          <button type="button" className={`ob-sfg-btn is-go is-hold${game.holding ? ' is-held' : ''}`} disabled={game.phase === 'sink'} {...hold}>{t('拉！（按住）', 'Pull! (hold)')}{key(t('空格', 'Space'))}</button>
        )}
        {cr && <>
          <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-pick is-teal" onClick={() => crabCall(true)}>{t('放回去', 'Put it back')}<small>{t('珍宝蟹 / 不到 4 英寸', 'Dungeness / under 4″')}</small>{key('←')}</button>
          <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-pick" onClick={() => crabCall(false)}>{t('够 4 英寸，留下', '4″ or more: keep')}<small>{t('石蟹才可以', 'rock crabs only')}</small>{key('→')}</button>
        </>}
      </div>
      <p className="ob-sfg-foot">{cr ? t(`第 ${game.measuring + 1} / ${game.caught.length} 只`, `Crab ${game.measuring + 1} of ${game.caught.length}`) : t('旧金山湾：珍宝蟹一律放回，石蟹满 4 英寸', 'SF Bay: Dungeness always back, rock crabs from 4″')}</p>
    </div>
  );
}
