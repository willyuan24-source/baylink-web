import { createElement, Fragment, type ReactNode } from 'react';
import { translateText, useLocale } from '../i18n/locale';
import { titleBreakPieces } from '../lib/title-breaks';

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
  pieces.forEach((piece, index) => {
    if (piece.keep && pieces[index - 1]?.keep) children.push(createElement('wbr', { key: `${index}-wbr` }));
    children.push(piece.keep ? createElement('span', { key: index, className: 'title-keep' }, piece.text) : piece.text);
  });
  return createElement(Fragment, null, children);
}
