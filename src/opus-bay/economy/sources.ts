/**
 * Wave 5 · lane E · the fixed reward sources: an APPEND-ONLY registry. Source i ↔ bit i of save v2 `play.g.coin` (the
 * `coin` bitset holds "this fixed reward was paid"). Never reorder, rename or remove an entry: a saved bit would then
 * mean another source. New attractions, postcards, goals or favours are appended at the end
 * (`npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/coins-place.mts --sources` appends the missing ones); until
 * then the ledger pays them once through `play.e`.
 *
 * Order at W5-E1 (2026-09-28): the pelican, the city goals (the pelican goal first), the six residents' favours, the
 * 24 postcards (city 16, district 8), then the 158 attraction arrivals in data/sf/attractions.ts order.
 */
export const FIXED_SOURCES: readonly string[] = (
  'pelican:unlock goal:pelican goal:postcards goal:cable-car goal:twin-peaks goal:golden-gate goal:painted-ladies ' +
  'goal:neighbourhoods goal:viewpoint goal:sightseeing goal:metro goal:campuses favour:gripman favour:baker ' +
  'favour:muralist favour:gardener favour:ranger favour:record-store postcard:sf-golden-gate-fog ' +
  'postcard:sf-painted-ladies postcard:sf-palace-fine-arts postcard:sf-cable-car-hill ' +
  'postcard:sf-chinatown-lanterns postcard:sf-lombard-street postcard:sf-mission-murals postcard:sf-dolores-park ' +
  'postcard:sf-windmill postcard:sf-city-hall postcard:sf-twin-peaks-view postcard:sf-ocean-beach ' +
  'postcard:sf-state-quad postcard:sf-music-concourse postcard:sf-lands-end postcard:sf-west-portal ' +
  'postcard:ferry-building-dawn postcard:pier7-sunset postcard:exploratorium postcard:filbert-steps ' +
  'postcard:coit-tower postcard:bay-bridge-night postcard:sea-lions postcard:streetcar arrive:golden-gate-bridge ' +
  'arrive:alcatraz arrive:fishermans-wharf arrive:ferry-building-marketplace arrive:chinatown-dragon-gate ' +
  'arrive:lombard-crooked arrive:alamo-square-painted-ladies arrive:palace-of-fine-arts arrive:golden-gate-park ' +
  'arrive:coit-tower arrive:twin-peaks arrive:union-square arrive:city-hall arrive:sutro-baths ' +
  'arrive:sf-state-university arrive:stonestown-galleria arrive:pier-39 arrive:bay-bridge arrive:cal-academy ' +
  'arrive:haight-ashbury arrive:sfmoma arrive:cable-car-powell-market arrive:de-young-tower arrive:ocean-beach ' +
  'arrive:transamerica-pyramid arrive:lands-end arrive:japanese-tea-garden arrive:oracle-park ' +
  'arrive:ghirardelli-square arrive:presidio arrive:dolores-park arrive:exploratorium arrive:salesforce-tower ' +
  'arrive:conservatory-of-flowers arrive:mission-dolores arrive:sf-zoo arrive:sutro-tower arrive:baker-beach ' +
  'arrive:crissy-field arrive:legion-of-honor arrive:cable-car-museum arrive:dutch-windmill arrive:fort-point ' +
  'arrive:castro-theatre arrive:grace-cathedral arrive:harvey-milk-plaza arrive:presidio-tunnel-tops ' +
  'arrive:ucsf-parnassus arrive:japantown-peace-pagoda arrive:university-of-san-francisco arrive:blue-heron-lake ' +
  'arrive:chase-center arrive:ucsf-mission-bay arrive:yerba-buena-gardens arrive:salesforce-park ' +
  'arrive:st-ignatius-church arrive:bernal-heights-park arrive:ccsf-ocean-campus arrive:lake-merced ' +
  'arrive:corona-heights-randall-museum arrive:marina-green arrive:stern-grove arrive:mount-davidson ' +
  'arrive:treasure-island arrive:city-lights-bookstore arrive:asian-art-museum arrive:cliff-house ' +
  'arrive:japan-center arrive:musee-mecanique arrive:tiled-steps-16th-avenue arrive:war-memorial-opera-house ' +
  'arrive:aquarium-of-the-bay arrive:fort-mason-center arrive:sf-botanical-garden ' +
  'arrive:walt-disney-family-museum arrive:bison-paddock arrive:hippie-hill arrive:saints-peter-and-paul-church ' +
  'arrive:st-marys-cathedral arrive:fort-funston arrive:holy-virgin-cathedral arrive:koret-carousel ' +
  'arrive:old-st-marys-cathedral arrive:uss-pampanito arrive:beach-chalet arrive:clement-street ' +
  'arrive:grand-view-park arrive:kezar-stadium arrive:maritime-museum-bathhouse arrive:portsmouth-square ' +
  'arrive:sing-chong-sing-fat-buildings arrive:balmy-alley arrive:boudin-bakery arrive:sentinel-building ' +
  'arrive:sunset-dunes arrive:the-fillmore arrive:wave-organ arrive:academy-of-art-university arrive:calle-24 ' +
  'arrive:china-beach arrive:chinese-historical-society-of-america arrive:cupids-span ' +
  'arrive:golden-gate-fortune-cookie-factory arrive:hyde-street-pier arrive:irving-street ' +
  'arrive:lyon-street-steps arrive:moscone-center arrive:murphy-windmill arrive:national-aids-memorial-grove ' +
  'arrive:seward-street-slides arrive:sfjazz-center arrive:tin-how-temple arrive:union-street-shopping ' +
  'arrive:west-portal arrive:yoda-fountain arrive:buena-vista-cafe arrive:buena-vista-park arrive:clarion-alley ' +
  'arrive:haas-lilienthal-house arrive:maiden-lane arrive:palace-hotel arrive:sf-conservatory-of-music ' +
  'arrive:ss-jeremiah-obrien arrive:sutro-heights-park arrive:uc-law-sf arrive:vermont-street-crooked-block ' +
  'arrive:alta-plaza-park arrive:california-college-of-the-arts arrive:childrens-creativity-museum ' +
  'arrive:crane-cove-park arrive:glide-memorial-church arrive:huntington-park arrive:moad ' +
  'arrive:mount-sutro-open-space arrive:patricias-green arrive:presidio-officers-club arrive:sf-railway-museum ' +
  'arrive:womens-building arrive:bayview-opera-house arrive:chinese-telephone-exchange arrive:glen-canyon-park ' +
  'arrive:greenwich-steps arrive:hidden-garden-steps arrive:ina-coolbrith-park arrive:lafayette-park ' +
  'arrive:mclaren-park arrive:tadich-grill arrive:balboa-theatre arrive:candlestick-point-sra ' +
  'arrive:ingleside-terraces-sundial arrive:mountain-lake-park arrive:noe-valley-town-square arrive:octagon-house ' +
  'arrive:tenderloin-museum arrive:herons-head-park arrive:india-basin-waterfront-park arrive:macondray-lane ' +
  'arrive:visitacion-valley-greenway'
).split(' ');
