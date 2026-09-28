import { useEffect, useRef } from 'react';
import type { OverlayProps } from '../ui/slots';
import { useT } from '../i18n';
import { TIER_WORDS, type ResultProps } from './kit';
import './play.css';

/**
 * Wave 5 · lane A · the PlayKit result card (overlay 'play-result', its own chunk): a warm medal — shape AND word
 * (○ 再试试 · ● 好 · ◆ 很好 · ★ 太棒了: colour-blind safe) —, the activity, one detail line, the best (新纪录！ / 上次你 18
 * 秒！), the coins the ledger paid, 再来一次 and 好的. It closes itself after 8 s unless a pointer rests on it.
 */

const AUTO_CLOSE_MS = 8000;

function Medal({ tier }: { tier: ResultProps['tier'] }) {
  const common = { width: 46, height: 46, viewBox: '0 0 46 46', 'aria-hidden': true as const };
  if (tier === 3) return <svg {...common}><path d="M23 3.5l5.6 12.1 13.2 1.5-9.8 9 2.7 13-11.7-6.6-11.7 6.6 2.7-13-9.8-9 13.2-1.5z" /></svg>;
  if (tier === 2) return <svg {...common}><path d="M23 3l20 20-20 20L3 23z" /></svg>;
  if (tier === 1) return <svg {...common}><circle cx="23" cy="23" r="18" /></svg>;
  return <svg {...common}><circle cx="23" cy="23" r="17" className="is-open" /></svg>;
}

export default function ResultCard({ props, close }: { props: ResultProps } & Pick<OverlayProps, 'close'>) {
  const { t } = useT();
  const hover = useRef(false);
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    let left = AUTO_CLOSE_MS;
    const id = window.setInterval(() => { if (!hover.current) left -= 250; if (left <= 0) closeRef.current(); }, 250);
    return () => window.clearInterval(id);
  }, [props]);
  if (!props) return null;
  const { tier, name, detail, best, fresh, coins, again } = props;
  return (
    <div className={`ob-play-result tier-${tier}`} role="status" aria-live="polite" onPointerEnter={() => { hover.current = true; }} onPointerLeave={() => { hover.current = false; }}>
      <div className="ob-play-medal"><Medal tier={tier} /></div>
      <div className="ob-play-result-body">
        <small>{t(name)}</small>
        <strong>{t(TIER_WORDS[tier])}</strong>
        {detail && <span>{t(detail)}</span>}
        {fresh ? <span className="ob-play-best is-new">{t('新纪录！', 'A new best!')}</span> : best ? <span className="ob-play-best">{t(best)}</span> : null}
        {!!coins && coins > 0 && <span className="ob-play-coins">+{coins} {t('金币', coins === 1 ? 'coin' : 'coins')}</span>}
      </div>
      <div className="ob-play-result-actions">
        {again && <button type="button" className="ob-play-btn is-again" onClick={() => { close(); again(); }}>{t('再来一次', 'Again')}</button>}
        <button type="button" className="ob-play-btn" onClick={close}>{t('好的', 'OK')}</button>
      </div>
    </div>
  );
}
