import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { translateText, useLocale } from '../i18n/locale';
import { useLegalCopy } from './legal-copy';
import { PageContainer, PageHeader } from './ui/HeroCard';
import './legal-page.css';

type Copy = { zh: string; en: string };

const formatUpdated = (day: string, english: boolean) => {
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
};

/**
 * The legal pages (privacy, terms, SMS consent): reading container, the shared H1 spec, the date it was last changed. The
 * English text is the full policy; Chinese pages add plain-language summaries and Chinese versions of some sections, which
 * English pages leave out (<ZhOnly>) instead of showing Chinese to English readers (RC-24, I18N-SEO-09). Chinese pages keep
 * the English title and "Last updated" date next to the Chinese ones: their bodies are English-first, and carrier / Twilio
 * reviewers open the unprefixed /sms-consent URL.
 */
export function LegalPageLayout({ title, updated, children }: { title: Copy; /** YYYY-MM-DD */ updated: string; children: ReactNode }) {
  const { english, t } = useLegalCopy();
  return <PageContainer size="reading" className="legal-page">
    <PageHeader
      breadcrumb={<span><Link to="/about">{t('关于与核验方法', 'About and sources')}</Link><span aria-hidden="true"> / </span><span aria-current="page">{t(title.zh, title.en)}</span></span>}
      title={english ? title.en : `${t(title.zh, title.en)} · ${title.en}`}
      lede={english
        ? <span>Last updated: <time dateTime={updated}>{formatUpdated(updated, true)}</time></span>
        : <span>{t('更新日期：', 'Last updated: ')}<time dateTime={updated}>{formatUpdated(updated, false)}</time><span className="legal-updated-en" lang="en">Last updated: {formatUpdated(updated, true)}</span></span>} />
    <div className="legal-doc">{children}</div>
    <nav className="legal-related" aria-label={t('网站说明', 'Site policies')}>
      <Link to="/terms">{t('服务条款', 'Terms of Service')}</Link>
      <Link to="/privacy">{t('隐私政策', 'Privacy Policy')}</Link>
      <Link to="/sms-consent">{t('短信同意说明', 'SMS Consent')}</Link>
      <Link to="/about">{t('关于与核验方法', 'About and sources')}</Link>
    </nav>
  </PageContainer>;
}

export const LegalSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="legal-section">
    <h2>{title}</h2>
    {children}
  </section>
);

/** A paragraph; `lang="en"` marks the English policy text on a Chinese page. */
export const LegalP = ({ children, lang }: { children: ReactNode; lang?: string }) => <p lang={lang}>{children}</p>;

export const LegalUl = ({ items }: { items: ReactNode[] }) => (
  <ul>
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

/** Chinese-only text: a Chinese version of an English paragraph next to it, or a note for Chinese readers. */
export function ZhOnly({ children }: { children: ReactNode }) {
  return useLocale() === 'en' ? null : <>{children}</>;
}

/**
 * A Chinese UI label quoted inside English text ("发送验证码 / Send verification code"). English pages mark it as Chinese and
 * keep it from being machine-translated; Chinese pages show it as the button reads in their script (zh-Hant: 發送驗證碼).
 */
export function ZhLabel({ children }: { children: string }) {
  const locale = useLocale();
  return locale === 'en' ? <span lang="zh-Hans" translate="no">{children}</span> : <>{translateText(children, locale)}</>;
}
