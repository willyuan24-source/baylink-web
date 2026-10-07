import { mkdir, readFile, writeFile } from 'node:fs/promises';
import '../src/i18n/router';
import '../src/i18n/metadata';
import { setLocale, translateText } from '../src/i18n/locale';
import { languagePath, languagePrefix, type SiteLanguage } from '../src/lib/language-path';
import { dirname, join, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import React, { type ReactNode } from 'react';
import { guides, getGuidesForCategorySlug } from '../src/data/guides';
import { EditorialCollections } from '../src/components/EditorialCollections';
import { GuideDetail } from '../src/components/GuideDetail';
import { GuidesHome } from '../src/components/GuidesHome';
import { TermsView } from '../src/components/TermsView';
import { PrivacyPolicyView } from '../src/components/PrivacyPolicyView';
import { SmsConsentView } from '../src/components/SmsConsentView';
import { AboutContent } from '../src/components/AboutContent';
import { ABOUT_METADATA } from '../src/lib/about-metadata';
import ArchivePage from '../src/pages/ArchivePage';
import { ARCHIVE_METADATA } from '../src/lib/archive-metadata';
import NotFoundPage from '../src/pages/NotFoundPage';
import { SLUG_TO_CATEGORY } from '../src/routing';
import { renderHtmlDocument, SITE_STRUCTURED_DATA, type PageMetadata } from '../src/lib/seo';
import { getGuideMetadata } from '../src/lib/guide-metadata';
import { LIFE_TOOLS, TOOLS_METADATA } from '../src/data/tool-catalog';
import { MonthlyEdition } from '../src/components/MonthlyEdition';
import NotificationTokenPage from '../src/pages/NotificationTokenPage';
import { MonthlySpotlight } from '../src/components/MonthlySpotlight';
import { MONTHLY_METADATA, WEEKLY_METADATA } from '../src/lib/monthly-metadata';
import { HomeDiscovery } from '../src/components/HomeDiscovery';
import { AttractionExplorer } from '../src/components/AttractionExplorer';
import { EXPLORE_METADATA } from '../src/data/attractions';
import { localDiscoveries } from '../src/data/local-discoveries';
import { generateSitemap } from './generate-sitemap';
import { LocalDiscoveryDetail } from '../src/components/LocalDiscoveryDetail';
import { getDiscoveryMetadata } from '../src/lib/discovery-metadata';

import CalendarPage from '../src/pages/CalendarPage';
import { CALENDAR_METADATA } from '../src/lib/event-calendar';
import PlannerPage from '../src/pages/PlannerPage';
import AiLocalPage from '../src/pages/AiLocalPage';
import { PLAN_METADATA } from '../src/lib/planner';
import { OpusBayShell } from '../src/components/OpusBayShell';
import { opusBayHeadExtras, opusBayInHalloween, opusBayMetadata } from '../src/lib/opus-bay-metadata';

// PRERENDER_OUT_DIR: QA renders a scratch build (vite build --outDir <dir>) without touching ./dist (W9-E)
const outputDir = resolve(process.env.PRERENDER_OUT_DIR || 'dist');
const template = await readFile(join(outputDir, 'index.html'), 'utf8');
const noop = () => {};
const manifest = JSON.parse(await readFile(join(outputDir, '.vite/manifest.json'), 'utf8'));
const routeModule = (path: string) => path.startsWith('/guides/') ? 'GuideDetailPage' : /^\/(events|offers|openings)\//.test(path) ? 'LocalDiscoveryPage' : ({ '/': 'HomePage', '/guides': 'GuidesPage', '/archive': 'ArchivePage', '/calendar': 'CalendarPage', '/plan': 'PlannerPage', '/this-month': 'MonthlyPage', '/this-week': 'MonthlyPage', '/explore': 'ExplorePage', '/tools': 'ToolsPage', '/about': 'AboutPage', '/ai-in-the-bay': 'AiLocalPage', '/recommend': 'RecommendPage' } as Record<string,string>)[path] || 'HomePage';
const modulePreloads = (path: string) => {
  const entry = manifest[`src/pages/${routeModule(path)}.tsx`]; const files = new Set<string>();
  const visit = (item: { file: string; imports?: string[] }) => { if (files.has(item.file)) return; files.add(item.file); for (const key of item.imports || []) if (manifest[key]) visit(manifest[key]); };
  if (entry) visit(entry);
  return [...files].map(file => `<link rel="modulepreload" href="/${file}" />`).join('\n');
};

const Shell = ({ children, locale }: { children: ReactNode; locale: SiteLanguage }) => {
  const labels = locale === 'en'
    ? ['Site navigation', 'Home', 'Events', 'Guides', 'Ask BayBay', 'Me', 'About', 'Terms', 'Privacy', 'SMS consent', 'Published directory']
    : locale === 'zh-Hant'
      ? ['網站導航', '首頁', '活動', '指南', '問 BayBay', '我的', '關於我們', '服務條款', '隱私政策', '簡訊驗證說明', '已發布內容目錄']
      : ['网站导航', '首页', '活动', '指南', '问 BayBay', '我的', '关于我们', '服务条款', '隐私政策', '短信验证说明', '已发布内容目录'];
  return (
  <div className="min-h-screen bg-baylink-bg text-baylink-text">
    <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 border-b border-baylink-border px-5 py-4">
      <a href={languagePath('/', locale)} className="text-lg font-bold text-baylink-green">BAYLINK</a>
      <nav aria-label={labels[0]} className="flex flex-wrap gap-4 text-sm">
        {['/', '/calendar', '/guides', '/plan', '/me'].map((path, index) => <a key={path} href={languagePath(path, locale)}>{labels[index + 1]}</a>)}
      </nav>
    </header>
    <main className="mx-auto max-w-4xl">{children}</main>
    <footer className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4 px-5 py-8 text-xs text-baylink-muted">
      {['/about', '/terms', '/privacy', '/sms-consent', '/archive'].map((path, index) => <a key={path} href={languagePath(path, locale)}>{labels[index + 6]}</a>)}
    </footer>
  </div>
  );
};

const renderPage = async (metadata: PageMetadata, content: ReactNode, filename?: string) => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as SiteLanguage[]) {
    await setLocale(locale, false);
    const path = languagePath(metadata.path, locale);
    const body = renderToStaticMarkup(<StaticRouter basename={languagePrefix(locale) || undefined} location={path}><Shell locale={locale}>{content}</Shell></StaticRouter>);
    const relative = filename || (metadata.path === '/' ? 'index.html' : `${metadata.path.slice(1)}.html`);
    const destination = join(outputDir, languagePrefix(locale).slice(1), relative);
    if (!destination.startsWith(outputDir + '/') && !destination.startsWith(outputDir + '\\')) throw new Error('Invalid prerender destination');
    await mkdir(dirname(destination), { recursive: true });
    const html = renderHtmlDocument(template, { ...metadata, path }, body).replace(/<html lang="[^"]+"/, `<html lang="${locale}"`).replace('<!--baylink-meta-end-->', () => modulePreloads(metadata.path) + '\n<!--baylink-meta-end-->');
    await writeFile(destination, html);
  }
  await setLocale('zh-Hans', false);
};

const homeDescription = '湾区活动、免费福利与实用生活指南，附官方来源和核对日期。搜索下一步，或向 BayBay 提问。';
await renderPage({ title: 'BAYLINK｜湾区去哪、怎么办——有来源的中文答案', description: homeDescription, path: '/', structuredData: SITE_STRUCTURED_DATA }, (
  <section className="px-5 py-8">
    <HomeDiscovery onAskBayBay={noop} onBrowseCommunity={noop} />
  </section>
));

await renderPage({ title: '湾区生活指南｜BAYLINK', description: '查看湾区租房、找室友、二手交易、本地服务、交通与城市生活指南，附官方参考资料和行动清单。', path: '/guides' }, <GuidesHome onOpenGuide={noop} />);
await renderPage(MONTHLY_METADATA, <MonthlyEdition defaultDateFilter="all" />);
await renderPage(WEEKLY_METADATA, <MonthlyEdition defaultDateFilter="weekend" />);
await renderPage(CALENDAR_METADATA, <CalendarPage />);
await renderPage(EXPLORE_METADATA, <AttractionExplorer />);
await renderPage(PLAN_METADATA, <PlannerPage />);
// W9-E (review 2026-10-01 R§5 #3): /opus-bay is its own page, no longer the homepage's HTML — its own title, description,
// canonical, hreflang and share card (the key art's 1200 × 630 crop), and a static first paint that looks like the game's
// title (OpusBayShell; App.tsx shows the same markup until the game's route chunk is in), with the same script / css tags.
const buildDate = new Date();
const opusBayDocument = (metadata: PageMetadata): string =>
  renderHtmlDocument(template, metadata, renderToStaticMarkup(<OpusBayShell halloween={opusBayInHalloween(buildDate)} />))
    .replace('<!--baylink-meta-end-->', () => `${opusBayHeadExtras(metadata.path.startsWith('/en/') ? 'en_US' : metadata.path.startsWith('/zh-Hant/') ? 'zh_TW' : 'zh_CN')}\n    <!--baylink-meta-end-->`);
await writeFile(join(outputDir, 'opus-bay.html'), opusBayDocument(opusBayMetadata(buildDate)));
for (const locale of ['en', 'zh-Hant'] as const) {
  await setLocale(locale, false); await mkdir(join(outputDir, locale), { recursive: true });
  const gameMetadata = opusBayMetadata(buildDate, locale === 'en' ? 'en' : 'zh');
  const metadata = { ...gameMetadata, title: translateText(gameMetadata.title, locale), description: translateText(gameMetadata.description, locale), imageAlt: translateText(gameMetadata.imageAlt || gameMetadata.title, locale), path: languagePath('/opus-bay', locale) };
  await writeFile(join(outputDir, locale, 'opus-bay.html'), opusBayDocument(metadata).replace(/<html lang="[^"]+"/, `<html lang="${locale}"`));
  await writeFile(join(outputDir, locale, 'play.html'), opusBayDocument(metadata).replace(/<html lang="[^"]+"/, `<html lang="${locale}"`));
}
await setLocale('zh-Hans', false);
// W9-E-switch: /play is the game now — its page is the game's shell with canonical /opus-bay (App.tsx's PlayRedirect sends
// the visitor on, keeping ?lang; an old weekend ticket goes to /plan); out of the sitemap
await writeFile(join(outputDir, 'play.html'), opusBayDocument(opusBayMetadata(buildDate)));
await renderPage({title:'湾区 AI 现场｜BAYLINK',description:'AI Week SF 与 SF Tech Week 的真实场次、报名要求、费用与第一次参加的实用准备。',path:'/ai-in-the-bay'}, <AiLocalPage />);
await renderPage(ABOUT_METADATA, <AboutContent />);
await renderPage(ARCHIVE_METADATA, <ArchivePage />);
await renderPage(TOOLS_METADATA, <section className="px-5 py-8"><h1 className="text-3xl font-bold">湾区生活工具箱</h1><p className="mt-3 leading-relaxed">AI 沟通、日常换算、费用计算和生活清单，让湾区日常更方便。</p><ul className="mt-6 space-y-5">{LIFE_TOOLS.map(tool => <li key={tool.id}><a href={`/tools?tool=${tool.id}`} className="text-lg font-semibold text-baylink-green">{tool.title}</a><p className="mt-2 leading-relaxed">{tool.description}</p></li>)}</ul><p className="mt-6 text-sm">互动工具在页面加载后即可使用。计算在浏览器本机完成；AI 沟通只在点击生成后提交内容。</p></section>);
for (const guide of guides) {
  await renderPage(getGuideMetadata(guide), <GuideDetail slug={guide.slug} onBack={noop} onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} />);
}
for (const item of localDiscoveries) {
  await renderPage(getDiscoveryMetadata(item), <LocalDiscoveryDetail item={item} />);
}
for (const [slug, category] of Object.entries(SLUG_TO_CATEGORY)) {
  await renderPage({ title: `${category}｜湾区本地信息 · BAYLINK`, description: `浏览湾区${category}信息，按地区查找本地资源和邻里需求。请联系发布者确认信息仍有效。`, path: `/category/${slug}` }, (
    <section className="px-5 py-8"><h1 className="text-2xl font-bold">湾区{category}信息</h1><p className="mt-3">浏览本地资源和邻里需求，联系前请确认地点、价格和时间。</p><h2 className="mt-6 font-bold">行动前，先读一份实用指南</h2><ul className="mt-3 space-y-3">{getGuidesForCategorySlug(slug).map((guide) => <li key={guide.slug}><a href={`/guides/${guide.slug}`} className="text-baylink-green underline">{guide.title}</a><p className="mt-1 text-sm">{guide.summary}</p></li>)}</ul><a className="mt-5 inline-block text-baylink-green underline" href="/guides">全部生活指南</a><p className="mt-3 text-sm text-baylink-muted">最新帖子和地区筛选会在页面加载后显示。</p></section>
  ));
}
await renderPage({ title: '编辑推荐｜BAYLINK', description: '按生活场景阅读 BAYLINK 编辑专题、实用指南和本地信息。推荐不构成资质或交易担保。', path: '/recommend' }, <section className="px-5 py-8"><h1 className="text-2xl font-bold">编辑推荐</h1><p className="mt-3">从抵达湾区、寻找帮助到周末探索，按主题找到下一步。</p><EditorialCollections /><MonthlySpotlight /><a href="/" className="mt-5 inline-block text-baylink-green underline">浏览全部本地信息</a></section>);
await renderPage({ title: '服务条款｜BAYLINK', description: '了解 BAYLINK 的账号、信息发布、用户交易、AI 功能和短信验证使用条款。', path: '/terms' }, <TermsView />);
await renderPage({ title: '隐私政策｜BAYLINK', description: '了解 BAYLINK 账号资料、公开内容、验证手机号、联系方式分享与隐私申请说明。', path: '/privacy' }, <PrivacyPolicyView />);
await renderPage({ title: '短信验证说明｜BAYLINK', description: '了解 BAYLINK 手机验证码的主动请求、用途、短信费用、退订与帮助说明。', path: '/sms-consent' }, <SmsConsentView />);
await renderPage({ title: '验证邮箱｜BAYLINK', description: '确认由本人发起的邮箱验证请求。', path: '/verify-email', noindex: true }, <NotificationTokenPage purpose="verify" />);
await renderPage({ title: '取消站外通知｜BAYLINK', description: '主动取消 BAYLINK 邮件或短信提醒。', path: '/notifications/unsubscribe', noindex: true }, <NotificationTokenPage purpose="unsubscribe" />);
await renderPage({ title: '页面不存在｜BAYLINK', description: '没有找到这个页面。请检查链接，或返回 BAYLINK 首页。', path: '/404', noindex: true }, <NotFoundPage />, '404.html');

const { paths: sitemapPaths, xml: sitemap } = generateSitemap();
await writeFile(join(outputDir, 'sitemap.xml'), sitemap);
console.log(`Prerendered ${sitemapPaths.length + 1} public HTML pages and sitemap. No authenticated or live user data was fetched.`);
