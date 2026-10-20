import { useEffect, useState } from 'react';
import { Phone, Send } from 'lucide-react';
import { useApp, type AppContextValue } from '../../app/context';
import { SaveToWeek } from '../../components/SaveToWeek';
import { Button } from '../../components/ui/Button';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { Guide } from '../../data/guides';
import { guideBayBayQuestion } from './guide-facts';
import type { GuideCall } from './guide-records';
import { localizedUrl, translateText } from '../../i18n/locale';
import { rememberGuide } from '../../lib/reader-library';
import { withFamilyReading } from '../../lib/family-reading';
import { SITE_URL } from '../../lib/seo';
import { copyText } from '../../utils/postShare';

/** Opens BayBay with a question; `draft` puts it in the box for the reader to edit and send (AppLayout.openBayBay). */
export type GuideAsk = (question: string, options?: { mode?: 'send' | 'draft' }) => void;

/**
 * The guide's action bar on DETAIL's contract (UI9-GUIDES; lanes/UI9-DETAIL/BAR-CONTRACT.md, owner decision 18): the cells
 * ♡ 收藏 · 发家人 · 问 BayBay, then the one primary, always last — 📞 拨打 <number> (the cover slide's phone, else the first
 * contact: guideCallOf) or, on a guide without a number, 官方入口 ↗ (its first source). On a phone it is fixed at the bottom
 * and replaces the tab bar (`chrome: 'detail'` on /guides/:slug); on a desktop it is the card in the article's right rail.
 * DETAIL owns every `.site-detail-actions` / `.detail-actions*` rule; guide-article.css styles only the call's number.
 * 问 BayBay opens the panel with this guide as its 正在看 capsule and a question for this kind of guide in the box (draft
 * mode, H32 / FCC-05): nothing is sent, and no daily question is used, until the reader presses send.
 */
export function GuideActions({ guide, call, official, onAsk }: { guide: Guide; call?: GuideCall; official?: { title: string; url: string }; onAsk?: GuideAsk }) {
  const { t, locale } = useUiCopy();
  const app = useApp() as AppContextValue | undefined;
  // Outside the app shell (tests, an embed) there is no toast: the message shows under the bar instead.
  const [status, setStatus] = useState('');
  const say = (message: string, kind: 'success' | 'info') => { if (app?.showToast) app.showToast(message, kind); else setStatus(message); };
  // The reading history ("最近读过" on /guides?view=saved) stays in this browser.
  useEffect(() => { rememberGuide(guide.slug); }, [guide.slug]);
  const title = translateText(guide.title, locale);
  const question = guideBayBayQuestion(guide, t, title);
  const sendToFamily = async () => {
    const url = withFamilyReading(localizedUrl(`${SITE_URL}/guides/${guide.slug}?from=family`, locale));
    const text = t(`${title}\n大字、简洁版，打开就能看：`, `${title}\nLarge text, simple view:`);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title, text, url }); return; }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return; }
    }
    const copied = await copyText(`${text}\n${url}`);
    say(copied ? t('链接已复制，发到家庭群就好；家人打开是大字、简洁显示。', 'Link copied. Paste it to your family; it opens in large text and simple view.')
      : t('浏览器未允许复制，请长按地址栏复制链接。', 'Copy was blocked; copy the link from the address bar.'), copied ? 'success' : 'info');
  };
  const askLabel = t('问 BayBay 这一页', 'Ask BayBay about this page');
  const ask = <><img src="/brand/otter.svg" alt="" width={24} height={24} aria-hidden="true" /><span data-label="long">{t('问 BayBay', 'Ask BayBay')}</span><span data-label="tight">BayBay</span></>;
  const primary = 'detail-actions__primary detail-action detail-action--primary';
  return <><div className="site-detail-actions detail-actions gd-bar" role="group" aria-label={t('这一页的操作', 'Actions for this page')}>
    <div className="detail-actions__cell" data-cell="save"><SaveToWeek favorite={{ kind: 'guide', id: guide.slug }} title={guide.title} compact /></div>
    <button type="button" className="detail-actions__cell" data-cell="family" onClick={() => void sendToFamily()}>
      <Send aria-hidden="true" strokeWidth={1.75} /><span data-label="phone">{t('发家人', 'Family')}</span><span data-label="desk">{t('发给家人', 'Send to family')}</span><span className="ui-visually-hidden">{t('（大字版）', ' (large text)')}</span>
    </button>
    {onAsk ? <button type="button" className="detail-actions__cell" data-cell="ask" aria-label={askLabel} onClick={() => onAsk(question, { mode: 'draft' })}>{ask}</button>
      : <a className="detail-actions__cell" data-cell="ask" aria-label={askLabel} href={`/plan?q=${encodeURIComponent(question)}`}>{ask}</a>}
    {call ? <Button variant="primary" className={`${primary} gd-bar__call`} href={`tel:${call.tel}`} aria-label={t(`拨打 ${call.label.zh} ${call.number}`, `Call ${call.label.en} ${call.number}`)}
      icon={<Phone aria-hidden="true" strokeWidth={1.75} />}><span className="gd-bar__verb">{t('拨打', 'Call')} </span><span className="gd-bar__number">{call.number}</span></Button>
      : official ? <Button variant="primary" className={primary} href={official.url} target="_blank" rel="noopener noreferrer" aria-label={t('官方入口（在新标签页打开）', 'Official site (opens in a new tab)')}>
        <span>{t('官方入口', 'Official site')}</span><span aria-hidden="true">↗</span></Button> : null}
  </div>
  {status && <p className="gd-actions__status" role="status">{status}</p>}</>;
}
