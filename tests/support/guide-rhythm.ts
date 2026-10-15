/**
 * H22's CI probe without a browser: a layout model of the pilot guide template on a 390 × 844 phone at the standard text size
 * (guide-article.css, guides-ui.css, ui.css), applied to GuideDetail's rendered DOM. It walks the article body from the H1 to the
 * official sources heading and adds up block heights estimated from the text (Han characters at the font size, Latin and
 * digits narrower) and the template's fixed parts (padding, buttons, gaps); a picture slot (the carousel, a photo, a coded
 * diagram) ends a stretch. Calibrated against Chrome on the eight pilots (lanes/WEB-GUIDES-READ/rhythm-calibration.json):
 * within about 0.25 screens. It is a guard against a long image-free run coming back, not a pixel measure.
 */
export const PHONE = { width: 390, height: 844, gutter: 16 } as const;

const HAN = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/u;
/** Approximate advance of a run of text in px at a font size. */
export function textWidth(text: string, size: number): number {
  let width = 0;
  for (const character of text) {
    width += HAN.test(character) ? size : /\d/.test(character) ? size * 0.56 : /\s/.test(character) ? size * 0.28 : /[A-Z]/.test(character) ? size * 0.64 : size * 0.5;
  }
  return width;
}
export const lineCount = (text: string, size: number, width: number) => {
  const value = text.replace(/\s+/g, ' ').trim();
  return value ? Math.max(1, Math.ceil(textWidth(value, size) / width)) : 0;
};
const textOf = (element: Element | null | undefined) => element?.textContent ?? '';

const CONTENT = PHONE.width - PHONE.gutter * 2;

/** Height of one contact card (GuideFactCards ContactCard). */
function contactHeight(card: Element): number {
  const inner = CONTENT - 2 * 16 - 2;
  let height = 32 + 2;
  height += lineCount(textOf(card.querySelector('h3')), 18, inner - 24) * 26;
  height += 6 + 28;
  if (card.querySelector('.gd-contact__languages')) height += 6 + 32;
  for (const selector of ['.gd-contact__note', '.gd-contact__address']) { const element = card.querySelector(selector); if (element) height += 6 + lineCount(textOf(element), 15, inner) * 24; }
  height += card.querySelectorAll('.gd-contact__places li').length * (44 + 0) + (card.querySelector('.gd-contact__places') ? 6 : 0);
  const actions = card.querySelectorAll('.gd-contact__actions > *').length;
  height += 6 + 6 + (actions > 2 ? 2 : 1) * 48 + (actions > 2 ? 8 : 0);
  return height;
}

/** Height of a diagram, so the content after it lands in the right place (the diagram itself is a picture slot). */
function diagramHeight(figure: Element): number {
  const inner = CONTENT - 2 * 16;
  let height = 32 + 20 + 12 + lineCount(textOf(figure.querySelector('.gd-diagram__head strong')), 18, inner) * 26;
  const kind = figure.getAttribute('data-diagram');
  const items = [...figure.querySelectorAll('li')];
  const item = (li: Element, width: number) => lineCount(textOf(li.querySelector('strong')), 16, width) * 24 + (li.querySelector('.gd-diagram__tel') ? 44 : 0) + lineCount(textOf(li.querySelector('.gd-diagram__text')), 14, width) * 22;
  if (kind === 'flow') height += items.reduce((sum, li) => sum + item(li, inner - 44) + 14, -14);
  else if (kind === 'timeline') height += items.reduce((sum, li) => sum + item(li, inner - 22) + 14, -14);
  else if (kind === 'map') height += 4 * (24 + 44 + 16) + 3 * 6;
  else {
    const columns = figure.querySelector('[data-count="3"]') ? 1 : 2;
    const width = (inner - (columns - 1) * 8) / columns - 24;
    const heights = items.map(li => item(li, width) + 24 + 4 + 4);
    height += columns === 1 ? heights.reduce((sum, value) => sum + value + 8, -8) : Math.max(...heights);
  }
  if (figure.querySelector('.gd-diagram__scale')) height += 46;
  if (figure.querySelector('.gd-diagram__footer')) height += 12 + lineCount(textOf(figure.querySelector('.gd-diagram__footer')), 14, inner) * 22;
  return height + 8 + 18;
}

export type Stretch = { from: number; to: number; screens: number };
/**
 * Stretches without a picture slot in the article body, in px from the article top, on the model above. `slots` are the y
 * ranges of the carousel, photos and diagrams; the run ends at the official sources heading.
 */
export function guideBodyStretches(article: Element): { stretches: Stretch[]; longest: number; slots: [number, number][] } {
  let y = 12 + 44; // padding, crumbs
  const h1 = article.querySelector('h1');
  y += lineCount(textOf(h1?.querySelector('.gd-title__head') ?? h1), 26, CONTENT) * 34 + 6;
  if (h1?.querySelector('.gd-title__rest')) y += lineCount(textOf(h1.querySelector('.gd-title__rest')), 15, CONTENT) * 24;
  y += 8 + lineCount(textOf(article.querySelector('.gd-meta')), 14, CONTENT) * 22 + 12;
  const slots: [number, number][] = [];
  const slot = (height: number) => { slots.push([y, y + height]); y += height; };
  // Lead: the carousel (a slot), the actions, 30 秒看懂.
  if (article.querySelector('.gd-carousel')) slot(Math.round(CONTENT - 20) * 4 / 3 + 12 + 48);
  else if (article.querySelector('.gd-lead__visual img')) slot((CONTENT * 2) / 3);
  y += 16 + 48 + 16;
  const keyfacts = article.querySelector('.gd-keyfacts');
  if (keyfacts) {
    y += 40 + 34;
    for (const row of keyfacts.querySelectorAll('li')) y += 20 + 20 + lineCount(textOf(row.querySelector('.gd-keyfacts__value')), 17, CONTENT - 44) * 27;
  } else y += lineCount(textOf(article.querySelector('.gd-summary p')), 16, CONTENT) * 28;
  for (const child of article.children) {
    if (child.matches('figure.gd-diagram')) { y += 20; slot(diagramHeight(child)); }
    if (child.matches('.gd-contacts')) {
      y += 24 + 32 + 12;
      for (const card of child.querySelectorAll('.gd-contact')) y += contactHeight(card) + 12;
      y -= 12;
    }
    if (child.matches('.gd-opus')) y += 16 + 96;
    if (child.matches('.bl-guide-reading-layout')) {
      y += 28 + 64; // the 文章目录 fold
      const main = child.querySelector('.bl-guide-reading-main');
      for (const block of main ? [...main.children] : []) {
        if (block.matches('.bl-guide-sources')) return finish(y + 24, slots);
        if (block.matches('.bl-guide-prose')) {
          for (const part of block.children) {
            if (part.matches('figure')) slot(260);
            else y += 20 + lineCount(textOf(part), 15, CONTENT) * 30;
          }
        }
        if (block.matches('.gd-step')) {
          y += 28;
          const head = block.querySelector('.gd-step__head');
          y += Math.max(40, 6 + lineCount(textOf(head?.querySelector('h2')), 20, CONTENT - 52) * 28 + (head?.querySelector('.gd-step__conclusion') ? 6 + lineCount(textOf(head.querySelector('.gd-step__conclusion')), 17, CONTENT - 52) * 30 : 0));
          for (const figure of block.querySelectorAll(':scope > figure.gd-diagram')) { y += 14; slot(diagramHeight(figure)); }
          y += block.querySelector('.gd-step__more') ? 8 + 44 : 0;
        }
      }
    }
  }
  return finish(y, slots);
}

function finish(end: number, slots: [number, number][]) {
  const stretches: Stretch[] = [];
  let cursor = slots.length ? slots[0][1] : 0;
  for (const [from, to] of slots.slice(1)) { if (from > cursor) stretches.push({ from: cursor, to: from, screens: +((from - cursor) / PHONE.height).toFixed(2) }); cursor = Math.max(cursor, to); }
  if (end > cursor) stretches.push({ from: cursor, to: end, screens: +((end - cursor) / PHONE.height).toFixed(2) });
  return { stretches, longest: Math.max(0, ...stretches.map(stretch => stretch.screens)), slots };
}
