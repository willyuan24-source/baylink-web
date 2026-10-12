import { pathLanguage, type SiteLanguage } from '../lib/language-path';

/**
 * REG+2: a boot step failed (the page's code or its language did not load). The page must never look ready while doing
 * nothing, so a 16 px bar says so and offers a reload, in the URL's language (the dictionary may be what failed).
 */
const retryBarCopy = {
  message: { 'zh-Hans': '部分功能没加载完', 'zh-Hant': '部分功能沒載入完', en: 'Some features did not load' },
  retry: { 'zh-Hans': '重试', 'zh-Hant': '重試', en: 'Retry' },
};

export function showBootRetryBar(pathname = window.location.pathname): void {
  if (document.querySelector('.site-boot-retry')) return;
  const language = pathLanguage(pathname);
  const bar = document.createElement('div');
  bar.className = 'site-boot-retry';
  bar.setAttribute('role', 'alert');
  const text = document.createElement('span');
  text.textContent = retryBarCopy.message[language];
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = retryBarCopy.retry[language];
  retry.addEventListener('click', () => window.location.reload());
  bar.append(text, retry);
  document.body.append(bar);
}

export type BootSteps = {
  /** initializeLocale(): the URL's language and its dictionary */
  locale: Promise<unknown>;
  /** the current page's chunk (route-loaders, shared with the router) */
  loadPage: () => Promise<unknown>;
  renderApp: () => void;
  showRetryBar: () => void;
  /** the URL's language */
  language: SiteLanguage;
  /** a page prerendered for this very URL is on screen (boot-main.ts captured it) */
  prerendered: boolean;
  /** #root has any content (a prerendered page, possibly another URL's: an SPA route is served the home page's HTML) */
  rootHasContent: () => boolean;
  /** after both steps settled (the product observer) */
  onSettled?: () => void;
  retryMs?: number;
};

/** What boot left on screen: the app, the app under the retry bar, or the prerendered page under the retry bar. */
export type BootOutcome = 'app' | 'app+bar' | 'prerender+bar';

/**
 * Start the app once the page's code and the language are in (quality lens §2.4 item 4). Whatever fails, the reader is
 * left with a readable page and, when something is missing, the retry bar:
 * - all loaded: the app;
 * - the page's code does not load (one more try after 1.5 s): the prerendered page stays (offline: it is still the useful
 *   page) with the bar; with nothing prerendered the app renders and shows its own loading and error states;
 * - only the dictionary failed: the app in 简体 with the bar, except over a 繁體 or English page prerendered for this
 *   URL: that page is readable in the reader's own language and its links load full pages, so it stays, with the bar,
 *   instead of being replaced by Chinese the reader may not read.
 */
export async function bootApp(steps: BootSteps): Promise<BootOutcome> {
  const [language, page] = await Promise.allSettled([steps.locale, steps.loadPage()]);
  steps.onSettled?.();
  const pageReady = page.status === 'fulfilled'
    || await new Promise(resolve => setTimeout(resolve, steps.retryMs ?? 1500)).then(() => steps.loadPage()).then(() => true, () => false);
  if (pageReady && language.status === 'fulfilled') {
    steps.renderApp();
    return 'app';
  }
  const keepPrerender = pageReady
    ? steps.language !== 'zh-Hans' && steps.prerendered
    : steps.rootHasContent();
  if (!keepPrerender) steps.renderApp();
  steps.showRetryBar();
  return keepPrerender ? 'prerender+bar' : 'app+bar';
}
