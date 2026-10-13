import { CalendarPlus, Download } from 'lucide-react';
import { Button } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { recordIcsDownload, recordProductEvent } from '../../lib/product-events';
import type { HomeWeekendPick } from '../../lib/home-weekend';
import { eventShortTitle } from '../../lib/event-facts';
import { translateText } from '../../i18n/locale';
import { weekendRange } from './home-model';
import { dateScope } from '../../lib/date-guard';

const HAN = /[㐀-鿿]/;
/** The short title in the reader's language, as the information cards print it (TypeCover shortTitleFor). */
function shortTitle(event: HomeWeekendPick['event'], locale: string): string {
  if (locale !== 'en') return translateText(eventShortTitle(event), locale as 'zh-Hans');
  const overlay = event.shortTitle ? translateText(event.shortTitle, 'en') : '';
  return overlay && !HAN.test(overlay) ? overlay : eventShortTitle({ title: translateText(event.title, 'en') });
}

/**
 * ⑧ 发到家庭群 (1007 §4.2 ⑧, HOME-09): a small preview of this weekend's share card — drawn from the same three picks, so
 * nothing is downloaded until the reader asks — the save-image button and the region calendar subscription.
 */
export function ShareStrip({ picks, start, end, cardHref }: { picks: readonly HomeWeekendPick[]; start: string; end: string; cardHref: string }) {
  const { t, locale } = useUiCopy();
  if (!picks.length) return null;
  const range = weekendRange(start, end);
  return <section className="home-share" aria-labelledby="home-share-title" {...dateScope('weekend')}>
    {/* An information card (data-cover="type"), not a picture: the card's headline and the picks' short titles as text. */}
    <div className="home-share__thumb" data-cover="type" aria-hidden="true">
      <p className="home-share__thumb-title">{t('湾区本周末', 'Bay Area weekend')}<span>{range}</span></p>
      <ol>{picks.map(pick => <li key={pick.event.id}>{shortTitle(pick.event, locale)}</li>)}</ol>
      <p className="home-share__thumb-foot">{t('每条附官方来源', 'Official sources')}</p>
    </div>
    <div className="home-share__body">
      <h2 id="home-share-title">{t(`这周末 ${picks.length} 件事，发到家庭群`, `This weekend’s ${picks.length} picks, for the family chat`)}</h2>
      <p>{t('存成一张图，微信里长按就能转发。', 'Save it as one image to send in any chat app.')}</p>
      <Button variant="secondary" href={cardHref} download onClick={() => recordProductEvent('share_card_download')} icon={<Download aria-hidden="true" strokeWidth={1.75} />}>{t('保存图片', 'Save image')}</Button>
      <a className="home-share__calendar" href="webcal://www.baylink.us/calendars/all.ics" onClick={recordIcsDownload}><CalendarPlus aria-hidden="true" strokeWidth={1.75} />{t('订阅湾区活动日历', 'Subscribe to Bay Area event dates')}</a>
    </div>
  </section>;
}
