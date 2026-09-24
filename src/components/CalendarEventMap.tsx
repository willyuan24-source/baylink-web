import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LibreMap, Marker as LibreMarker } from 'maplibre-gl';
import { MapPin, RefreshCw } from 'lucide-react';
import { translateText, useLocale } from '../i18n/locale';

export type CalendarMapPoint = {
  id: string;
  title: string;
  city: string;
  lat: number;
  lng: number;
  count: number;
  precision: 'venue' | 'city' | 'area';
};

/** Keys for calendar-en.json; keep the generated marker labels localized too. */
export const CALENDAR_MAP_TEXT = {
  label: '当天活动地图',
  loading: '正在加载当天地图…',
  empty: '这一天暂无可定位的活动，请查看当天活动列表。',
  failed: '底图暂时无法加载，请从当天列表选活动，并查看官方地点说明。',
  retry: '重新加载地图',
  guidance: '点击标记查看对应活动；数字表示该位置的活动数。',
  reference: '城市和区域标记仅供了解活动分布，不代表活动入口。具体地点请查活动详情。',
  venue: '场馆参考位置',
  city: '城市参考位置',
  area: '区域参考位置',
  count: '场活动',
  zoomIn: '放大地图',
  zoomOut: '缩小地图',
} as const;

type MarkerEntry = { marker: LibreMarker; button: HTMLButtonElement; id: string };
type MapEngine = typeof import('maplibre-gl');

export function CalendarEventMap({ points, selectedId, onSelect }: {
  points: CalendarMapPoint[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const locale = useLocale(); const t = (value: string) => translateText(value, locale);
  const container = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect); const active = useRef(selectedId);
  const engine = useRef<MapEngine>(); const markers = useRef<MarkerEntry[]>([]);
  const lastFocus = useRef<{ map: LibreMap | null; id: string }>({ map: null, id: '' });
  const [map, setMap] = useState<LibreMap | null>(null);
  const [loaded, setLoaded] = useState(false); const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // A stable value signature avoids resetting the viewport when a parent simply
  // recreates the same array after a list selection or unrelated render.
  const signature = JSON.stringify(points.filter((point, index, all) => point.id && Number.isFinite(point.lat) && Math.abs(point.lat) <= 85
    && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180 && Number.isSafeInteger(point.count) && point.count > 0
    && all.findIndex(other => other.id === point.id) === index));
  const usablePoints = useMemo<CalendarMapPoint[]>(() => JSON.parse(signature), [signature]);
  const hasPoints = usablePoints.length > 0;
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => { active.current = selectedId; }, [selectedId]);

  useEffect(() => {
    if (!hasPoints || !container.current) return;
    let cancelled = false; let instance: LibreMap | undefined;
    setLoaded(false); setFailed(false);
    const timer = window.setTimeout(() => { if (!cancelled) setFailed(true); }, 15000);
    void Promise.all([
      import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
    ]).then(([module, , worker]) => {
      if (cancelled || !container.current) return;
      module.setWorkerUrl(worker.default);
      engine.current = module;
      instance = new module.Map({
        container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [-122.25, 37.65], zoom: 8, cooperativeGestures: true,
        locale: { 'NavigationControl.ZoomIn': translateText(CALENDAR_MAP_TEXT.zoomIn, locale), 'NavigationControl.ZoomOut': translateText(CALENDAR_MAP_TEXT.zoomOut, locale) },
      });
      instance.addControl(new module.NavigationControl({ showCompass: false }), 'top-right');
      instance.on('error', () => { if (!cancelled) { window.clearTimeout(timer); setFailed(true); } });
      instance.on('load', () => { if (!cancelled) { window.clearTimeout(timer); setLoaded(true); setFailed(false); } });
      setMap(instance);
    }).catch(() => { if (!cancelled) { window.clearTimeout(timer); setFailed(true); } });
    return () => {
      cancelled = true; window.clearTimeout(timer);
      markers.current.forEach(({ marker }) => marker.remove()); markers.current = [];
      instance?.remove(); engine.current = undefined; setMap(null);
    };
  }, [hasPoints, locale, attempt]);

  useEffect(() => {
    if (!map || !engine.current || !hasPoints) return;
    markers.current.forEach(({ marker }) => marker.remove()); markers.current = [];
    const bounds = new engine.current.LngLatBounds();
    for (const point of usablePoints) {
      const button = document.createElement('button'); button.type = 'button';
      const reference = point.precision !== 'venue';
      button.className = `calendar-event-map-pin${reference ? ' is-reference' : ''}`;
      button.dataset.calendarPoint = point.id;
      button.setAttribute('aria-pressed', String(point.id === active.current));
      const name = translateText(reference ? point.city || point.title : point.title || point.city, locale);
      const precision = translateText(CALENDAR_MAP_TEXT[point.precision], locale);
      const countLabel = locale === 'en' ? `${point.count} ${point.count === 1 ? 'event' : 'events'}` : `${point.count} ${translateText(CALENDAR_MAP_TEXT.count, locale)}`;
      const label = `${name} · ${countLabel} · ${precision}`;
      button.setAttribute('aria-label', label); button.title = label;
      const place = document.createElement('span'); place.className = 'calendar-event-map-pin-name'; place.textContent = name;
      const count = document.createElement('span'); count.className = 'calendar-event-map-pin-count'; count.textContent = String(point.count);
      button.append(place, count);
      button.addEventListener('click', event => { event.stopPropagation(); select.current(point.id); });
      const marker = new engine.current.Marker({ element: button, anchor: 'bottom' }).setLngLat([point.lng, point.lat]).addTo(map);
      markers.current.push({ marker, button, id: point.id }); bounds.extend([point.lng, point.lat]);
    }
    map.fitBounds(bounds, { padding: { top: 50, right: 55, bottom: 55, left: 55 }, maxZoom: usablePoints.length === 1 && usablePoints[0].precision === 'city' ? 10 : 13, duration: 0 });
    return () => { markers.current.forEach(({ marker }) => marker.remove()); markers.current = []; };
  }, [map, usablePoints, hasPoints, locale]);

  useEffect(() => {
    markers.current.forEach(({ button, id }) => { button.setAttribute('aria-pressed', String(id === selectedId)); button.style.zIndex = id === selectedId ? '4' : '2'; });
    const point = usablePoints.find(item => item.id === selectedId);
    const changed = lastFocus.current.map !== map || lastFocus.current.id !== selectedId;
    lastFocus.current = { map, id: selectedId };
    // A date's new point set should retain its fresh fitBounds unless selection
    // actually changed; merely retaining a selected city must not recenter it.
    if (changed && map && point) map.easeTo({ center: [point.lng, point.lat], duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 350 });
  }, [map, selectedId, usablePoints]);

  if (!hasPoints) return <div className="calendar-event-map-empty" role="status"><MapPin size={20} aria-hidden="true" /><p>{t(CALENDAR_MAP_TEXT.empty)}</p></div>;
  return <section className="calendar-event-map-shell" aria-label={t(CALENDAR_MAP_TEXT.label)}>
    <div className="calendar-event-map-frame">
      <div ref={container} className="calendar-event-map-canvas" aria-label={t(CALENDAR_MAP_TEXT.label)} aria-hidden={failed || !loaded} />
      {(!loaded || failed) && <div className={`calendar-event-map-overlay${failed ? ' is-error' : ''}`}>
        <MapPin size={25} aria-hidden="true" /><p role="status">{t(failed ? CALENDAR_MAP_TEXT.failed : CALENDAR_MAP_TEXT.loading)}</p>
        {failed && <button type="button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={14} aria-hidden="true" />{t(CALENDAR_MAP_TEXT.retry)}</button>}
      </div>}
    </div>
    <p className="calendar-event-map-guidance">{t(CALENDAR_MAP_TEXT.guidance)}</p>
    <p className="calendar-event-map-reference"><span aria-hidden="true" />{t(CALENDAR_MAP_TEXT.reference)}</p>
  </section>;
}
