import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import { EditorialCollections } from '../src/components/EditorialCollections';
import { getGuideBySlug } from '../src/data/guides';
import { editorialCollections } from '../src/data/editorial-collections';

const renderCollections = (compact = false) => JSDOM.fragment(renderToStaticMarkup(
  createElement(StaticRouter, { location: '/' }, createElement(EditorialCollections, { compact })),
));

const assertPublishedLinks = (root: DocumentFragment) => {
  const links = [...root.querySelectorAll('a')];
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    const slug = href.match(/^\/guides\/([^/?#]+)$/)?.[1];
    assert.ok(slug, `editorial link must point directly to a guide: ${href}`);
    assert.ok(getGuideBySlug(slug), `editorial guide must exist before publication: ${slug}`);
    assert.ok(link.textContent?.trim(), `editorial link needs a readable label: ${href}`);
  }
  return links;
};

test('full editorial collections expose each published topic link, including the two settling-in guides', () => {
  const root = renderCollections();
  const topics = [...root.querySelectorAll('article')];
  assert.equal(topics.length, 3);
  topics.forEach((topic, index) => assert.equal(topic.querySelectorAll('a').length, editorialCollections[index].guides.length));
  const links = assertPublishedLinks(root);
  assert.equal(links.length, 11);
  assert.equal(new Set(links.map((link) => link.getAttribute('href'))).size, 11);
  assert.ok(links.some((link) => link.getAttribute('href')?.endsWith('/bay-area-utilities-address-change-guide')));
  assert.ok(links.some((link) => link.getAttribute('href')?.endsWith('/california-driver-license-id-preparation-guide')));
});

test('compact editorial collections render only the first published link from each topic', () => {
  const root = renderCollections(true);
  const topics = [...root.querySelectorAll('article')];
  const fullTopics = [...renderCollections().querySelectorAll('article')];
  assert.equal(topics.length, 3);
  topics.forEach((topic, index) => {
    assert.equal(topic.querySelectorAll('a').length, 1, topic.querySelector('h3')?.textContent || 'topic');
    assert.equal(topic.querySelector('a')?.getAttribute('href'), fullTopics[index].querySelector('a')?.getAttribute('href'));
  });
  assert.equal(assertPublishedLinks(root).length, 3);
});
