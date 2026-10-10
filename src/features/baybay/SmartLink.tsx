import type { MouseEvent, ReactNode } from 'react';
import { useLocale } from '../../i18n/locale';
import { bayBaySitePath } from './site-path';

type Navigate = (path: string) => void;

/** A link that opens BAYLINK pages inside the app (closing the panel) and everything else in a new tab. */
export function SmartLink({ href, onNavigate, className, children, title }: { href: string; onNavigate?: Navigate; className?: string; children: ReactNode; title?: string }) {
  const locale = useLocale();
  const path = href.startsWith('/') && !href.startsWith('//') ? href : bayBaySitePath(href);
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!path || !onNavigate || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(path);
  };
  return path ? <a className={className} href={`${locale === 'zh-Hans' ? '' : `/${locale}`}${path}`} title={title} onClick={open}>{children}</a>
    : <a className={className} href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>;
}
