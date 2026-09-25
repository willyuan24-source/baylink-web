# Little Bay regional worlds — 2026-09-25

## Shipped implementation scope

Three additional playable regions, with 12 public visitor anchors each. Each region mounts one 3D canvas and unmounts the previous region. These are clearly separated game worlds rather than a claim of seamless real-scale transportation.

- **Peninsula:** San Mateo Japanese Garden, Burlingame Avenue, Leo J. Ryan Park, Hiller Aviation Museum, Redwood City Courthouse Square, Filoli, Stanford, Palo Alto Baylands, Half Moon Bay Francis Beach, Coyote Point, Pulgas Water Temple, San Mateo station.
- **South Bay:** The Tech Interactive, San Jose Japantown, Rosicrucian Egyptian Museum, Winchester Mystery House, Hakone, Apple Park Visitor Center, Computer History Museum, Google Visitor Experience, Shoreline, Alviso Marina, Lick Observatory, Diridon station.
- **East Bay:** UC Berkeley, UC Botanical Garden, Tilden Little Farm, Lake Merritt, Oakland Museum of California, Jack London Square/ferry, Crown Beach, USS Hornet, Chabot, Reinhardt Redwood, Ardenwood, Mission Peak.

`regional-world.ts` owns stable region-scoped IDs, public-place reference coordinates, bilingual descriptions, official sources and verified existing guide/planner associations. Projection preserves geographic orientation. Coastlines, roads, relief and warm clay buildings are intentionally simplified and exaggerated for play; the scene explains this and offers real map links for actual visits.

`RegionalBayScene.tsx` reuses the existing BAYBAY/car models, frame-rate-independent movement, camera-relative controls and camera gesture guard. WASD/arrows, ground taps, drag orbit, zoom, free land driving and overview/nearby fast travel are active. Repeated scenery uses instanced meshes and avoids the starting point and main roads. All 36 anchors have a playable land spawn outside their own visit radius.

`RegionalBayExplorer.tsx` contains the game HUD, fullscreen, device-input detection, touch joystick, scene-contained place/photo dialog, guide/source/map links, actual itinerary state and AI planning handoff. Region travel remains available in fullscreen and at stations. Region choices preserve the parent itinerary/date. Choosing a place or spawning does not stamp it: BAYBAY must move into the arrival radius. The parent owns persisted passport state and supplies account-scoped callbacks.

## Source checks

The following official visitor and operator pages were checked on 2026-09-25 for place identity and stable visitor context. Descriptions do not promise current ticket prices, hours or event availability; visitors can open the official source.

- Peninsula: [San Mateo garden](https://cityofsanmateo.org/3319/Central-Park-Japanese-Garden), [Burlingame](https://www.burlingame.org/), [Leo J. Ryan Park](https://www.fostercity.org/Facilities/Facility/Details/Leo-J-Ryan-Park-25), [Hiller](https://www.hiller.org/visit/general-information/), [Courthouse/history museum](https://historysmc.org/san-mateo-county-history-museum/), [Filoli](https://filoli.org/visit/), [Cantor/Stanford](https://museum.stanford.edu/visit), [Baylands](https://www.paloalto.gov/Departments/Community-Services/Parks-Open-Space-Golf-Division/Neighborhood-Parks/Baylands-Nature-Preserve), [Half Moon Bay](https://www.parks.ca.gov/?page_id=531), [Coyote Point](https://www.smcgov.org/parks/coyote-point-recreation-area), [Pulgas](https://www.sfpuc.gov/learning/come-visit/pulgas-water-temple), [San Mateo station](https://www.caltrain.com/station/sanmateo).
- South Bay: [The Tech](https://www.thetech.org/visit/), [Japantown](https://www.japantownsanjose.org/), [Rosicrucian museum](https://www.egyptianmuseum.org/plan-your-visit), [Winchester](https://winchestermysteryhouse.com/), [Hakone](https://www.hakone.com/), [Apple visitor center](https://www.apple.com/retail/appleparkvisitorcenter/), [Computer History Museum](https://computerhistory.org/visit/), [Google Visitor Experience](https://visit.withgoogle.com/plan-your-visit/), [Shoreline](https://www.mountainview.gov/our-city/departments/community-services/shoreline-at-mountain-view), [Alviso](https://parks.santaclaracounty.gov/locations/alviso-marina-county-park), [Lick](https://www.lickobservatory.org/public-visitor-information/), [Diridon](https://www.caltrain.com/station/sjdiridon).
- East Bay: [Berkeley](https://visit.berkeley.edu/), [Botanical Garden](https://botanicalgarden.berkeley.edu/visit/plan-your-visit/), [Tilden](https://www.ebparks.org/parks/tilden), [Lakeside Park](https://www.oaklandca.gov/Community/Parks-Facilities/Parks/Lakeside-Park), [OMCA](https://museumca.org/visit/), [Oakland/Alameda ferry](https://www.sfbayferry.com/routes-schedules/oakland-alameda/), [Crown Beach](https://www.ebparks.org/parks/crown-beach), [USS Hornet](https://uss-hornet.org/visit-hornet/), [Chabot](https://chabotspace.org/visit/plan-your-visit/), [Reinhardt Redwood](https://www.ebparks.org/parks/reinhardt-redwood), [Ardenwood](https://www.ebparks.org/parks/ardenwood), [Mission Peak](https://www.ebparks.org/parks/mission-peak).

Verification corrected changed Caltrain station paths, the Palo Alto park path, Oakland's Lakeside Park URL and the ferry operator route URL. Coordinates are public venue reference points, not surveyed building footprints or routable navigation data.

Real photographs come exclusively from `getRegionalLandmarkPhoto(region, id, locale)`. The separate regional photo registry owns source, author, license, archive date, translated captions and compressed assets. No unrelated guide cover or generated image substitutes for a missing real photograph. Only one open place's photograph is mounted at a time.

## Validation and review

- `tests/regional-world.test.ts`: six passing tests cover 36 anchors/spawns on playable land, walking arrival at every place, correct north/east orientation, free drive versus walk, pause behavior, editorial IDs and cross-region station connections.
- TypeScript build and ESLint passed for the new regional components/data before integration verification. The parent runs the complete repository checks.
- Chrome desktop and 390 × 844 responsive inspection: fullscreen controls and region travel work; initial BAYBAY is visible after scenery clearing; dropdown/overview selection does not add stamps; Filoli's real photo, attribution, enlarged view and two-level Escape return work inside fullscreen. Temporary viewport override was reset.
- Parent independently verified South Bay ground-tap walking increments The Tech's passport count and shows the visit tick. Adding Stanford updates the actual itinerary; traveling to East Bay preserves the selected stop.
- Input capability uses coarse-pointer/touch detection rather than viewport width. A resized desktop browser correctly retains keyboard controls; physical phone gestures remain part of device QA.
- Code review fixes: keyboard keyup always clears movement after focus moves into a menu; account callback changes clear per-session visit deduplication; paused/hidden scenes use demand rendering; active camera transitions still invalidate frames; AI handoff exits the fullscreen overlay; “Added” only reflects the parent's saved itinerary.

## Deliberate limits

This pass supplies playable geography, exploration, real visitor material and shared passport visits. It does not advertise live transit, shop participation, real-world location tracking or prizes. Regional travel is a game switch. Roads are not a routing graph, and the free-driving mode is constrained only by the simplified land boundary. Existing curated regional events are linked through the real date/region calendar, without inventing events at a specific attraction.
