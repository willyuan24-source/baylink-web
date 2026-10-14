import { createElement, Fragment, type ReactNode } from 'react';
import { translateText, useLocale } from '../i18n/locale';
import { titleBreakPieces } from '../lib/title-breaks';

/** CJK closing punctuation (and the full-width colon) that must not begin a line. */
const CLOSING = /^[，。、；：！？）」』】〉》”’,.;:!?)]+/u;
/** CJK opening brackets and quotes that must not end a line. */
const OPENING = /[（「『【〈《“‘(]+$/u;
/** A Latin name group of two or more words (Día de los Muertos): narrow card titles may break it at its spaces (H55). */
const LATIN_GROUP = /^(?=[^\p{Script=Han}]*$)(?=.*\p{Script=Latin}).*\S\s+\S/u;

/**
 * A detail-page title that wraps between words, not inside them (REPORT-1007 §4.1 item 9). The text is translated
 * once, whole, and then grouped. The word spans come from React's createElement, outside the localizing JSX runtime,
 * so LocalizedHost never converts a piece on its own: piecewise opencc can differ from the whole title (了解 → 瞭解).
 */
export function SegmentedTitle({ text }: { text: string }) {
  const locale = useLocale();
  const shown = translateText(text, locale);
  const pieces = titleBreakPieces(shown, locale);
  if (!pieces) return shown;
  const children: ReactNode[] = [];
  // Closing punctuation right after a unit travels inside it, so a line never starts with ，or ： (a break at the end of
  // a nowrap unit is allowed even where the text would forbid one). Opening punctuation right before a unit travels inside
  // it too, so a line never ends on 《 or （: in card titles a unit is an inline block, and a line may always break before one.
  let carried = '', leading = '', afterUnit = false;
  pieces.forEach((piece, index) => {
    const next = pieces[index + 1];
    if (piece.keep) {
      // Two units side by side (or with only carried punctuation between them) may break between them.
      if (afterUnit) children.push(createElement('wbr', { key: `${index}-wbr` }));
      carried = next && !next.keep ? CLOSING.exec(next.text)?.[0] ?? '' : '';
      children.push(createElement('span', { key: index, className: 'title-keep', 'data-latin': LATIN_GROUP.test(piece.text) ? '' : undefined }, leading + piece.text + carried));
      leading = '';
      afterUnit = true;
      return;
    }
    let text = piece.text.slice(carried.length);
    carried = '';
    leading = next?.keep ? OPENING.exec(text)?.[0] ?? '' : '';
    if (leading) text = text.slice(0, -leading.length);
    if (text) { children.push(text); afterUnit = false; }
  });
  return createElement(Fragment, null, children);
}
