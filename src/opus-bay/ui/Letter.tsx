import { useEffect, useRef } from 'react';
import { Mail } from 'lucide-react';
import { game } from '../core/store';
import { LETTER_GREETING, LETTERS } from '../data/sf/letters';
import { readLetter, residentByKey, type ResidentKey } from '../data/sf/residents';
import { holdLock } from '../game/playerLock';
import { useT } from '../i18n';
import type { OverlayProps } from './slots';
import './letter.css';

/**
 * Wave 5 · lane C · W5-C7: a resident's letter (game/residentTasks.ts registers the overlay `c-letter`; the Journal's 目标
 * tab opens it with `{ key }`). A paper card: the greeting, the resident's few lines, the signature; opening it marks
 * it read (`letter-read:<key>`). The player stays put while it is open.
 */

export const LETTER_OVERLAY = 'c-letter';

export default function Letter({ props, close }: OverlayProps) {
  const { t } = useT();
  const key = (props as { key?: string } | undefined)?.key as ResidentKey | undefined;
  const letter = key ? LETTERS[key] : undefined;
  const r = key ? residentByKey(key) : undefined;
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => holdLock('panel', 'letter'), []);
  useEffect(() => {
    ok.current?.focus({ preventScroll: true });
    if (key) { const done = game.get().goalsDone, next = readLetter(done, key); if (next.length !== done.length || next.some((id, i) => id !== done[i])) game.set({ goalsDone: next }); }
  }, [key]);
  if (!letter || !r) return null;
  return (
    <div className="ob-letter-wrap" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <section className="ob-letter" role="dialog" aria-modal="true" aria-labelledby="ob-letter-from">
        <header>
          <span className="ob-letter-stamp" aria-hidden><Mail size={18} /></span>
          <p id="ob-letter-from">{t(`来自${r.name.zh} 的信`, `A letter from ${r.name.en}`)}</p>
        </header>
        <div className="ob-letter-paper">
          <p className="ob-letter-hi">{t(LETTER_GREETING)}</p>
          {letter.body.map((line, i) => <p key={i}>{t(line)}</p>)}
          <p className="ob-letter-sign">{t(letter.sign)}</p>
        </div>
        <button ref={ok} type="button" className="ob-btn ob-btn-gold ob-letter-ok" onClick={close}>{t('收好', 'Keep it')}</button>
      </section>
    </div>
  );
}
