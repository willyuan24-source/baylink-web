# San Francisco and East Bay attraction expansion

Verified with web searches and page opens on **2026-09-26**. These are evergreen editorial guides, not a monthly edition. Durations and route ordering are editorial suggestions. No exact price, opening-hour, or guaranteed facility-availability promises were added.

## Added content

| Attraction ID | Guide slug | Guide body Han characters |
| --- | --- | ---: |
| lands-end | sf-lands-end-sutro-baths-walk-guide | 751 |
| mission-dolores | sf-mission-dolores-murals-walk-guide | 790 |
| uss-hornet | alameda-uss-hornet-shoreline-day-guide | 835 |
| coyote-hills | fremont-coyote-hills-short-walk-guide | 848 |

All guides have an introduction, three substantive headings, practical duration/cost/arrival information, three mapped route stops, mobility/family/weather/return advice, four checklist items, an official outbound link, and a guides CTA. Each route stop has 78–88 Han characters. No existing dedicated guide duplicated these four subjects; earlier broad SF guides mention Lands End only in general itineraries.

## Lands End and Sutro Baths

- [NPS visitor guide](https://www.nps.gov/goga/planyourvisit/landsend.htm): coastal setting, trees, bath ruins, official trails, and cliff-distance guidance.
- [NPS Lands End accessibility](https://www.nps.gov/goga/planyourvisit/lands-end-accessibility.htm): accessible route begins at Merrie Way and ends at an accessible overlook; stairs and uneven ground follow. Parking, restrooms, and tactile model information support the suggested first stop.
- [NPS Sutro Baths accessibility](https://www.nps.gov/goga/planyourvisit/sutro-baths-accessibility.htm): the paved bath descent is extremely steep, cracked, and uneven.
- [NPS visitor-center place page](https://www.nps.gov/places/000/lands-end-lookout-visitor-center.htm): additional confirmation of exhibits and coastal context. The page describes a temporary café closure; the guide does not promise café service or repeat a potentially stale closure as a current universal condition.

Editorial choice: main route stays above the baths, with descent explicitly optional. The coastal segment is an out-and-back with no promise that the full trail is wheelchair-accessible.

## Mission Dolores Park and Mission murals

- [SF Rec & Park park page](https://sfrecpark.org/892/Mission-Dolores-Park): park location, lawns, city views, playground, restrooms, and street parking. Listed commercial-event fees are not visitor admission prices and were not used.
- [SF Rec & Park Helen Diller Playground](https://sfrecpark.org/648/Mission-Dolores---Helen-Diller-Playgroun): age-sensitive facilities and accessible entry path; does not imply that every play feature or slope is accessible.
- [Precita Eyes homepage](https://www.precitaeyes.org/): community mural organization, current tour information, and center address at 2981 24th Street.
- [Precita Eyes classic mural route](https://www.precitaeyes.org/og-classic-mural-tour.html): 24th Street and Balmy Alley context. This page contains older dated tour text, so its schedule and prices are deliberately excluded.

Editorial choice: park and mural district are separate walking segments, with an optional transport connection. Respectful photography and residential access are part of the route, and the return starts in the 24th Street area unless visitors need to retrieve a car.

## USS Hornet and Alameda shoreline

- [USS Hornet visiting hub](https://uss-hornet.org/visit-hornet/): official museum planning and address.
- [USS Hornet ticket information](https://uss-hornet.org/tickets/): ordinary admission and optional tour charges; no numeric price or permanent opening-day rule repeated.
- [USS Hornet visitor tips](https://uss-hornet.org/visitor-tips/): limited wheelchair/stroller access, steep ladders, continuous adult supervision, bag rules, and backpack-style infant-carrier restrictions. Virtual visit in the hangar offers an alternative to ladder-based spaces.
- [EBRPD Crown Beach](https://www.ebparks.org/parks/crown-beach): Crab Cove access via McKay Avenue, paved paths, visitor-center context, parking, water-quality notices, and no lifeguards.

Editorial choice: Hornet and Crab Cove are independent destinations requiring an explicit transfer. Admission cost is mixed for the combined outing, with paid ship access and free shoreline walking. No direct ferry-to-museum transfer, accessible full-ship route, or beach swimming suitability is promised.

## Coyote Hills

- [EBRPD park page](https://www.ebparks.org/parks/coyote-hills): official entrance, visitor-center parking/restrooms, seasonal gate arrangements, marsh boardwalk, and paved Bayview loop.
- [EBRPD visitor center](https://www.ebparks.org/parks/visitor-centers/coyote-hills): Ohlone and natural history exhibits and center schedules.
- [EBRPD official map](https://www.ebparks.org/sites/default/files/maps/Coyote-Hills-Map.pdf): paved versus unpaved trails, contour lines, marsh areas, and a connector subject to seasonal flooding.

Source conflict: on the verification date the park overview listed New Year's Day as open, while the visitor-center page listed it as closed. The guide flags possible holiday discrepancies and advises confirmation for an exhibit-focused visit, without asserting either schedule.

Editorial choice: short selected sections only, not the full Bayview loop. Paved paths are not described as universally flat or accessible. The closest BART station is not treated as a walk-up trailhead.

## Approximate planner location evidence

These were provided to the integrating agent; no shared geodata files were edited.

- Mission Dolores Park: **37.75975, -122.4270833**, from the coordinates encoded in the Google Maps marker embedded in the [official park page](https://sfrecpark.org/892/Mission-Dolores-Park): 37°45′35.1″N, 122°25′37.5″W. A park-area point, not a designated vehicle entrance.
- Coyote Hills Visitor Center: **37.55314, -122.0907**, [Mapcarta/OSM node 311447704](https://mapcarta.com/N311447704). The [official park page](https://www.ebparks.org/parks/coyote-hills) separately links its main entrance at **37.553623, -122.076027**. These are not interchangeable points.
- Lands End Lookout building: **37.77971, -122.51159**, [Apple Maps place listing](https://maps.apple.com/place?place-id=I10D53F156401DA00), consistent with the named Lookout meeting area. Not an exact parking driveway.

## Validation

- Source payload uses typed Guide[] and Attraction[] exports.
- Programmatic recursive string scan found zero Chinese display strings missing from the English exact-key JSON.
- English JSON contains 171 entries, including all source titles and descriptions.
- Body and stop counts were measured from the actual content values.
- Registry, localization integration, imagery, and planner integration are owned by the parent agent.
