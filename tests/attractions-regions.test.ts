import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { regionalAttractionGuides } from '../src/data/guides-attractions-regions';
import media from '../src/data/attractions-regions-media.json';

test('regional attraction guides retain official evidence and actionable arrival/return planning', () => {
  assert.equal(regionalAttractionGuides.length, 8);
  assert.equal(new Set(regionalAttractionGuides.map(guide => guide.slug)).size, 8);
  for (const region of ['东湾', '半岛', '南湾', '北湾']) {
    assert.equal(regionalAttractionGuides.filter(guide => guide.tags.includes(region)).length, 2, region);
  }
  const officialHosts = /(^|\.)(berkeley\.edu|museumca\.org|oaklandca\.gov|stanford\.edu|filoli\.org|thetech\.org|japantownsanjose\.org|hakone\.com|nps\.gov|gomuirwoods\.com|goldengate\.org|sausalito\.gov)$/;
  for (const guide of regionalAttractionGuides) {
    assert.equal(guide.updatedAt, '2026-09-09');
    assert.ok(guide.sources.length >= 3, guide.slug);
    guide.sources.forEach(source => assert.match(new URL(source.url).hostname, officialHosts, source.url));
    assert.equal(guide.blocks.filter(block => block.type === 'heading').length, 3, `${guide.slug}: headings supply the article contents and inline-photo insertion points`);
    const routes = guide.blocks.filter(block => block.type === 'route');
    assert.equal(routes.length, 1, guide.slug);
    assert.equal(routes[0].stops.length, 3, guide.slug);
    routes[0].stops.forEach(stop => {
      assert.ok(stop.text.length > 35, guide.slug);
      const map = new URL(stop.mapUrl!);
      assert.equal(map.hostname, 'www.google.com');
      assert.equal(map.searchParams.get('api'), '1');
      assert.ok(map.searchParams.get('query'));
    });
    assert.ok(guide.blocks.some(block => block.type === 'checklist' && block.items.length >= 3));
    const last = guide.blocks.at(-1);
    assert.equal(last?.type, 'cta');
  }
});

test('region photographs have distinct bytes, accurate WebP dimensions and usable licenses', () => {
  assert.equal(media.length, 16);
  const hashes = new Set<string>();
  for (const photo of media) {
    assert.equal(photo.kind, 'photo');
    assert.match(photo.creditUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(photo.licenseUrl, /^https:\/\/creativecommons\.org\/(licenses|publicdomain)\//);
    assert.ok(photo.credit && photo.alt && photo.caption && photo.provenance.author);
    assert.match(photo.caption, /20\d\d 年/);
    const candidates = photo.srcSet.split(',').map(candidate => candidate.trim().split(' '));
    assert.equal(candidates.length, 2);
    for (const [src, width] of candidates) {
      assert.match(src, /^\/guides\/attractions\/region-[a-z-]+(?:-small)?\.webp$/);
      const data = readFileSync(new URL(`../public${src}`, import.meta.url));
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.toString('ascii', 8, 12), 'WEBP');
      assert.equal(data.readUInt32LE(4) + 8, data.length);
      const kind = data.toString('ascii', 12, 16);
      const dims = kind === 'VP8X'
        ? { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 }
        : { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
      assert.equal(dims.width, Number.parseInt(width));
      if (src === photo.src) {
        assert.deepEqual(dims, { width: photo.width, height: photo.height });
        hashes.add(createHash('sha256').update(data).digest('hex'));
      } else {
        assert.equal(dims.width, 480);
      }
    }
  }
  assert.equal(hashes.size, 16, 'each photograph must contain different visual content');
});

test('paid attraction guidance does not flatten separate reservations or eligibility', () => {
  const text = (slug: string) => JSON.stringify(regionalAttractionGuides.find(guide => guide.slug === slug)?.blocks);
  assert.match(text('muir-woods-reservation-day-trip'), /15 岁及以下免费/);
  assert.match(text('muir-woods-reservation-day-trip'), /门票或公园通票不代替停车/);
  assert.match(text('hakone-gardens-saratoga-half-day'), /只限 Saratoga/);
  assert.match(text('hakone-gardens-saratoga-half-day'), /不是整个 Santa Clara County/);
  assert.match(text('berkeley-campus-botanical-garden-half-day'), /周二关闭/);
  assert.match(text('sausalito-waterfront-ferry-half-day'), /单程成人/);
});
