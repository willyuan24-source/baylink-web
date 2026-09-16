# October 2026 local guides — source and expiry audit

Checked September 15, 2026. Planned coverage ends October 31, 2026. Six guides are exported by `src/data/guides-october-local.ts`; exact-string English entries, including the September opening cleanup, are in `src/data/october-local-en.json`.

## Published guide scope

| Slug | Editorial purpose | Official evidence |
| --- | --- | --- |
| `bay-area-october-weekend-planner-2026` | Assign one region to each October weekend, including October 31; flexible editorial schedule, not a list of promised special events | The individual venue sources below; ordinary calendar arithmetic |
| `half-moon-bay-october-pumpkin-coast-guide-2026` | Separate a farm visit from the festival; plan arrival and return; distinguish stale seasonal pages | [2026 directions](https://www.hmbpumpkinfest.com/event-details/directions-map.html), [transit](https://www.hmbpumpkinfest.com/event-details/public-transit.html), [farm directory](https://www.hmbpumpkinfest.com/experience/pumpkin-patches.html) |
| `san-jose-october-family-history-farm-guide-2026` | Choose History Park or Emma Prusch rather than rushing both; check current closures | [History Park 2026 visitor information](https://historysanjose.org/plan-your-visit/history-park/), [event calendar](https://historysanjose.org/programs-events/), [city park page](https://www.sanjoseca.gov/Home/Components/FacilityDirectory/FacilityDirectory/2180/2028) |
| `east-bay-tilden-october-family-guide-2026` | A short nature visit with current animal-feeding and trail-access rules | [Tilden Nature Area](https://www.ebparks.org/parks/tilden-nature-area), [park facilities](https://www.ebparks.org/parks/tilden) |
| `north-bay-china-camp-october-culture-guide-2026` | Chinese American local history, a village picnic, and an optional separate short trail | [Visit highlights](https://friendsofchinacamp.org/visit-the-park/highlights/), [FAQ](https://friendsofchinacamp.org/about-china-camp/faqs/), [trail rules](https://friendsofchinacamp.org/visit-the-park/activities/) |
| `bay-area-october-library-museum-pass-guide-2026` | Turn eligible library passes into a practical outing; distinguish free days and pass benefits | [SFPL](https://sfpl.org/discover-and-go), [SJPL FAQ](https://www.sjpl.org/faq/programs-events-faqs/), [Berkeley FAQ](https://www.berkeleypubliclibrary.org/discover-go-frequently-asked-questions), [program portal](https://www.discoverandgo.org/) |

## Material current findings

- Half Moon Bay: the official directions page expressly names **October 17–18, 2026, 9 am–5 pm**. Its congestion advice was used without promising a congestion-free departure time or detour. The transit page links to the operators; no route, fare, or shuttle frequency was invented.
- History Park: the official visitor page labels its schedule **2026** and distinguishes grounds, historic buildings, and trolley hours. The guide makes these separate, conditional arrangements and does not claim special events or all of Kelley Park are free.
- Emma Prusch: the city page still announces the **Small Animal Area temporarily closed for renovation**, without a reopening date. The guide recommends play and picnic space instead of promising animal contact.
- Tilden: the current Nature Area page says **public feeding has ended**. The older downloadable brochure invites feeding lettuce/celery; the current webpage takes precedence. The page also identifies May–December 2026 work and a September 15 update to a Laurel Canyon Trail closure. No closed loop is recommended.
- China Camp: village museum admission, parking, and trail access are separate. Current operator pages identify the short Turtle Back loop and its different access restrictions. The guide does not turn a library card into a parking permit: borrowing the actual pass is required.
- Library passes: SFPL, SJPL, and Berkeley have distinct eligibility rules. Pass inventory is private and dynamic; the guide offers no claim of remaining October seats or a guaranteed museum benefit. SJPL's monthly release example is kept specific to SJPL.

## Sources deliberately not promoted to current 2026 offers

- [Half Moon Bay FAQ](https://hmbpumpkinfest.com/event-details/quick-facts): main body still says October 18–19, **2025**, despite a 2026 footer. The guide uses the explicit 2026 directions page for dates and avoids copying old contest times, sponsor giveaways, or parking-lot details.
- [Arata farm homepage](https://www.aratapumpkinfarm.com/): contains October 31 on a Friday and a last-weekend message inconsistent with 2026; its [season-pass page](https://www.aratapumpkinfarm.com/season-pass/) expressly references **2025**. No 2026 price, opening date, or discount is inferred.
- [Farmer John's linked page](https://farmerjohnspumpkins.com/farmer-johns-pumpkin-farm) yielded too little current text to establish a 2026 price or schedule. The guide provides the organizer's directory for discovery and requires the farm's current announcement before purchase.

## September opening cleanup

`september-openings.ts` and `guides-september-openings.ts` were edited only for the expired September 12 ERIA Marina celebration and dependent copy.

- The espresso/pastry promotion has been removed, and the celebration is marked ended.
- [La Boulangerie's official locations page](https://www.laboulangeriesf.com/locations-hours) explicitly lists the ERIA Marina store as open. Its card is now `status: 'open'`; no first-service date is invented. The existing `opening-celebration` classification remains historical, not a current event invitation.
- ERIA's individual verification date is September 15. Other stores retain September 11 rather than falsely implying fresh opening verification.
- Florecita's official homepage yielded no verifiable updated opening date; its September 20 relocation plan stays unconfirmed. Handroll Hawker's page lists its concept and address without a firm new service-start announcement; it stays announced. Woods' page did not establish the new Taylor Street location as open. Hotel De Anza's page timed out. No forecast was promoted to an opening because the date approached.
- The guide's summary, verification note, final advice, and current-edition link copy were adjusted accordingly. English includes the computed date-plus-summary paragraph and source title.

## Editorial boundaries

Route ordering, observation games, suggested durations, lunch breaks, and weekly groupings are original editorial suggestions. These guides are practical complements to October event and offer cards, not duplicate ticket inventories. The root task owns guide integration, media, complete language regression, build/export, and publication.
