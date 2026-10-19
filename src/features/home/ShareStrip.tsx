import { CalendarPlus, Download } from 'lucide-react';
import { Button } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { recordIcsDownload, recordProductEvent } from '../../lib/product-events';
import { dateScope } from '../../lib/date-guard';

/**
 * 发到家庭群 (1007 §4.2 ⑧, HOME-09; UI9-HOME): one compact card beside picks 2–3 on a desktop and after the need chips on a
 * phone — the weekend's share image (drawn from the same three picks; nothing downloads until the reader asks) and the
 * region calendar subscription. Text only, so it wraps at 特大; hidden in 简洁.
 */
export function ShareStrip({ count, cardHref }: { count: number; cardHref: string }) {
  const { t } = useUiCopy();
  if (!count) return null;
  return <section className="home-share" aria-labelledby="home-share-title" data-simple="hide" {...dateScope('weekend')}>
    <h2 id="home-share-title">{t(`这周末 ${count} 件事，发到家庭群`, `This weekend’s ${count} picks, for the family chat`)}</h2>
    <p>{t('存成一张图，微信里长按就能转发。', 'Save it as one image to send in any chat app.')}</p>
    <div className="home-share__actions">
      <Button variant="secondary" href={cardHref} download onClick={() => recordProductEvent('share_card_download')} icon={<Download aria-hidden="true" strokeWidth={1.75} />}>{t('保存图片', 'Save image')}</Button>
      <Button variant="quiet" href="webcal://www.baylink.us/calendars/all.ics" onClick={recordIcsDownload} icon={<CalendarPlus aria-hidden="true" strokeWidth={1.75} />}>{t('订阅日历', 'Subscribe to dates')}</Button>
    </div>
  </section>;
}
