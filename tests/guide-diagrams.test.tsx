import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

// H22 (SV13-03, GR-10): the eight pilot guides (senior services + the seven paperwork pillars) carry coded diagrams labelled
// 示意图 that restate the article, and the image-rhythm probe keeps the longest image-free stretch of the article body (H1 to
// the official sources) at most 2.5 phone screens (390 × 844, standard text; the model in tests/support/guide-rhythm.ts,
// calibrated against Chrome: lanes/WEB-GUIDES-READ/rhythm-calibration.json).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderToStaticMarkup } = await import('react-dom/server');
const { StaticRouter } = await import('react-router');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { getGuideBySlug } = await import('../src/data/guides');
const { GUIDE_DIAGRAMS } = await import('../src/features/guides/guide-diagrams');
const { peekGuide } = await import('../src/features/guides/guide-store');
const { guideBodyStretches } = await import('./support/guide-rhythm');
const { setLocale } = await import('../src/i18n/locale');

const PILOTS = ['bay-area-chinese-senior-services-referral-guide', 'bay-area-medicare-hicap-medi-cal-guide', 'bay-area-dental-care-insurance-low-cost-guide',
  'bay-area-social-security-retirement-preparation-guide', 'bay-area-naturalization-official-path-guide', 'bay-area-free-tax-help-vita-calfile-guide',
  'california-tenant-deposit-rights-help-guide', 'california-driver-license-id-preparation-guide'];
const noop = () => {};
const render = (slug: string, prefix = '', record = peekGuide(slug)) => {
  const html = renderToStaticMarkup(<StaticRouter location={`${prefix}/guides/${slug}`}><GuideDetail slug={slug} record={record} today="2026-10-13" onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></StaticRouter>);
  return new JSDOM(html).window.document.querySelector('article')!;
};
const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings)
  : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

test('every figure, phone number, amount and date in a diagram is printed in that guide', () => {
  for (const [slug, placed] of Object.entries(GUIDE_DIAGRAMS)) {
    const guide = getGuideBySlug(slug)!;
    assert.ok(guide, slug);
    const article = JSON.stringify(guide).replace(/\s+/g, '');
    for (const { diagram } of placed) {
      const zh = strings(diagram).filter(text => /[㐀-鿿]/u.test(text) || /^\d[\d-]+$/.test(text));
      for (const text of zh) for (const figure of text.match(/\$?\d[\d,.]*(?:-\d+)*/gu) ?? []) {
        // "7 个月里的第 4 个月" counts the window the article describes (3 + birthday month + 3); 2/3 are numbered steps.
        if (/^[1-7]$/.test(figure)) continue;
        assert.ok(article.includes(figure), `${slug}: ${figure} (in "${text}") is in the article`);
      }
      if (diagram.source !== undefined) assert.ok(guide.sources[diagram.source - 1], `${slug}: source ${diagram.source}`);
      for (const item of [...('steps' in diagram ? diagram.steps : []), ...('columns' in diagram ? diagram.columns : []), ...('marks' in diagram ? diagram.marks : []), ...('tiles' in diagram ? diagram.tiles : [])]) {
        if (item.tel) assert.equal(item.tel.replace(/\D/g, '').slice(-10), item.number!.replace(/\D/g, '').slice(-10), `${slug}: ${item.number}`);
      }
    }
  }
});

test('each pilot guide shows its diagrams under a 图解 / 对照表 eyebrow (Diagram / Comparison on /en), never 示意图, a photo or AI picture', async () => {
  await setLocale('zh-Hans', false);
  for (const slug of PILOTS) {
    const figures = [...render(slug).querySelectorAll('figure.gd-diagram')];
    assert.ok(figures.length >= 2, `${slug}: ${figures.length} diagrams`);
    for (const figure of figures) {
      assert.equal(figure.getAttribute('data-cover'), 'diagram');
      // A P16 (UI9-R2-GUIDE): the tier word 示意图 belongs to pictures; a coded box says what kind of box it is.
      assert.equal(figure.querySelector('.gd-diagram__tag')!.textContent, figure.getAttribute('data-diagram') === 'compare' ? '对照表' : '图解');
      assert.equal(figure.querySelector('img'), null, 'coded, not a picture');
    }
  }
  await setLocale('en', false, `/guides/${PILOTS[0]}`);
  const english = render(PILOTS[0], '/en');
  for (const figure of english.querySelectorAll('figure.gd-diagram')) {
    assert.equal(figure.querySelector('.gd-diagram__tag')!.textContent, figure.getAttribute('data-diagram') === 'compare' ? 'Comparison' : 'Diagram');
    assert.doesNotMatch(figure.textContent!, /[㐀-鿿]/u, 'the /en diagram has no Chinese');
  }
  await setLocale('zh-Hans', false);
});

test('CI image-rhythm probe: no image-free stretch over 2.5 phone screens in the eight pilots (and the probe catches one)', async () => {
  await setLocale('zh-Hans', false);
  const rows: string[] = [];
  for (const slug of PILOTS) {
    const { longest, stretches } = guideBodyStretches(render(slug));
    rows.push(`${slug} ${longest} [${stretches.map(stretch => stretch.screens).join(', ')}]`);
    assert.ok(longest <= 2.5, `${slug}: ${longest} screens without a picture`);
  }
  console.log(rows.join('\n'));
  // Without its diagrams (and, since CNT-MEDIA-4, its step photo) the senior guide runs about five screens of contact cards and
  // steps with no picture.
  const record = peekGuide(PILOTS[0])!;
  const bare = guideBodyStretches(render(PILOTS[0], '', { ...record, diagrams: undefined, inline: [] }));
  assert.ok(bare.longest > 2.5, `the probe flags the bare article (${bare.longest})`);
});
