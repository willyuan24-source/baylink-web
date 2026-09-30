import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * W7-K5 (lane W's wave-6 review: the activity chip's 放弃 / Give up measured 74 × 36 CSS px on a phone): on a coarse
 * pointer the chip's buttons are at least 44 × 44 (WCAG 2.5.5 / Apple's 44 pt). The rule comes after the chip's own
 * 36 px and the quiet button's 34 px with the same specificity, so it wins the cascade; measured live in
 * docs/opus-bay/sf-w7-K.md part b.
 */

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../src/opus-bay/play/play.css'), 'utf8');
const chip = fs.readFileSync(path.resolve(import.meta.dirname, '../src/opus-bay/play/PlayChip.tsx'), 'utf8');

test('W7-K5: a coarse pointer gets 44 px chip buttons, after (and as specific as) the rules that made them 34–36 px', () => {
  const m = /@media \(pointer: coarse\) \{\s*\.ob-play-chip \.ob-play-btn \{([^}]*)\}/.exec(css);
  assert.ok(m, 'the coarse-pointer rule');
  assert.match(m![1], /min-height:\s*44px/);
  assert.match(m![1], /min-width:\s*44px/);
  const at = m!.index;
  for (const rule of ['.ob-play-btn.is-quiet {', '.ob-play-flight .ob-play-btn {']) {
    const i = css.indexOf(rule);
    assert.ok(i >= 0 && i < at, `${rule} comes first`);
  }
  // no later rule makes the chip's buttons smaller again
  assert.doesNotMatch(css.slice(at + m![0].length), /\.ob-play-(chip|flight) \.ob-play-btn[^{]*\{[^}]*min-height/);
  // the chip's 放弃 and hold buttons are .ob-play-btn inside .ob-play-chip
  assert.match(chip, /ob-play-flight ob-play-chip/);
  assert.match(chip, /className="ob-play-btn is-quiet"/);
  assert.match(chip, /className="ob-play-btn is-go ob-play-hold"/);
});
