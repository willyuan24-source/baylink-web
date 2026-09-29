import { useEffect, useRef } from 'react';
import { ExternalLink, MapPin, ShoppingBag } from 'lucide-react';
import { runtime } from '../core/runtime';
import { useT } from '../i18n';
import type { OverlayProps } from '../ui/slots';
import { openingUrl, signById } from './openings';
import './openings.css';

/**
 * Wave 6 · lane S (W6-S3) · the 新店 card (`realsf-opening` overlay, props `{ id }`): what the new place is, its address,
 * the site's note on hours, and the way to its BAYLINK page. Bottom-left like the find cards; closes on ×, Esc (the
 * overlay stack) or when the player walks ≥ 10 u away.
 */
export default function OpeningCard({ props, close }: OverlayProps) {
  const { t, locale } = useT();
  const id = (props as { id?: string } | undefined)?.id ?? '';
  const sign = signById(id);
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    const x0 = runtime.player.x, z0 = runtime.player.z;
    const timer = window.setInterval(() => { if (Math.hypot(runtime.player.x - x0, runtime.player.z - z0) > 10) closeRef.current(); }, 400);
    return () => window.clearInterval(timer);
  }, [id]);
  if (!sign) return null;
  return (
    <section className="ob-opening-card" aria-label={sign.name}>
      <div className="ob-opening-head">
        <span className="ob-opening-badge" aria-hidden><ShoppingBag size={22} /></span>
        <span className="ob-opening-titles">
          <span className="ob-opening-kicker">{t('新店 · 已开业', 'New · open')}</span>
          <span className="ob-opening-name">{sign.name}</span>
          <span className="ob-opening-what">{t(sign.what)}</span>
        </span>
      </div>
      <p className="ob-opening-line"><MapPin size={13} aria-hidden />{sign.address}</p>
      <p className="ob-opening-line ob-opening-hours">{t(sign.hours)}</p>
      <p className="ob-opening-foot">
        <a className="ob-opening-go" href={openingUrl(sign.id, locale)} target="_blank" rel="noopener">
          {t('BAYLINK 新店页', 'On BAYLINK')}<ExternalLink size={12} aria-hidden />
        </a>
        <small>{t(`BAYLINK 编辑 ${sign.siteVerifiedAt} 核对`, `checked by BAYLINK ${sign.siteVerifiedAt}`)}</small>
      </p>
      <button type="button" className="ob-opening-close" onClick={() => close()} aria-label={t('关闭', 'Close')}>×</button>
    </section>
  );
}
