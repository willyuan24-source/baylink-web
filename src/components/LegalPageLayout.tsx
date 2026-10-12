import React, { Children, isValidElement } from 'react';
import { translateText, useLocale } from '../i18n/locale';

type LegalPageLayoutProps = {
  title: string;
  updated: string;
  children: React.ReactNode;
};

/**
 * The legal pages are bilingual: the English text is complete and binding, the Chinese paragraphs are reading aids for
 * it. On /en a paragraph, bullet or title part written in Chinese is the twin of English beside it, so it is left out
 * (I18N-SEO-09: /en/privacy and /en/terms carried ~1,000 Chinese characters); the Chinese pages show both, as before.
 */
const HAN = /[㐀-鿿]/;
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;
const chineseOnly = (node: React.ReactNode): boolean => {
  if (typeof node !== 'string') return false;
  const han = count(node, /[㐀-鿿]/g);
  return han > 0 && han >= count(node, /[A-Za-z]/g);
};
/** "隐私政策 · Privacy Policy" → "Privacy Policy"; an all-Chinese title goes through the dictionary. */
const englishTitle = (title: string): string | undefined => {
  if (!HAN.test(title)) return title;
  const parts = title.split(/ · | \/ /);
  const latin = parts.filter(part => !HAN.test(part));
  if (latin.length) return latin.join(' · ');
  const translated = translateText(title, 'en');
  return HAN.test(translated) ? undefined : translated;
};
type LegalChild = { children?: React.ReactNode; items?: React.ReactNode[] };
const hasEnglish = (children: React.ReactNode) => Children.toArray(children).some(child => {
  if (!isValidElement<LegalChild>(child)) return !chineseOnly(child as React.ReactNode);
  if (child.type === LegalP) return !chineseOnly(child.props.children);
  if (child.type === LegalUl) return (child.props.items ?? []).some(item => !chineseOnly(item));
  return true;
});

export const LegalPageLayout = ({ title, updated, children }: LegalPageLayoutProps) => {
  const english = useLocale() === 'en';
  return (
    <div className="px-4 py-6 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] lg:pb-10 max-w-2xl mx-auto w-full">
      <article className="rounded-[24px] border border-baylink-border/40 bg-white/90 shadow-rest backdrop-blur-sm p-6 sm:p-8">
        <header className="mb-6 border-b border-baylink-border/30 pb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-baylink-text leading-tight">{english ? englishTitle(title) ?? title : title}</h1>
          <p className="mt-2 text-xs text-baylink-muted">Last updated: {updated}</p>
        </header>
        <div className="space-y-5 text-sm leading-relaxed text-baylink-text-secondary legal-doc">
          {children}
        </div>
      </article>
    </div>
  );
};

export const LegalSection = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const english = useLocale() === 'en';
  if (english && !hasEnglish(children)) return null;
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-baylink-text">{english ? englishTitle(title) ?? 'Highlights' : title}</h2>
      {children}
    </section>
  );
};

export const LegalP = ({ children }: { children: React.ReactNode }) => {
  const english = useLocale() === 'en';
  if (english && chineseOnly(children)) return null;
  return <p className="mb-2 last:mb-0">{children}</p>;
};

export const LegalUl = ({ items }: { items: React.ReactNode[] }) => {
  const english = useLocale() === 'en';
  const shown = english ? items.filter(item => !chineseOnly(item)) : items;
  if (!shown.length) return null;
  return (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
      {shown.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
};
