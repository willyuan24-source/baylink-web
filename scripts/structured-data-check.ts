/**
 * A schema check for the site's JSON-LD (I18N-SEO-04 / -13): the fields Google's rich results require for Event,
 * Article, BreadcrumbList and ItemList, the value formats it rejects, and the honesty rules BAYLINK adds (an English page
 * carries no Chinese in its labels; a time carries its offset). Used by tests/structured-data.test.ts on the metadata of
 * every published item in three languages and by scripts/verify-release.mjs on every built page.
 * `checkStructuredData(blocks, { english })` returns a list of problems; empty means valid.
 */
const SITE = 'https://www.baylink.us';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/;
const EVENT_STATUS = new Set(['EventScheduled', 'EventCancelled', 'EventPostponed', 'EventRescheduled', 'EventMovedOnline'].map(name => `https://schema.org/${name}`));
const ATTENDANCE = new Set(['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode'].map(name => `https://schema.org/${name}`));
const AVAILABILITY = new Set(['InStock', 'SoldOut', 'PreOrder', 'LimitedAvailability', 'OnlineOnly', 'Discontinued'].map(name => `https://schema.org/${name}`));
const HAN = /[㐀-鿿]/;

type Node = Record<string, unknown>;
const isNode = (value: unknown): value is Node => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const absolute = (value: unknown) => { if (typeof value !== 'string') return false; try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const time = (value: unknown) => typeof value === 'string' && (DATE.test(value) || DATE_TIME.test(value)) && Number.isFinite(Date.parse(value));
/** Comparable instant: a bare date is its whole day (start for a start, end for an end). */
const instant = (value: string, end: boolean) => DATE.test(value) ? Date.parse(`${value}T${end ? '23:59:59' : '00:00:00'}-08:00`) : Date.parse(value);

export type StructuredDataOptions = { english?: boolean; where?: string };

export function checkStructuredData(blocks: unknown, options: StructuredDataOptions = {}): string[] {
  const problems: string[] = [];
  const where = options.where ? `${options.where}: ` : '';
  const fail = (path: string, message: string) => problems.push(`${where}${path} ${message}`);
  const english = (path: string, value: unknown) => { if (options.english && typeof value === 'string' && HAN.test(value)) fail(path, `is Chinese on an English page: ${value.slice(0, 60)}`); };

  const place = (path: string, value: unknown) => {
    if (!isNode(value) || value['@type'] !== 'Place') return fail(path, 'must be a Place');
    if (!text(value.name)) fail(`${path}.name`, 'is required');
    english(`${path}.name`, value.name);
    const address = value.address;
    if (!isNode(address) || address['@type'] !== 'PostalAddress') return fail(`${path}.address`, 'must be a PostalAddress');
    if (!text(address.addressLocality) && !text(address.streetAddress)) fail(`${path}.address`, 'needs a locality or a street');
    if (address.addressCountry !== undefined && !/^[A-Z]{2}$/.test(String(address.addressCountry))) fail(`${path}.address.addressCountry`, 'must be an ISO country code');
    if (address.postalCode !== undefined && !/^\d{5}(?:-\d{4})?$/.test(String(address.postalCode))) fail(`${path}.address.postalCode`, 'is not a US ZIP code');
  };
  const offer = (path: string, value: unknown) => {
    if (!isNode(value) || !['Offer', 'AggregateOffer'].includes(String(value['@type']))) return fail(path, 'must be an Offer or AggregateOffer');
    if (!absolute(value.url)) fail(`${path}.url`, 'must be an absolute URL');
    if (value.availability !== undefined && !AVAILABILITY.has(String(value.availability))) fail(`${path}.availability`, `is not a schema.org availability: ${value.availability}`);
    if (!/^[A-Z]{3}$/.test(String(value.priceCurrency))) fail(`${path}.priceCurrency`, 'must be a 3-letter currency code');
    if (value['@type'] === 'Offer') { if (typeof value.price !== 'number' || value.price < 0) fail(`${path}.price`, 'must be a number ≥ 0'); }
    else if (typeof value.lowPrice !== 'number' || typeof value.highPrice !== 'number' || value.lowPrice < 0 || value.highPrice < value.lowPrice) fail(path, 'needs lowPrice ≤ highPrice');
  };
  const event = (path: string, value: Node, sub = false) => {
    if (!text(value.name)) fail(`${path}.name`, 'is required');
    english(`${path}.name`, value.name);
    if (!time(value.startDate)) fail(`${path}.startDate`, `must be an ISO date or a date-time with its offset: ${value.startDate}`);
    if (value.endDate !== undefined && !time(value.endDate)) fail(`${path}.endDate`, `must be an ISO date or a date-time with its offset: ${value.endDate}`);
    if (time(value.startDate) && time(value.endDate) && instant(String(value.endDate), true) < instant(String(value.startDate), false)) fail(path, `ends before it starts (${value.startDate} → ${value.endDate})`);
    if (!EVENT_STATUS.has(String(value.eventStatus))) fail(`${path}.eventStatus`, `is not a schema.org EventStatusType: ${value.eventStatus}`);
    if (!ATTENDANCE.has(String(value.eventAttendanceMode))) fail(`${path}.eventAttendanceMode`, `is not a schema.org attendance mode: ${value.eventAttendanceMode}`);
    place(`${path}.location`, value.location);
    if (!sub) {
      if (!absolute(value.url)) fail(`${path}.url`, 'must be an absolute URL');
      const images = Array.isArray(value.image) ? value.image : [value.image];
      if (!images.length || !images.every(absolute)) fail(`${path}.image`, 'must be absolute URLs');
      if (text(value.description)) english(`${path}.description`, value.description);
    }
    if (value.organizer !== undefined) {
      if (!isNode(value.organizer) || !text(value.organizer.name)) fail(`${path}.organizer`, 'needs a name');
      else if (value.organizer.url !== undefined && !absolute(value.organizer.url)) fail(`${path}.organizer.url`, 'must be an absolute URL');
    }
    if (value.offers !== undefined) (Array.isArray(value.offers) ? value.offers : [value.offers]).forEach((item, index) => offer(`${path}.offers[${index}]`, item));
    if (value.isAccessibleForFree !== undefined && value.isAccessibleForFree !== true) fail(`${path}.isAccessibleForFree`, 'is only written when true');
    if (value.subEvent !== undefined) {
      if (!Array.isArray(value.subEvent) || !value.subEvent.length) fail(`${path}.subEvent`, 'must be a non-empty list');
      else value.subEvent.forEach((item, index) => isNode(item) && item['@type'] === 'Event' ? event(`${path}.subEvent[${index}]`, item, true) : fail(`${path}.subEvent[${index}]`, 'must be an Event'));
    }
  };
  const organization = (path: string, value: unknown) => {
    if (!isNode(value) || !['Organization', 'Person'].includes(String(value['@type'])) || !text(value.name)) fail(path, 'needs an Organization or Person with a name');
    else if (value.url !== undefined && !absolute(value.url)) fail(`${path}.url`, 'must be an absolute URL');
  };
  const article = (path: string, value: Node) => {
    if (!text(value.headline)) fail(`${path}.headline`, 'is required');
    english(`${path}.headline`, value.headline);
    if (value.datePublished !== undefined && !time(value.datePublished)) fail(`${path}.datePublished`, 'must be an ISO date');
    if (value.dateModified !== undefined && !time(value.dateModified)) fail(`${path}.dateModified`, 'must be an ISO date');
    if (time(value.datePublished) && time(value.dateModified) && String(value.dateModified) < String(value.datePublished)) fail(path, 'is modified before it was published');
    if (value.author !== undefined) (Array.isArray(value.author) ? value.author : [value.author]).forEach((item, index) => organization(`${path}.author[${index}]`, item));
    organization(`${path}.publisher`, value.publisher);
    if (!absolute(value.mainEntityOfPage)) fail(`${path}.mainEntityOfPage`, 'must be the page URL');
    if (value.image !== undefined && !(Array.isArray(value.image) ? value.image : [value.image]).every(absolute)) fail(`${path}.image`, 'must be absolute URLs');
  };
  const list = (path: string, value: Node, breadcrumb: boolean) => {
    const items = value.itemListElement;
    if (!Array.isArray(items) || !items.length) return fail(`${path}.itemListElement`, 'must be a non-empty list');
    items.forEach((item, index) => {
      if (!isNode(item) || item['@type'] !== 'ListItem') return fail(`${path}.itemListElement[${index}]`, 'must be a ListItem');
      if (item.position !== index + 1) fail(`${path}.itemListElement[${index}].position`, `must be ${index + 1}`);
      if (!text(item.name)) fail(`${path}.itemListElement[${index}].name`, 'is required');
      english(`${path}.itemListElement[${index}].name`, item.name);
      const target = breadcrumb ? item.item : item.url;
      // the last crumb may omit its URL (it is the page itself)
      if (!(breadcrumb && index === items.length - 1 && target === undefined) && !absolute(target)) fail(`${path}.itemListElement[${index}]`, 'needs an absolute URL');
      if (typeof target === 'string' && target.startsWith(SITE) && options.english && !/^https:\/\/www\.baylink\.us\/en(?:\/|$)/.test(target)) fail(`${path}.itemListElement[${index}]`, `links another language from an English page: ${target}`);
    });
  };

  const visit = (path: string, value: unknown) => {
    if (!isNode(value)) return fail(path, 'must be an object');
    const type = String(value['@type']);
    if (type === 'Event') event(path, value);
    else if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting') article(path, value);
    else if (type === 'BreadcrumbList') list(path, value, true);
    else if (type === 'ItemList') list(path, value, false);
    else if (type === 'CollectionPage') { if (!text(value.name)) fail(`${path}.name`, 'is required'); if (isNode(value.mainEntity)) visit(`${path}.mainEntity`, value.mainEntity); }
    else if (type === 'Organization' || type === 'WebSite') { if (!text(value.name) || !absolute(value.url)) fail(path, 'needs a name and an absolute url'); }
  };
  if (!Array.isArray(blocks)) fail('JSON-LD', 'must be a list of blocks');
  else blocks.forEach((block, index) => {
    if (isNode(block) && block['@context'] !== 'https://schema.org') fail(`[${index}]`, 'needs @context https://schema.org');
    visit(`[${index}]`, block);
  });
  return problems;
}

/** Every JSON-LD block of an HTML page, parsed (a block that does not parse is a problem of its own). */
export function structuredDataOf(html: string): { blocks: unknown[]; problems: string[] } {
  const blocks: unknown[] = []; const problems: string[] = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { const parsed = JSON.parse(match[1]); blocks.push(...(Array.isArray(parsed) ? parsed : [parsed])); } catch (error) { problems.push(`JSON-LD does not parse: ${(error as Error).message}`); }
  }
  return { blocks, problems };
}
