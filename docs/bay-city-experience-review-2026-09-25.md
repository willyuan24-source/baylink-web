# Bay city experience review — 2026-09-25

## Problems addressed

| Observed user problem | Change | Verification |
| --- | --- | --- |
| Buildings clustered only around attractions, then vanished at overview height | Persistent, instanced city blocks, local streets, gardens and trees across inhabited communities; different downtown heights and suburban density | Whole-bay, Peninsula and Sunnyvale screenshots; deterministic geometry and footprint-clearance tests |
| Several cities had a label but no useful destination | 20 additional parks, transit hubs, civic/campus and heritage destinations, bringing the connected world to 88 places and 31 named cities/communities | Official address/coordinate provenance; every destination and approach is on reachable terrain |
| City names did not lead to useful real-life information | City guide with places, current-month and next-month events; compact count on city labels | Date-window tests, exact city/region matching, real occurrence dates, expired-session exclusion and cross-month deduplication |
| Exploring, planning and social participation were separate paths | Event cards link to details, genuine venue directions, a prefilled day plan and the existing interested/go-together section | Sunnyvale October event → matching event/date in plan editor; event participation anchor checked in mobile layout |
| AI lost the context of the place being explored | Ask BAYBAY carries the city, month and catalog references; asks for the traveller's date, transport and companions | Drawer/fullscreen closes and world stays paused; prompt is within the existing 500-character handoff limit |
| Too many equal-weight homepage links | Three primary starting paths: 3D exploration, events and planning; saved plans, community and local AI listings are secondary | English desktop 1440×900, mobile 390×844 and narrow 320×740 checks; existing homepage interaction tests |
| Newly populated towns offered little to do | Two sequential exploration stories across Peninsula towns and East Bay green spaces; six adventures in total | Navigation traversability, actual-arrival, ordered progress, duplicate-claim and save tests |
| Starting a route from a city guide could lose keyboard focus | Successful navigation focuses the game canvas, including the already-arrived case | Regression reproduces the disappearing overview trigger and verifies focus returns to playable stage |
| New city UI existed in DOM but was invisible/unformatted | Added the missing city stylesheet import; flex layout keeps mobile actions in the drawer | Fullscreen desktop and mobile city guide screenshots |

## Geometry and rendering scope

The decorative street fabric is authored and procedurally arranged around real city centres and the existing Bay road corridors. It is **not** a cadastral or exact street/building map. It avoids water, major routes, known nature reserves and attraction approach areas, and does not introduce actor collision obstacles. Larger physical landforms, roads and routes remain simplified for the miniature game.

Current catalog produces approximately 1,447 buildings, 588 trees, 81 green pockets and 2,305 local street segments. Seven instanced object groups and two merged ground groups retain the city's silhouette at all zoom levels. Scene generation is memoized, not repeated per frame. Desktop browser inspection is not a measurement of real-phone frame rate or thermals.

## Event and photo provenance

Events reuse the published BAYLINK catalog, with their individual `verifiedAt` and official links visible. This change does not assert that all 93 catalog listings were rechecked today. City/month membership follows exact published city and region, rather than guessing that an event in a neighbouring city occurs here. Unknown precise coordinates use the actual venue/address search string, not the city centre.

- [Cupertino's official Bike Fest page](https://www.cupertino.gov/Events-directory/Bike-Fest-2026) was checked on September 25: September 26, 2026, Civic Center Plaza, 10300 Torre Avenue. Its published coordinate (37.3188973, -122.0286498) is now a venue-precision planner point.
- [Children's Discovery Museum's official Moon Festival page](https://www.cdm.org/event/mid-autumn-moon-festival/) confirms September 26, 2026 and 180 Woz Way. Existing listing retained.
- Redwood City Oktoberfest and Fremont's Movies Under the Stars official pages returned access errors during this pass; their existing source-check dates were not advanced.

The new destinations add 19 individually inspected real photographs with attribution, source/license links and mobile variants. Burgess Park in Menlo Park remains the one regional photo exception: same-name London photos and conference-only promotional imagery were not substituted. Its panel explicitly says the photograph is pending and links to the official park page. A historical Twin Pines event photograph is labelled with its year rather than represented as a current event.

See `bay-city-landmark-expansion-2026-09-25.md` and the regional photo source register for detailed city and asset provenance.

## Checks and practical limits

- Browser: full-bay overview, city focus, Sunnyvale close view, city/place previews, new monthly tabs, AI handoff, mobile event actions, plan editor anchor and social anchor.
- Local Vite preview does not serve the production API: AI answers and community/interest data correctly showed recoverable network errors there. Production data/API verification is recorded separately after deployment; this local check proves context and UI behaviour, not a successful AI answer.
- No real post, message, interest registration, partner request, prize redemption or account change was submitted as part of QA.
- No paid Higgsfield generation or credit was used in this pass. Existing models and lightweight geometry were improved directly.

Final local verification: **699 tests passed**, TypeScript and production build passed, 263 public pages prerendered, and all 238 share-card images/QR destinations verified. ESLint reported zero errors and the existing 48 warnings. The build retains its existing large-chunk notices; a real-phone performance benchmark remains separate from responsive viewport checks. Production deployment verification is saved in the task's local output receipt.

Production follow-up: the deployed map, added photos, monthly city drawer and real event interest/buddy data loaded successfully. The guest buddy panel opens without creating a public listing. A live AI response exposed an ambiguity: it treated an optional event date as the user's selected day. The city handoff now explicitly states that neither a day nor event has been chosen and supplies optional catalog IDs without dates. The 16 relevant guide/navigation tests, lint, TypeScript and production build passed again after that change.
