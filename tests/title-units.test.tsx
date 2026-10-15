import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SegmentedTitle } from '../src/components/SegmentedTitle';

const OPENS = /[（「『【〈《“‘(]$/u;
const CLOSES = /^[，。、；：！？）」』】〉》”’,.;:!?)]/u;

// GR-13 made a card title's Chinese unit an inline block, and a line may always break before an inline block, so text
// like 港片《 + [喋血双雄》] left 《 at the end of a line. Opening punctuation now travels inside the unit after it.
test('no title unit leaves an opening bracket or quote at the end of the text before it, nor a closing one after it', () => {
  for (const text of ['港片《喋血双雄》粤语场', '香港动作经典《喋血双雄》：粤语原声', '社区“开放日”导览与（免费）讲座', '《喋血双雄》粤语场']) {
    const html = renderToStaticMarkup(<h3><SegmentedTitle text={text} /></h3>);
    const doc = JSDOM.fragment(html);
    assert.equal(doc.textContent, text, 'the text is unchanged');
    const units = [...doc.querySelectorAll('.title-keep')];
    assert.ok(units.length > 0, html);
    for (const unit of units) {
      const before = unit.previousSibling?.nodeType === 3 ? unit.previousSibling.textContent ?? '' : '';
      const after = unit.nextSibling?.nodeType === 3 ? unit.nextSibling.textContent ?? '' : '';
      assert.doesNotMatch(before, OPENS, html);
      assert.doesNotMatch(after, CLOSES, html);
    }
  }
  const film = JSDOM.fragment(renderToStaticMarkup(<h3><SegmentedTitle text="港片《喋血双雄》粤语场" /></h3>));
  assert.ok([...film.querySelectorAll('.title-keep')].some(unit => unit.textContent!.startsWith('《')), film.firstElementChild!.innerHTML);
});
