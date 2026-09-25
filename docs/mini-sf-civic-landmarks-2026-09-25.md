# Mini SF: campuses and city landmarks

Nine additional destinations bring the map to 32 landmarks. They use the same warm clay palette, shared primitive geometry and instanced facade details as the existing city. The models represent recognizable exteriors, not surveyed building replicas or permission to enter.

## Destinations and authoritative visitor sources

| ID | Destination / model silhouette | Official visitor source |
| --- | --- | --- |
| `ucsf-parnassus` | Parnassus Heights; stepped hospital/academic wings with wooded hillside | https://www.ucsf.edu/maps/parnassus |
| `ucsf-mission-bay` | Mission Bay; glass research wings, atrium and campus courtyard | https://www.ucsf.edu/maps/mission-bay |
| `sf-state` | SF State main campus; angular student-center roof and campus forecourt | https://future.sfsu.edu/explore |
| `exploratorium` | Pier 15; long waterfront shed, entry facade and pier deck | https://www.exploratorium.edu/visit |
| `stonestown` | Stonestown Galleria; low mall wings and glazed entrance canopy | https://www.stonestowngalleria.com/en/visit/ |
| `city-hall` | City Hall; symmetrical colonnade, stepped dome and gold finial | https://www.sf.gov/location/san-francisco-city-hall |
| `salesforce` | Salesforce Tower and adjacent park; rounded tapering tower, planted transit-center roof | https://www.tjpa.org/salesforce-transit-center/salesforce-park |
| `transamerica` | Transamerica Pyramid; four-sided taper, upper wings and redwood pocket park | https://transamericapyramid.com/redwood-park |
| `oracle-park` | Oracle Park; open grandstand bowl, baseball diamond, scoreboard and lighting masts | https://www.mlb.com/giants/ballpark |

Checked 2026-09-25. Campus names and locations were cross-checked with UCSF's official campus maps and SF State's main-campus address. Stonestown's official address is 3251 20th Avenue; the Exploratorium entrance is Pier 15 on the Embarcadero. Other city coordinates were cross-checked against their named map locations. Anchors are approximate visitor-map points, with the Exploratorium anchored on its landward entrance side, not indoor navigation coordinates. Nearby roads remain the existing official SF geography dataset.

## Visitor boundaries

Each new destination carries `visitNote` and `visitNoteEn`. UCSF clinical/research buildings, university buildings and office towers are not presented as unrestricted tourist interiors. Salesforce Park is identified separately from tower office access. Oracle Park admission follows the relevant game/event/tour arrangement. No live opening hours, ticket prices or private access rights are inferred.

## Photos and runtime

Every destination has a corresponding real photo in `sf-landmark-photo-assets.json`; author, license URL, source page, captured date, reviewed date and original URL are preserved. Main WebP images and 480-pixel alternatives are local assets. All nine new photos were visually inspected; campus captions identify archive photography and access boundaries.

Model scale changes presentation only; geographic anchors remain fixed. Each site clears nearby generic scenery. Walking starts are placed in front of facades, and driving start clearance avoids spawning inside the new models without restricting subsequent free movement. The two tallest buildings receive label-height overrides so names do not intersect their roofs.

## Validation

Targeted world, arrival, driving and photo tests cover coordinate orientation, region distinctions, safe walking starts, free departure, photo identity/files and localized visitor copy. All 29 targeted tests passed, as did TypeScript and targeted ESLint.

All nine landmarks were inspected in the actual `/play` scene in Chrome at 1365 × 900, including the expanded scene. That pass corrected facade bands disappearing inside the two tower meshes, increased Salesforce's selected camera distance to keep its label in frame, and cleared a generic building that obscured BAYBAY at the Exploratorium entrance. Those corrections were visually rechecked. Exploratorium and Oracle Park walking starts were inspected on the landward side. The Exploratorium's real photo loaded and enlarged inside the expanded scene; Escape returned first to its place details, then to the map with focus restored to the photo button. Mobile performance remains part of the combined release review.
