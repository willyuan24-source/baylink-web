import { useEffect, useRef } from 'react';
import { Bird, Check, Footprints, Sparkles } from 'lucide-react';
import { runtime } from '../core/runtime';
import { useGame } from '../core/store';
import { CITY_GOAL, GOAL_REWARDS, GOALS_STEP_ID, goalProgress } from '../data/sf/goals';
import { FREE_GOALS } from '../data/script';
import { W5_WELCOME, w5Text } from '../data/sf/linesW5';
import { goalTargets, speakRecorded } from '../game/cityContent';
import { afterGoalsStep } from '../game/goalsStep';
import { holdLock } from '../game/playerLock';
import { gameTimeLabel } from '../game/travel';
import { useT } from '../i18n';
import { BaybayFace } from './common';
import { openOverlays, type OverlayProps } from './slots';
import './goals-step.css';

/**
 * Wave 5 · lane C · W5-C3: the goals step (game/goalsStep.ts registers it; game/flow.ts openGoalsStep opens it once per
 * player). A modal card: BAYBAY's line, goal #1 — the pelican, its reward text 解锁：随时飞 and one big button that
 * sets off with her (跟 BAYBAY 去 · 约 1 分钟) — then the other goals, compact, and 我自己逛. The player's lock is held
 * while it is open (game/playerLock 'panel'); bubbles wait (flow.bubble). Closing it any way (a button, Escape, the
 * backdrop) starts free roam: the button leads, anything else leaves BAYBAY's pelican line and the soft waypoint.
 */

/** BAYBAY's line: lane C's frozen wave-5 line (W5-C6), its clip plays when the step opens once lane V has recorded it */
const INTRO = w5Text(W5_WELCOME.goalsIntro);

export default function GoalsStep({ close }: OverlayProps) {
  const { t } = useT();
  const done = useGame(s => s.goalsDone);
  const primary = useRef<HTMLButtonElement>(null);
  /** how it was closed: 'lead' (the big button) or 'self' (我自己逛 / Escape / the backdrop) */
  const how = useRef<'lead' | 'self'>('self');
  const pelicanOpen = !done.includes(CITY_GOAL.pelican);
  const target = pelicanOpen ? goalTargets().find(g => g.goal === CITY_GOAL.pelican) : undefined;
  const eta = target ? gameTimeLabel(Math.hypot(target.x - runtime.player.x, target.z - runtime.player.z)) : null;

  // the player stays put while the step is up (released on every way out: unmount)
  useEffect(() => holdLock('panel', 'goals-step'), []);
  useEffect(() => { primary.current?.focus({ preventScroll: true }); speakRecorded(W5_WELCOME.goalsIntro.id); }, []);
  // after it closed (not a StrictMode re-mount: the overlay must really be gone), free roam begins
  useEffect(() => () => {
    if (openOverlays().some(o => o.id === GOALS_STEP_ID)) return;
    setTimeout(() => afterGoalsStep(how.current, target?.id ?? null), 0);
  }, [target?.id]);

  const lead = () => { how.current = 'lead'; close(); };
  const self = () => { how.current = 'self'; close(); };
  const pelican = FREE_GOALS.find(g => g.id === CITY_GOAL.pelican);
  const rest = FREE_GOALS.filter(g => g.id !== CITY_GOAL.pelican);

  return (
    <div className="ob-gstep-wrap" onClick={e => { if (e.target === e.currentTarget) self(); }}>
      <section className="ob-gstep" role="dialog" aria-modal="true" aria-labelledby="ob-gstep-title">
        <header className="ob-gstep-head">
          <BaybayFace mood="wave" size={56} />
          <p id="ob-gstep-title">{t(INTRO)}</p>
        </header>
        {pelican && (
          <div className={`ob-gstep-hero ${pelicanOpen ? '' : 'is-done'}`}>
            <span className="ob-gstep-icon" aria-hidden>{pelicanOpen ? <Bird size={22} /> : <Check size={20} />}</span>
            <div>
              <strong>{t(pelican.label)}</strong>
              <small>{t(pelican.hint)}</small>
              {GOAL_REWARDS[pelican.id] && <em className="ob-gstep-reward"><Sparkles size={13} aria-hidden />{t(GOAL_REWARDS[pelican.id])}</em>}
            </div>
          </div>
        )}
        <ul className="ob-gstep-list" aria-label={t('其他目标', 'More goals')}>
          {rest.map(goal => {
            const ok = done.includes(goal.id);
            const progress = goalProgress(goal.id, done);
            return <li key={goal.id} className={ok ? 'is-done' : ''}><span className="ob-check">{ok && <Check size={12} aria-hidden />}</span><span>{t(goal.label)}{progress && ` · ${progress}`}</span></li>;
          })}
        </ul>
        <div className="ob-gstep-actions">
          {pelicanOpen && target ? (
            <>
              <button ref={primary} type="button" className="ob-btn ob-btn-gold ob-gstep-go" onClick={lead}>
                <Bird size={18} aria-hidden /><span>{t('跟 BAYBAY 去找鹈鹕', 'Go meet the pelican')}{eta && <small> · {t(eta)}</small>}</span>
              </button>
              <button type="button" className="ob-btn ob-btn-ghost ob-gstep-self" onClick={self}><Footprints size={16} aria-hidden /><span>{t('我自己逛', "I'll wander")}</span></button>
            </>
          ) : (
            <button ref={primary} type="button" className="ob-btn ob-btn-gold ob-gstep-go" onClick={self}><span>{t('出发！', "Let's go!")}</span></button>
          )}
        </div>
        <p className="ob-gstep-note">{t('目标都记在旅行本里，随时能看。', 'Your journal keeps these goals — look anytime.')}</p>
      </section>
    </div>
  );
}

