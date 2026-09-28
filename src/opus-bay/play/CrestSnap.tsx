import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Bilingual } from '../core/types';
import { downloadUrl } from '../game/photo';
import { useT } from '../i18n';
import './play.css';

/**
 * Wave 5 · lane A · the crest hop's snapshot (overlay 'play-snap', play/crests.ts): a small polaroid of the top of the
 * hop at the upper left, the street's name under it, 保存 (a JPEG download, only when tapped) and ✕; it goes by
 * itself after SNAP_MS unless a pointer rests on it.
 */

export const SNAP_MS = 6500;
export interface SnapProps { url: string; caption: Bilingual }

export default function CrestSnap({ props, close }: { props?: unknown; close: () => void }) {
  const { t } = useT();
  const p = props as SnapProps | undefined;
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return;
    const id = window.setTimeout(close, SNAP_MS);
    return () => window.clearTimeout(id);
  }, [hold, close, p?.url]);
  if (!p) return null;
  const save = () => downloadUrl(p.url, `opus-bay-crest-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`);
  return (
    <figure className="ob-play-snap" onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}>
      <img src={p.url} alt="" />
      <figcaption>
        <span>{t(p.caption)}</span>
        <button type="button" className="ob-play-btn is-quiet" onClick={save}><Download size={16} aria-hidden /> {t({ zh: '保存', en: 'Save' })}</button>
        <button type="button" className="ob-play-snap-x" onClick={close} aria-label={t({ zh: '关闭', en: 'Close' })}><X size={16} aria-hidden /></button>
      </figcaption>
    </figure>
  );
}
