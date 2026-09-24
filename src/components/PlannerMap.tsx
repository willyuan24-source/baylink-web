import { useEffect, useRef, useState } from 'react';
import type { Map as LibreMap } from 'maplibre-gl';
import { translateText, useLocale } from '../i18n/locale';
import type { GeoPoint } from '../lib/planner';
import { recordProductEvent } from '../lib/product-events';

export type MapPoint = { key: string; title: string; location: GeoPoint };
export function PlannerMap({ points, selected, onSelect }: { points: MapPoint[]; selected: string; onSelect: (key: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap>();
  const select = useRef(onSelect);
  const active = useRef(selected);
  useEffect(() => { active.current = selected; }, [selected]);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const locale = useLocale();
  useEffect(() => {
    if (!enabled || !container.current || !points.length) return;
    let cancelled = false;
    void Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')]).then(([module, , worker]) => {
      if (cancelled || !container.current) return;
      module.setWorkerUrl(worker.default);
      const instance = new module.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: [-122.25, 37.65], zoom: 8, cooperativeGestures: true });
      map.current = instance;
      instance.addControl(new module.NavigationControl({ showCompass: false }));
      instance.on('error', () => { if (!cancelled) setFailed(true); });
      instance.on('load', () => { if (!cancelled) setFailed(false); });
      const bounds = new module.LngLatBounds();
      points.forEach((point, index) => {
        const button = document.createElement('button');
        button.className = 'planner-map-pin'; button.type = 'button'; button.dataset.point = point.key;
        button.textContent = String(index + 1); button.setAttribute('aria-label', translateText(point.title, locale));
        button.setAttribute('aria-pressed', String(point.key === active.current));
        button.addEventListener('click', () => select.current(point.key));
        new module.Marker({ element: button }).setLngLat([point.location.lng, point.location.lat]).addTo(instance);
        bounds.extend([point.location.lng, point.location.lat]);
      });
      instance.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 0 });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; map.current?.remove(); map.current = undefined; };
  }, [enabled, points, locale]);
  useEffect(() => {
    container.current?.querySelectorAll<HTMLButtonElement>('[data-point]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.point === selected)));
    const point = points.find(point => point.key === selected);
    if (point && map.current) map.current.easeTo({ center: [point.location.lng, point.location.lat], duration: 400 });
  }, [selected, points]);
  if (!points.length) return <p className="planner-note">当前筛选暂无已核实坐标，仍可使用下方列表。</p>;
  return <section className="planner-map-shell" aria-label="地点地图">
    {!enabled ? <div className="planner-map-placeholder"><span aria-hidden="true">↗</span><h3>把湾区放进你的计划</h3><p>在地图与列表之间切换，选择一站，再看看附近。</p><button className="planner-primary" onClick={() => { setEnabled(true); recordProductEvent('planner_map_opened'); }}>显示互动地图</button><small>地图：OpenFreeMap / OpenStreetMap</small></div> : <div ref={container} className="planner-map" />}
    {failed && <p role="status" className="planner-note">地图暂时不可用，请使用地点列表和官方地址链接。</p>}
    <p className="planner-map-caption">数字对应下方地点；标记是已核实的场馆或区域参考点，不代表入口或路线。</p>
  </section>;
}
