import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import QRCode from 'qrcode';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { getContentReviewManifest } from '../src/data/content-review';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { getBayAreaToday, getMonthlyDateRange } from '../src/lib/monthly';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { getBuildWeekend } from '../src/lib/home-weekend-build';
import { getWeeklyCardDays } from '../src/lib/home-weekend';
import { SITE_URL } from '../src/lib/seo';
import { eventOccursOn, addCalendarDays } from '../src/lib/event-calendar';
import { eventPriceChip, eventTone, formatDateChip, readerDayRange, readerMonthDay, toneLabel } from '../src/lib/event-facts';
import { enableUsEnglishTimes, loadLocale, translateText } from '../src/i18n/locale';
import { promoPhoto, sharePicture, type CardLocale } from '../src/lib/share-card-model';
import { rightsBasisOf, type CoverAsset } from '../src/lib/cover';
import { renderWeeklyCardSvg, type WeeklyCardModel } from '../src/lib/weekly-card-svg';
import { createGlyphOutliner, createRasterPool } from './card-glyphs';

const today = getBayAreaToday();
const regions = { all: '湾区', sf: '旧金山', 'east-bay': '东湾', peninsula: '半岛', 'south-bay': '南湾', 'north-bay': '北湾' };
const regionsEn: Record<string, string> = { all: 'Bay Area', sf: 'San Francisco', 'east-bay': 'East Bay', peninsula: 'Peninsula', 'south-bay': 'South Bay', 'north-bay': 'North Bay' };
const LOCALES: CardLocale[] = ['zh-Hans', 'zh-Hant', 'en'];
// US style in the English cards, as on the site's /en pages (H41: "Sat, Oct 17", "2–4pm"; i18n/metadata.ts switches the site).
await enableUsEnglishTimes();
await Promise.all([loadLocale('en'), loadLocale('zh-Hant')]);
const tr = (locale: CardLocale) => (text: string) => locale === 'zh-Hans' ? text : translateText(text, locale);
await mkdir('public/weekly', { recursive: true }); await mkdir('public/calendars', { recursive: true });
await writeFile('public/content-review-manifest.json', JSON.stringify(getContentReviewManifest(today), null, 2));
const icsText = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
const fold = (line: string) => { const out: string[] = []; let current = ''; for (const char of line) { if (Buffer.byteLength(current + char) > 73) { out.push(current); current = ' ' + char; } else current += char; } out.push(current); return out.join('\r\n'); };
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
// Dated cards from an earlier local build would otherwise linger next to the new ones.
for (const directory of ['public/weekly', 'public/weekly/en', 'public/weekly/zh-Hant']) {
  await mkdir(directory, { recursive: true });
  for (const file of await readdir(directory)) if (/^all-\d{4}-\d{2}-\d{2}(?:\.png|\.json|-thumb\.webp)$/.test(file)) await rm(`${directory}/${file}`);
}
const outline = await createGlyphOutliner();
const pool = createRasterPool();
const logo = `data:image/png;base64,${(await readFile('public/brand/baylink-app-icon.png')).toString('base64')}`;
const qrFor = (url: string) => {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  let path = '';
  for (let y = 0; y < qr.modules.size; y++) for (let x = 0; x < qr.modules.size; x++) if (qr.modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`;
  return { path, size: qr.modules.size };
};
const photos = new Map<string, Promise<string | undefined>>();
const photoData = (src?: string) => {
  if (!src) return Promise.resolve(undefined);
  if (!photos.has(src)) photos.set(src, import('sharp').then(({ default: sharp }) => sharp(`public${src}`).resize(940, 760, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer()).then(buffer => `data:image/jpeg;base64,${buffer.toString('base64')}`).catch(() => undefined));
  return photos.get(src)!;
};
const tasks: Promise<number>[] = [];

const card = async (region: string, label: string, catalog: MonthlyEvent[], day: string, name: string) => {
  const range = getMonthlyDateRange('weekend', day)!;
  const selection = getBuildWeekend(day, catalog).picks;
  const weekendCount = catalog.filter(event => [range.start, range.end].some(date => eventOccursOn(event, date))).length;
  // UI9-IMG-A1b (DECISIONS 21/22): every tile is a photo — the event's own promotion-cleared image, else its venue's or a
  // ③ stock picture that promotion allows (share-card-model.ts sharePicture: never AI art, never CC BY-SA), each file once
  // on the card; a ③ picture says 示意图 on the tile.
  const used = new Set<string>();
  const pictures = selection.map(({ event }) => {
    const image = sharePicture('event', event, promoPhoto(GUIDE_IMAGES[event.imageKey]), GUIDE_IMAGES, used);
    if (image) used.add(image.src);
    return image;
  });
  for (const locale of LOCALES) {
    const english = locale === 'en', t = tr(locale);
    const pick = (copy: { zh: string; en: string }) => english ? copy.en : t(copy.zh);
    const tiles = await Promise.all(selection.map(async ({ event, date, editorial }, index) => {
      const tone = eventTone(event);
      const price = eventPriceChip(event);
      const image = pictures[index];
      const photo = await photoData(image?.src);
      const stock = image && rightsBasisOf(image as CoverAsset) === 'stock';
      return { tone, label: pick(toneLabel(tone)), date: t(formatDateChip({ kind: 'day', date, ended: false }, english).label), title: t(event.shortTitle || event.title),
        place: t(event.venueShort ? `${event.city} · ${event.venueShort}` : event.city), sticker: price ? pick(price.text) : undefined,
        pick: editorial ? (english ? 'Editor’s pick' : t('编辑精选')) : undefined, photo, ...(stock ? { badge: english ? 'Illustrative photo' : t('示意图') } : {}) };
    }));
    const more = weekendCount - tiles.length;
    const prefix = locale === 'zh-Hans' ? '' : `/${locale}`;
    const model: WeeklyCardModel = {
      eyebrow: english ? `${regionsEn[region]} this weekend` : t(`${label}本周末`),
      // "10/17–18" / "10/31–11/1" in Chinese, "Oct 17–18" / "Oct 31–Nov 1" in English, like the tiles (WEB-FIX6).
      range: readerDayRange(range.start, range.end, english),
      weekdays: english ? 'Sat–Sun' : t('周六–周日'),
      tiles,
      ...(more >= 3 ? { more: english ? { big: `+${more}`, text: `more events this weekend: scan for the full list` } : { big: t(`还有 ${more} 场`), text: t('本周末的其他活动，扫码看完整清单') } } : {}),
      empty: english ? 'No confirmed events this week yet. Scan for places that are always open.' : t('本周暂没有已确认活动，扫码查看常设去处。'),
      scan: english ? 'Scan for the full list with dates, terms and sources' : t('扫码看当期完整日期、条件与来源'),
      link: `baylink.us${prefix}/n/${region}`,
      footnote: english ? `A snapshot made on ${readerMonthDay(today, true)}, ${today.slice(0, 4)}; check the official page before you go. Unverified prices are never marked free.` : t(`这是 ${today} 生成的快照；行前再查官方。未验证票价不标免费。`),
    };
    const { draw, finish } = outline();
    const svg = finish(renderWeeklyCardSvg(model, qrFor(`${SITE_URL}${prefix}/n/${region}`), logo, draw));
    tasks.push(pool.run({ svg, out: `public/weekly/${locale === 'zh-Hans' ? '' : `${locale}/`}${name}.png` }));
  }
  await writeFile(`public/weekly/${name}.json`, JSON.stringify({ generatedAt: today, day, range, region, picks: selection.map(({ event: { id, title, startDate, endDate, city, venue, costLabel, officialUrl, verifiedAt }, date, editorial }, index) => ({ id, title, date, startDate, endDate, city, venue, costLabel, officialUrl, verifiedAt, ...editorial && { editorial }, ...pictures[index] && { photo: pictures[index]!.src } })) }));
};

// RFC 5545: a TZID needs its VTIMEZONE; the Bay Area's rules (PDT from the second Sunday of March, PST from the first of November).
const VTIMEZONE = ['BEGIN:VTIMEZONE', 'TZID:America/Los_Angeles', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'TZNAME:PDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'TZNAME:PST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD', 'END:VTIMEZONE'];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
for (const [region, label] of Object.entries(regions)) {
  const catalog = MONTHLY_EVENTS.filter(event => region === 'all' || event.region === region);
  await card(region, label, catalog, today, region);
  // The home page links the card for its own day, so Sunday and Monday visitors share what they see.
  if (region === 'all') for (const day of getWeeklyCardDays()) await card(region, label, catalog, day, `all-${day}`);
  const entries: string[] = [];
  let timed = false;
  for (const event of catalog) for (let date = event.startDate > today ? event.startDate : today; date <= event.endDate && date <= addCalendarDays(today, 45); date = addCalendarDays(date, 1)) {
    if (!eventOccursOn(event, date)) continue;
    // A stated session time makes a timed Bay Area event (TZID); otherwise all-day: a time is never invented.
    const sessions = (event.status === 'postponed' || event.status === 'cancelled' ? [] : event.sessions || []).filter(session => session.date === date && session.start && TIME.test(session.start));
    const start = sessions.map(session => session.start!).sort()[0];
    const ends = sessions.map(session => session.end).filter((end): end is string => !!end && TIME.test(end)).sort();
    const end = ends.at(-1) && ends.at(-1)! > start ? ends.at(-1) : undefined;
    const compact = date.replaceAll('-', '');
    const when = start
      ? [`DTSTART;TZID=America/Los_Angeles:${compact}T${start.replace(':', '')}00`, ...(end ? [`DTEND;TZID=America/Los_Angeles:${compact}T${end.replace(':', '')}00`] : [])]
      : [`DTSTART;VALUE=DATE:${compact}`, `DTEND;VALUE=DATE:${addCalendarDays(date, 1).replaceAll('-', '')}`];
    if (start) timed = true;
    const note = start ? '时间来自主办方页面；行前再查官方，这不是门票或入场预约。' : '请查官方时段；这是活动日期提醒，不是门票或入场预约。';
    entries.push('BEGIN:VEVENT', `UID:${event.id}-${date}@baylink.us`, `DTSTAMP:${stamp}`, ...when, `SUMMARY:${icsText(event.title)}`, `LOCATION:${icsText(event.city + ' · ' + event.venue)}`, `DESCRIPTION:${icsText(event.dateLabel + '\n' + event.costLabel + '\n' + note + '\n' + event.officialUrl)}`, `URL:${SITE_URL}/events/${event.id}?date=${date}`, 'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(event.title + ' · 行前核对官方')}`, 'END:VALARM', 'END:VEVENT');
  }
  await writeFile(`public/calendars/${region}.ics`, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Official-source event dates//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:BAYLINK ${label}活动日期`, 'X-WR-TIMEZONE:America/Los_Angeles', ...(timed ? VTIMEZONE : []), ...entries, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n');
}
await Promise.all(tasks);
await pool.close();
// UI9-IMG-A1b (UI9-IMAGES §4 家庭群面板): a ≤ 30 KB WebP preview of each Bay Area card, which the home's 发到家庭群 panel
// shows beside its two buttons (verify:weekly checks the size).
{
  const { default: sharp } = await import('sharp');
  for (const directory of ['public/weekly', 'public/weekly/en', 'public/weekly/zh-Hant']) for (const file of await readdir(directory)) {
    if (/^all(?:-\d{4}-\d{2}-\d{2})?\.png$/.test(file)) await sharp(`${directory}/${file}`).resize(240, 320).webp({ quality: 72 }).toFile(`${directory}/${file.replace(/\.png$/, '-thumb.webp')}`);
  }
}
console.log(`Weekly cards v2 (${getWeeklyCardDays().length} dated Bay Area cards, six regions, three languages) and six subscription calendars generated for ${today}; full source review manifest exported.`);
