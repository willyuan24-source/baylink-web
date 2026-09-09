import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import { guides, getGuidesForCategorySlug } from '../src/data/guides';
import { GuideDetail } from '../src/components/GuideDetail';
import { GuidesHome } from '../src/components/GuidesHome';
import { SLUG_TO_CATEGORY } from '../src/routing';
import { DEFAULT_SOCIAL_IMAGE, renderHtmlDocument, setPageMetadata } from '../src/lib/seo';
import { getGuideMetadata } from '../src/lib/guide-metadata';

const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const noop = () => {};

test('server metadata replaces the entire previous page and escapes untrusted text', () => {
  const html = renderHtmlDocument(template, { title: '房源 <script>alert(1)</script>', description: '" onclick="bad', path: '/posts/example?token=private', image: 'javascript:alert(1)', type: 'article', noindex: true }, '<article>公开正文</article>');
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('title').length, 1);
  assert.equal(dom.window.document.title, '房源 <script>alert(1)</script>');
  assert.equal(dom.window.document.querySelector('meta[name="description"]')?.getAttribute('content'), '" onclick="bad');
  assert.equal(dom.window.document.querySelector('meta[property="og:image"]')?.getAttribute('content'), DEFAULT_SOCIAL_IMAGE);
  assert.equal(dom.window.document.querySelector('link[rel="canonical"]')?.getAttribute('href'), 'https://www.baylink.us/posts/example');
  assert.equal(dom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex, follow');
  assert.equal(dom.window.document.querySelectorAll('script:not([src])').length, 0);
  assert.match(html, /<article>公开正文<\/article>/);
  assert.match(html, /src="\/src\/main.tsx"/);
});

test('client navigation resets stale article image and noindex metadata', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const dom = new JSDOM(template);
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  try {
    setPageMetadata({ title: '不存在', description: '旧说明', path: '/missing', image: 'https://example.com/old.jpg', noindex: true, type: 'article' });
    setPageMetadata({ title: 'BAYLINK 首页', description: '首页说明', path: '/' });
    assert.equal(dom.window.document.title, 'BAYLINK 首页');
    assert.equal(dom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index, follow');
    assert.equal(dom.window.document.querySelector('meta[property="og:type"]')?.getAttribute('content'), 'website');
    assert.equal(dom.window.document.querySelector('meta[property="og:image"]')?.getAttribute('content'), DEFAULT_SOCIAL_IMAGE);
    assert.equal(dom.window.document.querySelectorAll('link[rel="canonical"]').length, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('guide structured data uses real modification dates, escapes script delimiters and clears on navigation', () => {
  const guide = { ...guides[0], title: '指南 </script><script>alert(1)</script>' };
  const metadata = getGuideMetadata(guide);
  const html = renderHtmlDocument(template, metadata, '<article>指南正文</article>');
  const dom = new JSDOM(html);
  const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');
  assert.equal(scripts.length, 1);
  const [article, breadcrumbs] = JSON.parse(scripts[0].textContent || '[]');
  assert.equal(article.headline, guide.title);
  assert.equal(article.dateModified, guide.updatedAt);
  assert.equal(article.author, undefined, 'do not invent a personal author');
  assert.equal(article.datePublished, undefined, 'modification time is not a known publication date');
  assert.equal(breadcrumbs.itemListElement.at(-1).item, `https://www.baylink.us/guides/${guide.slug}`);
  assert.equal(dom.window.document.querySelectorAll('script:not([src]):not([type="application/ld+json"])').length, 0);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  try {
    setPageMetadata(getGuideMetadata(guides[1]));
    assert.equal(dom.window.document.querySelectorAll('script[data-baylink-structured-data]').length, 1);
    setPageMetadata({ title: '生活指南', description: '指南索引', path: '/guides' });
    assert.equal(dom.window.document.querySelectorAll('script[data-baylink-structured-data]').length, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('every guide renders its real article and official sources without browser globals', () => {
  for (const guide of guides) {
    const html = renderToStaticMarkup(createElement(StaticRouter, { location: `/guides/${guide.slug}` }, createElement(GuideDetail, { slug: guide.slug, onBack: noop, onOpenGuide: noop, onNavigate: noop, onOpenPost: noop })));
    const dom = new JSDOM(html);
    assert.equal(dom.window.document.querySelector('h1')?.textContent, guide.title);
    assert.ok(dom.window.document.querySelector('article')!.textContent!.length > 500);
    assert.ok(guide.sources.length > 0);
    for (const source of guide.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert.ok([...dom.window.document.querySelectorAll('a')].some((link) => link.getAttribute('href') === source.url));
    }
    for (const block of guide.blocks.filter((block) => block.type === 'cta')) {
      if (block.primaryAction === 'category') assert.ok(SLUG_TO_CATEGORY[block.categorySlug!], guide.slug);
      if (block.primaryAction === 'post') {
        const targets = block.postChoices?.map((choice) => choice.categorySlug) || [block.postCategorySlug];
        for (const target of targets) assert.ok(target && SLUG_TO_CATEGORY[target], guide.slug);
      }
    }
  }
});

test('guide index exposes crawlable links and service recommendations match the task', () => {
  const html = renderToStaticMarkup(createElement(StaticRouter, { location: '/guides' }, createElement(GuidesHome, { onOpenGuide: noop })));
  const dom = new JSDOM(html);
  const targets = new Set([...dom.window.document.querySelectorAll('a')].map((link) => link.getAttribute('href')));
  for (const guide of guides) assert.ok(targets.has(`/guides/${guide.slug}`));
  assert.equal(getGuidesForCategorySlug('moving')[0].slug, 'bay-area-moving-checklist');
  assert.equal(getGuidesForCategorySlug('service')[0].slug, 'local-service-safety-guide');
  assert.ok(getGuidesForCategorySlug('part-time').every((guide) => guide.category === 'safety'));
});

test('hosting config has explicit public routes, a real missing-page status and compatible CSP', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.functions['api/post-page.ts'].includeFiles, 'dist/index.html');
  assert.equal(config.rewrites, undefined);
  assert.equal(config.headers, undefined);
  const routeFor = (path: string) => config.routes.find((route: { src?: string; dest?: string }) => route.dest && route.src && new RegExp(route.src).test(path));
  for (const guide of guides) assert.equal(routeFor(`/guides/${guide.slug}`).dest, '/guides/$1.html');
  for (const slug of Object.keys(SLUG_TO_CATEGORY)) assert.equal(routeFor(`/category/${slug}`).dest, '/category/$1.html');
  assert.equal(routeFor('/guides/not-a-real-guide').status, 404);
  assert.equal(routeFor('/category/not-a-real-category').status, 404);
  assert.equal(routeFor('/does-not-exist').status, 404);
  assert.equal(routeFor('/tools').dest, '/$1.html');
  assert.equal(routeFor('/explore').dest, '/$1.html');
  assert.equal(routeFor('/explore/').dest, '/$1.html');
  assert.equal(routeFor('/this-month').dest, '/$1.html');
  assert.equal(routeFor('/this-month/').dest, '/$1.html');
  assert.match(routeFor('/posts/example-post').dest, /^\/api\/post-page\?/);
  assert.ok(config.routes.some((route: { handle?: string }) => route.handle === 'filesystem'));
  const csp = config.routes[0].headers['Content-Security-Policy'];
  for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'wss://baylink-api.onrender.com', 'blob:']) assert.ok(csp.includes(directive));
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  for (const guide of guides) assert.ok(sitemap.includes(`/guides/${guide.slug}</loc><lastmod>${guide.updatedAt}</lastmod>`));
});
