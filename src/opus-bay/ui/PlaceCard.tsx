import { CalendarPlus, MapPin, MapPinned, Navigation, Tag } from 'lucide-react';
import { unprojectCity } from '../core/geo';
import { eventsNear, guideTitle, placeById, todayInBay, useCatalog } from '../data/catalog';
import { AREA_NAMES, landmarkAreaAt, learnZoneNames } from '../data/cityZones';
import { mapsUrl, planStopTitles, planUrl, safeHref, sourceDomain } from '../data/links';
import { PLACE_KIND_NAMES, SF_GUIDE_SLUG, isMonthTagged, placeCardName } from '../data/sf/cityPois';
import type { CityPlace } from '../data/sf/places';
import { closePanel, navigateTo } from '../game/flow';
import { useT } from '../i18n';
import { cityStreamerLazy } from '../world/cityLoader';
import { LinkButton, Sheet } from './common';
import { useIsMobile } from './hooks';
import { GuideRow, NearEvents } from './PoiCardBody';

/**
 * A city place that is not a landmark (G1's place index, OpenStreetMap names; G1's request 3): what it is and where,
 * honest about how little we know yet, the BAYLINK guide / plan when the place has one, Maps, this week's events
 * nearby and the source. 带我去 walks there over the graph (G1's `place:<id>`), a big touch target on phones.
 */
export default function PlaceCard({ place }: { place: CityPlace }) {
  const { t, locale } = useT();
  const catalog = useCatalog();
  const mobile = useIsMobile();
  const name = placeCardName(place.name);
  const zone = placeZone(place);
  const kind = PLACE_KIND_NAMES[place.kind] ?? PLACE_KIND_NAMES.attraction;
  const ll = unprojectCity({ x: place.x, z: place.z });
  const planner = placeById(catalog, place.plannerId);
  const slug = place.guideSlug ?? planner?.guideSlug;
  const guideSlug = slug && isMonthTagged(slug) ? SF_GUIDE_SLUG : slug;
  const guideName = guideTitle(catalog, guideSlug);
  const planTitles = planner ? planStopTitles([{ kind: 'place', id: planner.id }], catalog) : [];
  const near = eventsNear(catalog, ll, todayInBay(), 1.0, 7, new Date()).slice(0, 3);
  const source = safeHref(place.sourceUrl);
  const guideRow = <GuideRow slug={guideSlug} name={guideName} />;
  return (
    <Sheet
      eyebrow={<><MapPin size={14} aria-hidden />{t('真实地点', 'Real place')}{zone && <> · {t(zone)}</>}</>}
      title={t(name)}
      onClose={closePanel}
      className="ob-poi ob-place-card"
      footer={
        <>
          {mobile && guideName && <div className="ob-poi-foot-guide">{guideRow}</div>}
          {place.walkable && (
            <div className="ob-actions">
              <button type="button" className="ob-btn ob-btn-primary" onClick={() => navigateTo(`place:${place.id}`)}><Navigation size={18} aria-hidden /><span>{t('带我去', 'Take me there')}</span></button>
            </div>
          )}
        </>
      }
    >
      <dl className="ob-facts">
        <div><dt><Tag size={15} aria-hidden />{t('类型', 'What')}</dt><dd>{t(kind)}</dd></div>
        <div><dt><MapPin size={15} aria-hidden />{t('街区', 'Area')}</dt><dd>{zone ? t(zone) : t('旧金山', 'San Francisco')}</dd></div>
      </dl>
      <p className="ob-lede">{t('这里的详细介绍还在整理，出发前可以先看看攻略或地图。', 'We are still writing this one up — check a guide or the map before you go.')}</p>
      {!mobile && guideRow}
      {planner && (
        <LinkButton href={planUrl({ stops: [{ kind: 'place', id: planner.id }] }, catalog, locale)} icon={<CalendarPlus size={17} aria-hidden />} tone="soft">
          {t(`把 ${planTitles[0] ?? planner.title} 排进 BAYLINK 计划`, `Put ${name.en} in a BAYLINK plan`)}
        </LinkButton>
      )}
      <div className="ob-link-grid">
        <LinkButton href={mapsUrl(ll.lat, ll.lng, place.name.en)} icon={<MapPinned size={17} aria-hidden />} tone="soft" external>{t('地图', 'Maps')}</LinkButton>
      </div>
      <NearEvents near={near} />
      <p className="ob-source">
        {t('名称和位置', 'Name and location')} · {source ? <a href={source} target="_blank" rel="noopener noreferrer">{sourceDomain(place.sourceUrl) || t('来源', 'source')}</a> : t('来源', 'source')} · {t('查证于', 'checked')} {place.verifiedAt}
      </p>
    </Sheet>
  );
}

/** The area a place is in: a landmark area (CS-8), else its DataSF neighbourhood by name (far.zones), else null. */
function placeZone(place: CityPlace) {
  const lm = landmarkAreaAt(place.x, place.z);
  if (lm) return lm.name;
  if (!place.zone) return null;
  if (!AREA_NAMES.has(place.zone)) { const far = cityStreamerLazy()?.far; if (far) learnZoneNames(far.zones); }
  return AREA_NAMES.get(place.zone) ?? null;
}
