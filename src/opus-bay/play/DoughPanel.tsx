import { X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useGame } from '../core/store';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { BAKE_S, cancelDough, doughGame, doughPick, doughSeq, doughTap, GOLD_HI, GOLD_LO, SHAPES, subscribeDough, type DoughShape } from './dough';
import { drawDough } from './doughArt';
import { DOUGH_NAME } from './sfgamesLines';
import './sfgames.css';

/** A mouse press never focuses a game button: Space stays the game's key (a focused button would take it). */
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

/**
 * Wave 7 · lane M · the sourdough panel (overlay 'play-dough', its own chunk): the table / the oven on a canvas (drawn
 * every animation frame from play/dough.ts's DoughGame; React re-renders on a new step or beat), one big button per step
 * (揉！ · three shapes · 划！ · 出炉！, 56 px; Space / 1 2 3 on a keyboard), in the oven a meter with the golden band
 * (shape + word: colour-blind safe). A tap on the canvas counts as the step's button too (one thumb anywhere).
 */

const SHAPE_WORD: Record<DoughShape, { zh: string; en: string }> = {
  boule: { zh: '圆面包', en: 'Boule' }, crab: { zh: '螃蟹', en: 'Crab' }, turtle: { zh: '乌龟', en: 'Turtle' },
};

export default function DoughPanel() {
  const { t } = useT();
  // (W9-G-review G-RV-2) Settings pauses the game: the panel hides under the sheet like the wave-8 panels (sfgames8.css)
  const paused = useGame(s => s.paused);
  const device = useDevice();
  useSyncExternalStore(subscribeDough, doughSeq, doughSeq);
  const game = doughGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let id = 0;
    const draw = (now: number) => {
      const cv = canvasRef.current, g = doughGame();
      if (cv && g) {
        const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        if (c) { c.setTransform(dpr * w / 100, 0, 0, dpr * h / 70, 0, 0); drawDough(c, g, now / 1000); }
        const m = markRef.current;
        if (m) m.style.left = `${Math.min(1, g.phase === 'done' ? g.crust : g.t / BAKE_S) * 100}%`;
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);

  if (!game) return null;
  const key = (k: string) => (device !== 'touch' ? <Keycap>{k}</Keycap> : null);
  const step = game.phase;
  const hint = step === 'knead' ? t('圆圈碰到面团时点「揉！」', 'Tap “Knead!” as the ring meets the dough')
    : step === 'shape' ? t('捏成什么形状？', 'What shape?')
    : step === 'score' ? t('刀划过虚线时点「划！」（三刀）', 'Tap “Score!” as the blade crosses a dashed line (three cuts)')
    : step === 'bake' ? t('颜色进入金黄区就「出炉！」', 'Take it out when the crust is in the golden band')
    : t('出炉啦！', 'Out of the oven!');
  const label = step === 'knead' ? t('揉！', 'Knead!') : step === 'score' ? t('划！', 'Score!') : t('出炉！', 'Take it out!');
  return (
    <div className={`ob-sfg-panel is-dough${paused ? ' is-paused' : ''}`} role="dialog" aria-label={t(DOUGH_NAME)}>
      <div className="ob-sfg-head">
        <strong>{t(DOUGH_NAME)}</strong>
        <span className="ob-sfg-score">{game.score}</span>
        <button type="button" className="ob-sfg-x" onClick={cancelDough} aria-label={t('放弃', 'Give up')}><X size={20} /></button>
      </div>
      <canvas ref={canvasRef} className="ob-sfg-canvas is-dough" onPointerDown={e => { e.preventDefault(); if (step !== 'shape' && step !== 'done') doughTap(); }} aria-hidden="true" />
      {step === 'bake' || step === 'done' ? (
        <div className="ob-sfg-meter" role="img" aria-label={t('金黄区', 'golden band')}>
          <span className="is-band" style={{ left: `${GOLD_LO * 100}%`, width: `${(GOLD_HI - GOLD_LO) * 100}%` }} />
          <span className="is-mark" ref={markRef} />
        </div>
      ) : null}
      <p className="ob-sfg-hint">{hint}</p>
      <div className="ob-sfg-controls">
        {step === 'shape'
          ? SHAPES.map((s, i) => <button key={s} type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-pick" onClick={() => doughPick(s)}>{t(SHAPE_WORD[s])}{key(String(i + 1))}</button>)
          : step !== 'done' && <button type="button" onMouseDown={keepFocus} className="ob-sfg-btn is-go" onPointerDown={e => { e.preventDefault(); doughTap(); }} onClick={e => { if (e.detail === 0) doughTap(); }}>{label}{key(t('空格', 'Space'))}</button>}
      </div>
      <p className="ob-sfg-foot">{t('揉面 · 整形 · 划口 · 烤', 'Knead · shape · score · bake')}{step === 'bake' ? t(' · 金黄 = 满分', ' · golden = top marks') : ''}</p>
    </div>
  );
}
