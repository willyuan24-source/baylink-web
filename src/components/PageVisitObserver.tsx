import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { recordProductEvent, type VisitEvent } from '../lib/product-events';

/** Classify attribution locally; raw query values and referrers never leave the browser. */
export function visitSource(search: string, referrer = ''): VisitEvent {
  const query = new URLSearchParams(search);
  const from = query.get('from') || '';
  if (/^card-[a-z0-9-]{1,40}$/.test(from)) return 'site_source_card';
  if (/^(opus|opus-bay|opus-return|opus-place|opus-postcard)$/.test(from)) return 'site_source_opus';
  const source = (query.get('utm_source') || '').toLowerCase().trim();
  if (/^(wechat|weixin|微信)$/.test(source)) return 'site_source_wechat';
  if (/^(google|bing|baidu|search)$/.test(source)) return 'site_source_search';
  if (/^(facebook|instagram|xiaohongshu|xhs|rednote|twitter|x|social)$/.test(source)) return 'site_source_social';
  if (source) return 'site_source_other';
  if (!referrer) return 'site_source_direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host === 'baylink.us' || host === 'www.baylink.us') return 'site_source_direct';
    if (/(^|\.)(google\.[a-z.]+|bing\.com|baidu\.com)$/.test(host)) return 'site_source_search';
    if (/(^|\.)(weixin\.qq\.com|wechat\.com)$/.test(host)) return 'site_source_wechat';
    if (/(^|\.)(facebook\.com|instagram\.com|xiaohongshu\.com|x\.com|twitter\.com)$/.test(host)) return 'site_source_social';
  } catch { /* Invalid referrers are merely an unknown source. */ }
  return 'site_source_other';
}

export function PageVisitObserver() {
  const { pathname, search } = useLocation();
  const lastPath = useRef<string | null>(null);
  const attributed = useRef(false);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    recordProductEvent('page_view');
    if (!attributed.current) {
      attributed.current = true;
      recordProductEvent(visitSource(search, document.referrer));
    }
  }, [pathname, search]);
  return null;
}
