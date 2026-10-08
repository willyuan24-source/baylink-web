import React, { type ReactNode } from 'react';
import { languagePath, type SiteLanguage } from '../src/lib/language-path';

const LABELS: Record<SiteLanguage, string[]> = {
  'zh-Hans': ['网站导航', '首页', '活动', '指南', '我的', '关于我们', '服务条款', '隐私政策', '短信验证说明', '已发布内容目录'],
  'zh-Hant': ['網站導航', '首頁', '活動', '指南', '我的', '關於我們', '服務條款', '隱私政策', '簡訊驗證說明', '已發布內容目錄'],
  en: ['Site navigation', 'Home', 'Events', 'Guides', 'Me', 'About', 'Terms', 'Privacy', 'SMS consent', 'Published directory'],
};

/**
 * Static first-paint shell for the prerendered pages. The header links are the app's own (SiteNavigation /
 * SiteMobileNavigation). 问 BayBay opens a panel there, not a page, so the shell has no link for it: it used to point
 * at /plan under the 问 BayBay label (REG-06). tests/prerender-shell-nav.test.tsx renders both and compares them.
 */
export const Shell = ({ children, locale }: { children: ReactNode; locale: SiteLanguage }) => {
  const labels = LABELS[locale];
  const nav: Array<[string, string]> = [['/', labels[1]], ['/calendar', labels[2]], ['/guides', labels[3]], ['/me', labels[4]]];
  const footer: Array<[string, string]> = [['/about', labels[5]], ['/terms', labels[6]], ['/privacy', labels[7]], ['/sms-consent', labels[8]], ['/archive', labels[9]]];
  return (
  <div className="min-h-screen bg-baylink-bg text-baylink-text">
    <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 border-b border-baylink-border px-5 py-4">
      <a href={languagePath('/', locale)} className="text-lg font-bold text-baylink-green">BAYLINK</a>
      <nav aria-label={labels[0]} className="flex flex-wrap gap-4 text-sm">
        {nav.map(([path, label]) => <a key={path} href={languagePath(path, locale)}>{label}</a>)}
      </nav>
    </header>
    <main className="mx-auto max-w-4xl">{children}</main>
    <footer className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4 px-5 py-8 text-xs text-baylink-muted">
      {footer.map(([path, label]) => <a key={path} href={languagePath(path, locale)}>{label}</a>)}
    </footer>
  </div>
  );
};
