/**
 * Structured reading aids for the pilot guides (T7 "看 → 查 → 读", design.md §4.10, 1007 §5.5). Every fact here is already
 * in the published article (title, text, sources or source note): no new numbers, dates or prices (tests/guide-editorial.test.ts
 * checks every digit run against the article). Copy is written in both languages; zh-Hant is the runtime conversion of zh.
 * CNT-GUIDES may add new official facts later, each with a source read and owner approval.
 */
export type EditorialCopy = { zh: string; en: string };

/** A phone number shown as a tap-to-call button: the number as written in the article and its E.164 form. */
export type EditorialPhone = { label: EditorialCopy; number: string; tel: string };

/** One "30 秒看懂" row: a short label over the decisive value. `source` is the 1-based index into the guide's sources. */
export type GuideKeyFact = { label: EditorialCopy; value: EditorialCopy; source?: number };

/** A contact card: agency, number, languages, address and one line of what to ask for. */
export type GuideContact = {
  name: EditorialCopy;
  number: string;
  tel: string;
  languages?: EditorialCopy[];
  /** One street address, or a list when the agency names several places (each gets its own map link). */
  address?: string | readonly string[];
  note?: EditorialCopy;
  source?: number;
};

/** One carousel slide (3:4). The first slide of every carousel is the cover built from `cover`. */
export type GuideSlide = {
  kind: 'point' | 'compare' | 'checklist' | 'contacts' | 'safety';
  kicker: EditorialCopy;
  title: EditorialCopy;
  body?: EditorialCopy;
  items?: EditorialCopy[];
  phones?: EditorialPhone[];
  source?: number;
};

export type GuideEditorial = {
  slug: string;
  /** The cover slide: a reader's question, the headline, the answer bar and one supporting line. */
  cover: { question: EditorialCopy; title: EditorialCopy; answer: EditorialCopy; line?: EditorialCopy; phone?: EditorialPhone };
  keyFacts: GuideKeyFact[];
  contacts?: GuideContact[];
  slides: GuideSlide[];
  /** Step conclusions by heading order (0 = the article's first H2): one sentence of what to do, ≤2 lines. */
  steps?: readonly (EditorialCopy | undefined)[];
};
