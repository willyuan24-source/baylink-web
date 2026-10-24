import type { ReactNode } from 'react';
import type { Locale } from '../../i18n/locale';
import { ReaderText } from './ReaderText';
import { readerProse } from './reader-text';

/** A link in a fact's label line (FactsGrid, ShopFacts). */
export type FactsLink = { href: string; label: string };

/** Catalog text as a cell value or note, or undefined when no reader text is left (readerProse). */
export function readerNode(text: string | undefined, locale: Locale): ReactNode {
  return readerProse(text, locale) ? <ReaderText text={text} /> : undefined;
}

/** The label line's right slot: a quiet external link (地图, 官方页, 商家官网, 查询本地门店). */
export const outLink = (link: FactsLink, map?: boolean) => <a className={map ? 'ui-more detail-fact__aside detail-map-link' : 'ui-more detail-fact__aside'} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>;

export const mapLink = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
