import { useEffect, useRef, useState } from 'react';
import { Download, Share2, Users, X } from 'lucide-react';
import { toast } from '../core/store';
import type { Bilingual, Catalog, CatalogEvent } from '../core/types';
import { eventById, eventSpot, nextShowing, useCatalog } from '../data/catalog';
import { landmarkAreaAt } from '../data/cityZones';
import { publicText } from '../data/publicText';
import { loadTransit } from '../data/transit';
import { track } from '../game/metrics';
import { loadQr } from '../game/photoCard';
import { holdLock } from '../game/playerLock';
import { catalogText, useT } from '../i18n';
import type { Locale } from '../../i18n/locale';
import { loadedRealStops, nearestRealStops } from '../realsf/transitReal';
import { useDevice } from './hooks';
import { downloadFile, fileToDataUrl, inAppBrowser, refusedShareRoute, saveRoute, sharePayload, type SaveRoute } from './shareFile';
import { cardFont, layoutCard, paintCard, type Measure } from './shareCardDraw';
import { eventCard, howLines, placeCard, weekendCard, type FamilyCard, type ShareCardSpec, type Tr } from './shareCardModel';
import type { OverlayProps } from './slots';
import './album.css';

/**
 * Wave 9 · lane S · W9-S4 — the 「约家人」 card (review R§5 #8, §8 idea 5): the overlay SHARE_CARD_ID that the event card,
 * the place card and 我的周末 open (ui/ShareCardButton.tsx). It builds the vertical picture (ui/shareCardDraw.ts: date,
 * place, cost, how to get there, the QR code to `?at=<spot>&from=family`) and shows it as a data: image, so a long
 * press saves or forwards it in WeChat and the other in-app browsers; 保存 / 分享 go the album's way (ui/shareFile.ts:
 * the share sheet with the file + the link, a refused share falls back, a download elsewhere). A sent card counts
 * `track('share', 'card')`.
 */

const TEXT = {
  title: { zh: '约家人', en: 'Invite family' },
  making: { zh: '正在做卡片…', en: 'Making the card…' },
  failed: { zh: '这张卡片没做出来，稍后再试', en: 'Could not make the card — try again later' },
  pressHint: { zh: '长按图片，保存或发给家人', en: 'Press and hold the picture to save or send it' },
  hint: { zh: '保存到相册，或直接分享到家人群', en: 'Save it to Photos, or share it with your family' },
  save: { zh: '保存', en: 'Save' },
  share: { zh: '分享', en: 'Share' },
  saved: { zh: '卡片已保存', en: 'Card saved' },
  copied: { zh: '卡片已保存，链接也复制好了', en: 'Card saved, and the link is copied' },
  shareText: { zh: '一起去吗？来自 BAYLINK 湾区小旅', en: 'Want to go together? From Little Bay Trip on BAYLINK' },
} satisfies Record<string, Bilingual>;

/**
 * The catalog's words in the reader's language: the site's runtime translates the DOM (the event card's title shows in
 * English), not a picture — catalogText gives the dictionary's English for an exact entry (Chinese kept otherwise);
 * the date line and the cost as the event card shows them (data/publicText.ts, lane R's W9-R5: never the editors'
 * working notes).
 */
const said = (e: CatalogEvent, locale: Locale): CatalogEvent => {
  const tx = (s?: string) => (s ? catalogText(s, locale) : s);
  const pub = (s?: string) => (s ? publicText(s, locale) || undefined : s);
  return { ...e, title: tx(e.title) ?? e.title, dateLabel: pub(e.dateLabel), venue: tx(e.venue), city: tx(e.city), costLabel: pub(e.costLabel) };
};

/** The card's words for a spec (null: the event is not in the catalog any more). */
function cardFor(spec: ShareCardSpec, catalog: Catalog | null, t: Tr, locale: Locale): FamilyCard | null {
  const stops = loadedRealStops();
  const how = (p: { x: number; z: number } | null | undefined) => (p ? howLines(nearestRealStops(p, stops), t) : []);
  // (a card without its own area eyebrow: the landmark area it stands in, as the map names it)
  if (spec.kind === 'place') return placeCard({ ...spec, zone: spec.zone ?? landmarkAreaAt(spec.x, spec.z)?.name }, { t, how: how(spec) });
  if (spec.kind === 'event') {
    const event = eventById(catalog, spec.id);
    if (!event) return null;
    const next = nextShowing(event)?.date ?? null;
    const spot = next ? eventSpot(event) : null;
    return eventCard(said(event, locale), { t, next, spot, how: how(spot) });
  }
  const items = spec.events.map(e => ({ e: eventById(catalog, e.id), on: e.on })).filter((x): x is { e: NonNullable<typeof x.e>; on: string[] } => !!x.e)
    .map(({ e, on }) => ({ event: said(e, locale), on, spot: eventSpot(e) }));
  return weekendCard(items, spec.places.map(p => catalogText(p, locale)), { t, days: spec.days });
}

/** The picture: a CARD_W-wide PNG (the code when the qrcode chunk loads; else the address alone). */
async function makePicture(card: FamilyCard, locale: Locale): Promise<File | null> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try { await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready; } catch { /* system fonts */ }
  const font = cardFont(locale);
  const measure: Measure = (text, size, weight) => { ctx.font = `${weight} ${size}px ${font}`; return ctx.measureText(text).width; };
  const layout = layoutCard(card, measure, font);
  const qr = await loadQr(card.url);
  canvas.width = layout.w; canvas.height = layout.h;
  paintCard(ctx, layout, qr);
  const blob = await new Promise<Blob | null>(resolve => { try { canvas.toBlob(resolve, 'image/png'); } catch { resolve(null); } });
  return blob ? new File([blob], card.file, { type: 'image/png' }) : null;
}

export default function ShareCard({ props, close }: OverlayProps) {
  const { t, locale } = useT();
  const touch = useDevice() === 'touch';
  const catalog = useCatalog();
  const spec = props as ShareCardSpec | undefined;
  const [state, setState] = useState<{ card: FamilyCard; file: File; url: string } | 'making' | 'failed'>('making');
  const closeRef = useRef<HTMLButtonElement>(null);
  // a long press on the picture (WeChat & co.: the way out) counts the card once per opening
  const pressed = useRef(false);
  const tr: Tr = (zh, en) => t(zh, en);

  useEffect(() => holdLock('panel', 'share-card'), []);
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (!spec) { setState('failed'); return; }
    if (spec.kind !== 'place' && !catalog) return; // (making… until the catalog is in)
    let live = true;
    setState('making');
    void (async () => {
      try {
        await loadTransit(); // (the 怎么去 lines: the transit chunk is in by now in the city; cheap when it is)
        const card = cardFor(spec, catalog, tr, locale);
        const file = card ? await makePicture(card, locale) : null;
        if (!live) return;
        if (!card || !file) { setState('failed'); return; }
        setState({ card, file, url: await fileToDataUrl(file) });
      } catch { if (live) setState('failed'); }
    })();
    return () => { live = false; };
    // (one picture per spec and language; the catalog arrives once)
  }, [spec, catalog, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = typeof state === 'object' ? state : null;
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const inApp = inAppBrowser(nav?.userAgent);

  const send = async (asSave: boolean) => {
    if (!ready) return;
    const { card, file } = ready;
    let route: SaveRoute = saveRoute(nav, file, asSave, touch);
    // (inside the tap: iOS shares only from a gesture — nothing is awaited before navigator.share)
    if (route === 'share') {
      try {
        await navigator.share(sharePayload(nav, file, { title: card.title, text: t(TEXT.shareText), url: card.url }, asSave));
        if (!asSave) track('share', 'card');
        return;
      } catch (error) {
        const next = refusedShareRoute(error, nav);
        if (!next) return;
        route = next;
      }
    }
    if (route === 'longpress') { toast(TEXT.pressHint, 'info', 2600); return; }
    downloadFile(file);
    if (asSave) { toast(TEXT.saved, 'info', 2000); return; }
    track('share', 'card');
    let copied: boolean;
    try { await navigator.clipboard?.writeText(`${card.title} ${card.url}`); copied = !!navigator.clipboard; } catch { copied = false; }
    toast(copied ? TEXT.copied : TEXT.saved, 'info', 2600);
  };

  return (
    <div className="ob-album-wrap" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <section className="ob-album ob-share-card" role="dialog" aria-modal="true" aria-labelledby="ob-share-card-title">
        <header className="ob-album-head">
          <span className="ob-album-icon" aria-hidden><Users size={18} /></span>
          <h2 id="ob-share-card-title">{t(TEXT.title)}</h2>
          <button ref={closeRef} type="button" className="ob-icon-btn ob-icon-sm ob-album-close" onClick={close} aria-label={t('关闭', 'Close')}><X size={20} aria-hidden /></button>
        </header>
        <div className="ob-share-card-pic">
          {ready ? <img src={ready.url} alt={ready.card.title} onContextMenu={() => { if (!pressed.current) { pressed.current = true; track('share', 'card'); } }} /> : <p className="ob-album-empty">{t(state === 'failed' ? TEXT.failed : TEXT.making)}</p>}
        </div>
        {ready && <p className="ob-album-press-hint">{t(inApp ? TEXT.pressHint : TEXT.hint)}</p>}
        <div className="ob-album-actions">
          <button type="button" className="ob-btn ob-btn-primary" disabled={!ready} onClick={() => { void send(true); }}><Download size={17} aria-hidden /><span>{t(TEXT.save)}</span></button>
          <button type="button" className="ob-btn ob-btn-soft" disabled={!ready} onClick={() => { void send(false); }}><Share2 size={17} aria-hidden /><span>{t(TEXT.share)}</span></button>
        </div>
      </section>
    </div>
  );
}
