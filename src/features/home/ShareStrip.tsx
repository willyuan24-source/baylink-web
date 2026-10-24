import { useState } from 'react';
import { CalendarPlus, Download } from 'lucide-react';
import { Button } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { recordIcsDownload, recordProductEvent } from '../../lib/product-events';
import { dateScope } from '../../lib/date-guard';

/**
 * 发到家庭群 (1007 §4.2 ⑧, HOME-09; UI9-HOME): one compact card under the lead on a desktop (as tall as its content; UI9-R2-
 * HOME) and after the entry tiles on a phone — a small preview of the weekend's share image (UI9-IMG-A1b: the photo tiles of
 * the same picks, a ≤ 30 KB WebP; the full card downloads only when the reader asks) and the region calendar subscription.
 * Below 768 it is one row of the two buttons (the heading stays for screen readers; the preview is not shown); hidden in
 * 简洁. Its heading is an h3 under the picks' h2: the same three picks (UI9-R2-HOME N02 / N15). On a day the build wrote no
 * card for (`cardHref` null: a deploy older than the card's week, or a weekend the home cannot count), the same place holds
 * 看本周末全部 and 订阅日历 instead, so the desktop column under the lead is never blank. Below 1024 that 看本周末全部 is
 * hidden: the picks' own link sits above it.
 */
export function ShareStrip({ count, cardHref, total }: { count: number; cardHref: string | null; total: number | null }) {
  const { t } = useUiCopy();
  const [preview, setPreview] = useState(true);
  if (!count) return null;
  const calendar = <Button variant="quiet" href="webcal://www.baylink.us/calendars/all.ics" onClick={recordIcsDownload} icon={<CalendarPlus aria-hidden="true" strokeWidth={1.75} />}>{t('订阅日历', 'Subscribe to dates')}</Button>;
  if (!cardHref) return <section className="home-share" aria-label={t('看全部与订阅日历', 'All events and the calendar')} data-simple="hide" {...dateScope('weekend')}>
    <div className="home-share__actions">
      <Button variant="secondary" to="/events" className="home-share__all">{total ? t(`看本周末全部 ${total} 场`, `See all ${total} this weekend`) : t('看本周末全部活动', 'See all events this weekend')}</Button>
      {calendar}
    </div>
  </section>;
  return <section className="home-share" aria-labelledby="home-share-title" data-simple="hide" data-card="" {...dateScope('weekend')}>
    {/* UI9-IMAGES §4: the card itself, small (generate-weekly.ts writes a ≤ 30 KB preview beside each Bay Area card). */}
    {/* Offline or a missing file: the preview goes and the two buttons stay (RC-25), also when it failed before hydration. */}
    {preview && <img className="home-share__card" src={cardHref.replace(/\.png$/, '-thumb.webp')} alt={t('本周末分享图预览', 'Preview of this weekend’s share image')} width={240} height={320} loading="lazy" decoding="async"
      onError={() => setPreview(false)} ref={img => { if (img?.complete && !img.naturalWidth && img.currentSrc) setPreview(false); }} />}
    <h3 id="home-share-title">{t(`这周末 ${count} 件事，发到家庭群`, `This weekend’s ${count} picks, for the family chat`)}</h3>
    <p>{t('存成一张图，微信里长按就能转发。', 'Save it as one image to send in any chat app.')}</p>
    <div className="home-share__actions">
      <Button variant="secondary" href={cardHref} download onClick={() => recordProductEvent('share_card_download')} icon={<Download aria-hidden="true" strokeWidth={1.75} />}>{t('保存图片', 'Save image')}</Button>
      {calendar}
    </div>
  </section>;
}
