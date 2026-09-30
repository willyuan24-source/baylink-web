import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { JSDOM } from 'jsdom';
import { GuideDetail } from '../src/components/GuideDetail';
import { getGuideBySlug } from '../src/data/guides';

const renderGuide = (slug: string) => {
  const html = renderToStaticMarkup(
    <StaticRouter location={`/guides/${slug}`}>
      <GuideDetail slug={slug} today="2026-09-29" onBack={() => {}} onOpenGuide={() => {}} onNavigate={() => {}} onOpenPost={() => {}} />
    </StaticRouter>,
  );
  return new JSDOM(html).window.document;
};

test('October guide renders four working entry links once before the offer board and preserves section anchors', () => {
  const slug = 'bay-area-freebies-deals-2026-10';
  const guide = getGuideBySlug(slug)!;
  const document = renderGuide(slug);
  const board = document.querySelector('#freebie-board-0');
  assert.ok(board);
  const preface = guide.blocks.slice(0, guide.blocks.findIndex(block => block.type === 'freebies'));
  const links = preface.filter(block => block.type === 'link');
  assert.equal(links.length, 4);
  for (const link of links) {
    const matches = [...document.querySelectorAll('a')].filter(element => element.textContent === link.title);
    assert.equal(matches.length, 1, `${link.title} must be a single working link`);
    assert.equal(matches[0].getAttribute('href'), link.url);
    assert.ok(matches[0].closest('.bl-guide-prose'));
    assert.ok(matches[0].compareDocumentPosition(board) & 4, `${link.title} must precede the offer board`);
    assert.equal(document.querySelector('.bl-guide-reading-main')?.contains(matches[0]), false);
  }
  for (const [index, block] of guide.blocks.entries()) {
    if (block.type !== 'heading') continue;
    const matches = document.querySelectorAll(`#guide-section-${index}`);
    assert.equal(matches.length, 1, `Original heading index ${index} must remain unique`);
    assert.equal(matches[0].textContent, block.text);
    assert.ok(document.querySelector(`.bl-guide-toc a[href="#guide-section-${index}"]`));
  }
  assert.ok(document.querySelector('#guide-section-0')!.compareDocumentPosition(board) & 4);
});

test('ordinary guides and guides starting with a board retain one unchanged body with no duplicated sections', () => {
  for (const slug of ['bay-area-airport-arrival-guide', 'bay-area-freebies-deals-2026-09']) {
    const guide = getGuideBySlug(slug)!;
    const document = renderGuide(slug);
    assert.equal(document.querySelectorAll('.bl-guide-prose').length, 1, slug);
    const prose = document.querySelector('.bl-guide-reading-main > .bl-guide-prose');
    assert.ok(prose);
    for (const [index, block] of guide.blocks.entries()) {
      if (block.type === 'heading') {
        const headings = document.querySelectorAll(`#guide-section-${index}`);
        assert.equal(headings.length, 1, `${slug}: section ${index}`);
        assert.ok(prose.contains(headings[0]));
        assert.equal(headings[0].textContent, block.text);
      }
      if (block.type === 'paragraph') {
        assert.equal([...prose.querySelectorAll('p')].filter(element => element.textContent === block.text).length, 1);
      }
    }
    const board = document.querySelector('#freebie-board-0');
    if (guide.blocks[0].type === 'freebies') {
      assert.ok(board);
      assert.ok(board.compareDocumentPosition(prose) & 4);
    } else assert.equal(board, null);
  }
});

test('protocol-relative and backslash paths never become navigable guide entry links', () => {
  const slug = 'bay-area-airport-arrival-guide';
  const guide = getGuideBySlug(slug)!;
  const originalBlocks = guide.blocks;
  const unsafePaths = ['//example.test', String.raw`/\example.test`, String.raw`/events\example.test`, String.raw`/events/\example.test`];
  try {
    guide.blocks = unsafePaths.map((url, index) => ({ type: 'link', title: `Unsafe path ${index}`, text: 'Keep the description without a navigation target.', url }));
    const document = renderGuide(slug);
    for (const [index] of unsafePaths.entries()) {
      const title = `Unsafe path ${index}`;
      assert.equal([...document.querySelectorAll('a')].filter(link => link.textContent === title).length, 0);
      assert.equal([...document.querySelectorAll('.bl-guide-source-link > strong')].filter(label => label.textContent === title).length, 1);
    }
  } finally {
    guide.blocks = originalBlocks;
  }
});
