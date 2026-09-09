import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
import NotFoundPage from '../src/pages/NotFoundPage';
import { SLUG_TO_CATEGORY } from '../src/routing';
import { SITE_URL, escapeHtml, renderHtmlDocument, type PageMetadata } from '../src/lib/seo';
import { getGuideMetadata } from '../src/lib/guide-metadata';

const outputDir = resolve('dist');
const template = await readFile(join(outputDir, 'index.html'), 'utf8');
const noop = () => {};

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-baylink-bg text-baylink-text">
    <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 border-b border-baylink-border px-5 py-4">
      <a href="/" className="text-lg font-bold text-baylink-green">BAYLINK</a>
      <nav aria-label="网站导航" className="flex gap-4 text-sm">
        <a href="/">本地信息</a><a href="/guides">生活指南</a><a href="/recommend">编辑推荐</a>
      </nav>
    </header>
    <main className="mx-auto max-w-4xl">{children}</main>
    <footer className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4 px-5 py-8 text-xs text-baylink-muted">
      <a href="/terms">服务条款</a><a href="/privacy">隐私政策</a><a href="/sms-consent">短信验证说明</a>
    </footer>
  </div>
);

const renderPage = async (metadata: PageMetadata, content: ReactNode, filename?: string) => {
  const body = renderToStaticMarkup(<StaticRouter location={metadata.path}><Shell>{content}</Shell></StaticRouter>);
  const destination = join(outputDir, filename || (metadata.path === '/' ? 'index.html' : `${metadata.path.slice(1)}.html`));
  if (!destination.startsWith(outputDir + '/') && !destination.startsWith(outputDir + '\\')) throw new Error('Invalid prerender destination');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, renderHtmlDocument(template, metadata, body));
};

const homeDescription = '找房、找室友、二手交易、本地服务、接送和湾区生活指南。BAYLINK 连接湾区邻里。';
await renderPage({ title: 'BAYLINK｜湾区华人本地生活平台', description: homeDescription, path: '/' }, (
  <section className="px-5 py-8">
    <h1 className="text-3xl font-bold">湾区华人本地生活平台</h1>
    <p className="mt-3 leading-relaxed">{homeDescription}</p>
    <nav aria-label="本地信息分类" className="mt-6 flex flex-wrap gap-3">
      {Object.entries(SLUG_TO_CATEGORY).map(([slug, title]) => <a key={slug} href={`/category/${slug}`} className="rounded-xl border border-baylink-border bg-white px-4 py-2">{title}</a>)}
    </nav>
    <h2 className="mt-8 text-xl font-bold">从生活指南开始</h2>
    <ul className="mt-4 space-y-3">{guides.filter((guide) => guide.featuredOnHome).map((guide) => <li key={guide.slug}><a href={`/guides/${guide.slug}`} className="font-semibold text-baylink-green">{guide.title}</a><p className="mt-1 text-sm">{guide.summary}</p></li>)}</ul>
    <EditorialCollections />
  </section>
));

await renderPage({ title: '湾区生活指南｜BAYLINK', description: '查看湾区租房、找室友、二手交易、本地服务、交通与城市生活指南，附官方参考资料和行动清单。', path: '/guides' }, <GuidesHome onOpenGuide={noop} />);
for (const guide of guides) {
  await renderPage(getGuideMetadata(guide), <GuideDetail slug={guide.slug} onBack={noop} onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} />);
}
for (const [slug, category] of Object.entries(SLUG_TO_CATEGORY)) {
  await renderPage({ title: `${category}｜湾区本地信息 · BAYLINK`, description: `浏览湾区${category}信息，按地区查找本地资源和邻里需求。请联系发布者确认信息仍有效。`, path: `/category/${slug}` }, (
    <section className="px-5 py-8"><h1 className="text-2xl font-bold">湾区{category}信息</h1><p className="mt-3">浏览本地资源和邻里需求，联系前请确认地点、价格和时间。</p><h2 className="mt-6 font-bold">行动前，先读一份实用指南</h2><ul className="mt-3 space-y-3">{getGuidesForCategorySlug(slug).map((guide) => <li key={guide.slug}><a href={`/guides/${guide.slug}`} className="text-baylink-green underline">{guide.title}</a><p className="mt-1 text-sm">{guide.summary}</p></li>)}</ul><a className="mt-5 inline-block text-baylink-green underline" href="/guides">全部生活指南</a><p className="mt-3 text-sm text-baylink-muted">最新帖子和地区筛选会在页面加载后显示。</p></section>
  ));
}
await renderPage({ title: '编辑推荐｜BAYLINK', description: '按生活场景阅读 BAYLINK 编辑专题、实用指南和本地信息。推荐不构成资质或交易担保。', path: '/recommend' }, <section className="px-5 py-8"><h1 className="text-2xl font-bold">编辑推荐</h1><p className="mt-3">从抵达湾区、寻找帮助到周末探索，按主题找到下一步。</p><EditorialCollections /><a href="/" className="mt-5 inline-block text-baylink-green underline">浏览全部本地信息</a></section>);
await renderPage({ title: '服务条款｜BAYLINK', description: '了解 BAYLINK 的账号、信息发布、用户交易、AI 功能和短信验证使用条款。', path: '/terms' }, <TermsView />);
await renderPage({ title: '隐私政策｜BAYLINK', description: '了解 BAYLINK 账号资料、公开内容、验证手机号、联系方式分享与隐私申请说明。', path: '/privacy' }, <PrivacyPolicyView />);
await renderPage({ title: '短信验证说明｜BAYLINK', description: '了解 BAYLINK 手机验证码的主动请求、用途、短信费用、退订与帮助说明。', path: '/sms-consent' }, <SmsConsentView />);
await renderPage({ title: '页面不存在｜BAYLINK', description: '没有找到这个页面。请检查链接，或返回 BAYLINK 首页。', path: '/404', noindex: true }, <NotFoundPage />, '404.html');

const sitemapPaths = ['/', '/guides', '/recommend', ...Object.keys(SLUG_TO_CATEGORY).map((slug) => `/category/${slug}`), ...guides.map((guide) => `/guides/${guide.slug}`), '/terms', '/privacy', '/sms-consent'];
const guideDates = new Map(guides.map((guide) => [`/guides/${guide.slug}`, guide.updatedAt]));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map((path) => `  <url><loc>${escapeHtml(SITE_URL + path)}</loc>${guideDates.has(path) ? `<lastmod>${escapeHtml(guideDates.get(path)!)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(outputDir, 'sitemap.xml'), sitemap);
console.log(`Prerendered ${sitemapPaths.length + 1} public HTML pages and sitemap. No authenticated or live user data was fetched.`);
