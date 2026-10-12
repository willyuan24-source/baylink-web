/**
 * Language checks on the built pages (I18N-SEO-02), run by scripts/verify-release.mjs over every prerendered page:
 *   - /en: no Chinese in the page text or in the head's title, description and social tags, outside markup that says it
 *     is not English on purpose (translate="no": user text and verbatim quotes; lang="zh…"; the language switch, whose
 *     choices name each language in its own script);
 *   - /zh-Hant: no Simplified-only character in the same places (a character the cn → tw conversion would still change).
 * The HTML is walked with a small tag tokenizer: the prerender writes well-formed markup, and only text nodes and a few
 * attributes are read.
 */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'noscript', 'template']);
const ATTRIBUTES = ['alt', 'title', 'aria-label', 'placeholder'];
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (_, entity) => entity[0] === '#'
  ? String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)))
  : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[entity.toLowerCase()]);

/** The text a reader (and a crawler) gets in the page's own language: body text and readable attributes, head tags. */
export function readableText(html) {
  const parts = [];
  const head = html.slice(0, html.indexOf('<body') >= 0 ? html.indexOf('<body') : html.length);
  for (const match of head.matchAll(/<title>([^<]*)<\/title>/g)) parts.push(decode(match[1]));
  for (const match of head.matchAll(/<meta (?:name|property)="(description|og:title|og:description|og:image:alt|twitter:title|twitter:description)" content="([^"]*)"/g)) parts.push(decode(match[2]));
  const body = html.slice(head.length);
  const stack = [];
  let skipDepth = 0;
  const tag = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|<!--[\s\S]*?-->/g;
  let last = 0;
  for (const match of body.matchAll(tag)) {
    const text = body.slice(last, match.index);
    if (!skipDepth && text.trim()) parts.push(decode(text));
    last = match.index + match[0].length;
    if (match[0].startsWith('<!--')) continue;
    const [, closing, rawName, attributes = '', selfClosing] = match;
    const name = rawName.toLowerCase();
    if (closing) {
      // pop to the matching open tag (tolerates an unclosed <p> or <li>)
      const index = stack.map(item => item.name).lastIndexOf(name);
      if (index >= 0) for (const item of stack.splice(index)) if (item.skip) skipDepth--;
      continue;
    }
    if (RAW.has(name)) {
      const end = body.indexOf(`</${name}`, last);
      last = end >= 0 ? body.indexOf('>', end) + 1 : body.length;
      continue;
    }
    const skip = /\stranslate="no"/.test(attributes) || /\sdata-lang-switch\b/.test(attributes) || /\slang="zh/.test(attributes) || /\saria-hidden="true"/.test(attributes) && false;
    if (!skipDepth) for (const attribute of ATTRIBUTES) {
      const value = new RegExp(`\\s${attribute}="([^"]*)"`).exec(attributes)?.[1];
      if (value) parts.push(decode(value));
    }
    if (VOID.has(name) || selfClosing) continue;
    stack.push({ name, skip });
    if (skip) skipDepth++;
  }
  return parts;
}

const HAN = /[㐀-鿿]/;
/** Chinese text on an English page: [{ text }] (empty means clean). */
export function englishProblems(html) {
  return readableText(html).filter(text => HAN.test(text)).map(text => text.replace(/\s+/g, ' ').trim().slice(0, 80));
}

/**
 * Characters Taiwan's standard writes as they are, which opencc's character table still maps (里 → 裏, 吃 → 喫,
 * 床 → 牀, 游 → 遊 …): Traditional text uses them, so they never mark an unconverted string.
 */
const TAIWAN_STANDARD = new Set([...'里吃床游群峰准岩秘唇台干系面只余咸卷占布朴仆扎札杆注踪噪凶棱划灶皂伙佣']);
/**
 * The characters that exist only in Simplified Chinese: opencc's STCharacters keys that change, minus every key of
 * TSCharacters (a Traditional character) and the Taiwan-standard ones above. 们, 这, 湾 count; 里, 准, 台 do not.
 */
export function simplifiedOnlyCharacters(stCharacters, tsCharacters) {
  const traditional = new Set(String(tsCharacters).split('|').map(entry => entry.trim().split(/\s+/)[0]));
  const set = new Set();
  for (const entry of String(stCharacters).split('|')) {
    const [key, ...values] = entry.trim().split(/\s+/);
    if (key && values.length && !values.includes(key) && !traditional.has(key) && !TAIWAN_STANDARD.has(key)) set.add(key);
  }
  return set;
}

/** Simplified-only characters on a Traditional page: ["们 in …"] (empty means clean). */
export function traditionalProblems(html, simplifiedOnly) {
  const problems = [];
  for (const text of readableText(html)) {
    const found = [...new Set([...text].filter(character => simplifiedOnly.has(character)))];
    if (found.length) problems.push(`${found.join('')} in "${text.replace(/\s+/g, ' ').trim().slice(0, 50)}"`);
  }
  return problems;
}
