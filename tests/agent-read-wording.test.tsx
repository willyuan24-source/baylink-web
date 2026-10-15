import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { api } from '../src/lib/api';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act } = await import('@testing-library/react');
const { resetSourceFreshnessCache } = await import('../src/features/source-monitor/content-review-runtime');
const { TrustRow } = await import('../src/features/source-monitor/TrustRow');
const { AboutContent } = await import('../src/components/AboutContent');
await import('../src/i18n/router');
const { setLocale } = await import('../src/i18n/locale');
const { languagePath, languagePrefix } = await import('../src/lib/language-path');
const request = api.request;
afterEach(async () => { cleanup(); api.request = request; resetSourceFreshnessCache(); await setLocale('zh-Hans', false); });

/**
 * HANDOFF §3.9 (the Wave 5 shared rule): a `verifiedAt` set from an agent's read means "the official page was read that
 * day". The audit counts only editor checks as 人工复核, so page copy never calls that date 编辑核对 / 人工核对 or
 * "Editor checked" (WEB-HOLDOUT, W5-INT and CNT-SUPPLY-2 found the trust row and About saying so; WEB-FIX6).
 */
const DATE_LABEL = /编辑核对|編輯核對|editor[- ]checked|checked by (?:an )?editor/iu;
const HUMAN_CHECK = /人工核[对對]|人工复核|人工複核|human review|a person check|an editor (?:checks|checked|opened)/iu;
/** Saying what the check is not ("不是逐条人工复核", "not a line-by-line human review") is honest, so negated mentions are dropped first. */
const NEGATED = /(?:不是|不等于|不等於|并非|並非|不算|not (?:an? )?)(?:逐条|逐條|line-by-line )?(?:人工核[对對]|人工复核|人工複核|human review)/giu;
const claimsHumanCheck = (text: string) => HUMAN_CHECK.test(text.replace(NEGATED, ''));
/** A line that speaks about a date: a verifiedAt field, an M/D or ISO day, or the words 日期 / date. */
const ABOUT_A_DATE = /verifiedAt|\b\d{1,2}\/\d{1,2}\b|\d{4}-\d{2}-\d{2}|日期|\bdates?\b/iu;
const HONEST = (text: string, where: string) => {
  assert.doesNotMatch(text, DATE_LABEL, `${where}: a check date is 官网核对 / "Source checked", never an editor's`);
  assert.ok(!claimsHumanCheck(text), `${where}: an agent's read is never called a human check`);
};

const root = fileURLToPath(new URL('..', import.meta.url));
const SKIP = /^src[\\/](?:opus-bay|data[\\/]generated)(?:[\\/]|$)/u;
const sources = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  if (SKIP.test(path)) return [];
  return entry.isDirectory() ? sources(path) : /\.(?:ts|tsx|mts|mjs)$/u.test(entry.name) ? [path] : [];
});
/** Code lines only: comments may name the banned words to explain the rule. */
const codeLines = (text: string) => text.split(/\r?\n/u).map((line, index) => ({ line, at: index + 1 })).filter(({ line }) => !/^\s*(?:\/\/|\/\*|\*)/u.test(line));

test('no page copy in src, api or scripts labels a check date as an editor\'s or calls it a human check', () => {
  const found: string[] = [];
  for (const file of ['src', 'api', 'scripts'].flatMap(sources)) {
    for (const { line, at } of codeLines(readFileSync(join(root, file), 'utf8'))) {
      if (DATE_LABEL.test(line) || (claimsHumanCheck(line) && ABOUT_A_DATE.test(line))) found.push(`${relative(root, join(root, file))}:${at}: ${line.trim().slice(0, 120)}`);
    }
  }
  assert.deepEqual(found, [], 'word it as the official page having been read/checked that day (官网核对 9/29 · Source checked Sep 29)');
});

test('the scan would catch the old wording (the rule is not vacuous)', () => {
  const old = "{t('编辑核对', 'Editor checked')} <time dateTime={verifiedAt}>";
  assert.match(old, DATE_LABEL);
  const about = "text: t('「编辑核对 9/29」表示编辑那天打开官方页面。这个日期只在人工核对后更新。', 'Only a person checking it again changes that date.')";
  assert.ok(claimsHumanCheck(about.replace('编辑核对', '')) && ABOUT_A_DATE.test(about));
  assert.ok(!claimsHumanCheck('读取和核对借助 AI 工具完成，不是逐条人工复核。这个日期才会更新。'), 'a negation is allowed');
  assert.ok(!claimsHumanCheck('it is not a line-by-line human review. The date changes'), 'a negation is allowed');
});

const official = 'https://organizer.example/event';
const today = '2026-10-08';
const item = { kind: 'event' as const, verifiedAt: '2026-09-29', endDate: '2026-10-31', nextDate: '2026-10-24' };

test('the detail trust row says 官网核对 / 官網核對 / Source checked for verifiedAt in all three languages', async () => {
  api.request = async () => ({ sources: [] });
  const expected = { 'zh-Hans': '官方来源 organizer.example · 官网核对 9/29', 'zh-Hant': '官方來源 organizer.example · 官網核對 9/29', en: 'Official source organizer.example · Source checked Sep 29' } as const;
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    resetSourceFreshnessCache();
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<TrustRow contentId={`wording-${locale}`} item={item} sourceUrl={official} sourceLabel="organizer.example" today={today} />); });
    await act(async () => {});
    const row = view.getByRole('note');
    assert.equal(row.textContent, expected[locale], locale);
    assert.equal(row.querySelector('time')?.getAttribute('datetime'), '2026-09-29');
    HONEST(row.textContent || '', `TrustRow ${locale}`);
    cleanup();
  }
});

test('About explains the check date as a read of the official page, made with AI tools, in all three languages', async () => {
  const expected = {
    'zh-Hans': [/「官网核对 9\/29」表示那天读取了官方页面/u, /借助 AI 工具/u, /不是逐条人工复核/u],
    'zh-Hant': [/「官網核對 9\/29」/u, /AI 工具/u],
    en: [/“Source checked Sep 29” means the official page was read that day/u, /with the help of AI tools/u, /not a line-by-line human review/u],
  } as const;
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false, '/about');
    const html = renderToStaticMarkup(createElement(StaticRouter, { location: languagePath('/about', locale), basename: languagePrefix(locale) || undefined }, createElement(AboutContent)));
    const text = new JSDOM(`<!doctype html><body>${html}</body>`).window.document.body.textContent || '';
    for (const pattern of expected[locale]) assert.match(text, pattern, `${locale}: ${pattern}`);
    assert.doesNotMatch(text, DATE_LABEL, locale);
    // The page may say what the check is not ("不是逐条人工复核"), never that a person made it.
    assert.doesNotMatch(text, /只在人工核对后|人工核对后更新|編輯那天|编辑那天|an editor (?:opened|checks)|Only a person/iu, locale);
  }
});
