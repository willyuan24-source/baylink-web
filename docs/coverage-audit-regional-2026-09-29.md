# Regional coverage audit — September 29, 2026

Read-only research covered September 29–October 31, 2026. Four verified additions are isolated in `coverage-audit-regional-events.json`; the two remaining leads below are **not published**. No public-source result guarantees live capacity, weather, or a current ticket tier.

## Four publishable records

### Daly City Top of the Hill Festival

- Canonical ID: `daly-city-top-of-the-hill-festival-2026`.
- City announcement confirms **October 17, 2026, noon–6 PM**.
- Place: **Mission Street at John Daly Boulevard, Daly City**, not the city-hall address shown in the site footer.
- County's 2026 funding report explicitly describes free admission for all ages. Food, merchandise, and optional activities are not implied to be free.
- [City event page](https://www.dalycity.org/1221/Daly-Citys-Top-of-the-Hill-Festival).
- [County of San Mateo current-year festival report](https://sanmateocounty.legistar.com/LegislationDetail.aspx?FullText=1&GUID=CAAACC49-AD28-4590-A944-841B4C055DD3&ID=8183943&Options=&Search=).
- Planning is an overall festival window, not an invented timetable for individual performers. Reservation requirements remain unknown.

### Fremont FOG Diwali Mela

- Canonical ID: `fremont-fog-diwali-mela-2026`.
- Organizer and linked ticket seller both confirm **October 24, 2026, 10 AM–7 PM**, **Washington High School, 38442 Fremont Boulevard**.
- Organizer says free registration and free parking. Its directly linked seller explicitly charges admission: the available early-bird widget showed **$4 + $0.22 fee**; the description separately stated **$5 entry**.
- [Organizer](https://fogsv.com/event/fog-diwali/).
- [Organizer-linked EventMozo listing](https://eventmozo.com/event/fog-diwali-mela-2026-224231788158445).
- Publish as **paid**, with `admissionUsd: null`. Do not convert registration or parking into free entry or promise the early-bird tier remains available. Child-ticket rules and individual show times are unconfirmed. Food and market purchases are extra.

### San Jose: The Hellflowers and Knights of Molino

- Canonical ID: `san-jose-hellflowers-free-concert-oct2-2026`.
- Filco Events' own listing confirms **October 2, 6–10 PM**, **Lake Cunningham Skate Park / Lake Cunningham Regional Park, 2305 South White Road, San Jose**.
- The listing specifies doors at **6 PM**, entertainment starts **6:30 PM**, free concert, parking and skating, family-friendly attendance, and food trucks.
- [Organizer listing](https://www.eventbrite.com/e/the-hellflowers-and-knights-of-molino-free-concert-tickets-1996056752479).
- Primary listing was readable through the web search index; direct fetch intermittently failed. No paid API was used.
- Encode the event window separately from the fixed **6:30 PM** performance start. **Individual sets and performance end are unpublished**, so the session has no invented end. Free skating does not establish free equipment rental, instruction, or protective gear. Free-ticket requirement and live capacity are unknown.

### Woodside Djerassi free art hike

- Canonical ID: `woodside-djerassi-free-art-hike-oct5-2026`.
- Organizer's 2026 autumn date list explicitly marks **Monday October 5, 10 AM–noon, free**. Only this free session is included; no other fall date is inferred free.
- [2026 fall hikes](https://djerassi.org/events/fall-art-hikes/).
- [Official directions](https://djerassi.org/about/directions/): **2325 Bear Gulch Road, Woodside**; hikes meet at the gate. A reservation, appointment, or invitation is required to enter the property.
- [Official registration link](https://wl.donorperfect.net/weblink/WebLink.aspx?id=319&name=E134321) was not readable through the browser tool. The event page says registration is open; **remaining capacity is unverified**.
- General prose describes a three-hour, 3.5-mile hike, while this listed free session is two hours. Preserve the specific **10 AM–noon** schedule; do not assign its distance, intensity, age eligibility, or accessibility from the general description.
- The venue is not the Woodside city reference point. No coordinates are added by this packet.

## Not published: Drunken Film Fest Oakland

Confirmed primary sources:

- [2026 organizer homepage](https://www.drunkenfilmfest.com/) and [2026 program](https://www.drunkenfilmfest.com/2026-program).
- [Organizer's Eventbrite RSVP listing](https://www.eventbrite.com/e/free-drunken-film-fest-oakland-2026-oct-3-9-tickets-2001176856849).
- [Opening-night venue ticket page](https://www.tickettailor.com/events/shapeshifterscinema/2379534).

The dates and named venues are real, but must not become one event pinned to a misleading default address:

| Date | Published venue | Confirmed timing and cost |
| --- | --- | --- |
| October 3 | Shapeshifters Cinema, 567 5th Street | Ticketed opening feature, 7–9 PM; ticket price unconfirmed |
| October 4 | Double Standard (outdoors) | Free shorts; doors 6 PM, about 7 PM start |
| October 5 | Stay Gold (outdoors) | Free shorts; doors 6 PM, about 7 PM start |
| October 6 | Beeryland (outdoors) | Free shorts; doors 6 PM, about 7 PM start |
| October 7 | Temescal Brewing (outdoors) | Free shorts; doors 6 PM, about 7 PM start |
| October 8 | Eli's Mile High Club | Free shorts; doors 6 PM, about 7 PM start |
| October 9 | Prescott Market (outdoors) | Free shorts; doors 6 PM, about 7 PM start |

Seating is first come, first served; drinking is not required. Still needed: verify each free venue's **current street address, age policy, and actual end time** and choose a per-occurrence venue model or separate records. The aggregate Eventbrite page's generic 409 13th Street address is not accepted as all six venues; its 7–10 PM header must not supply an end time for every night. The legacy `/oakland` page describes **2025** and is excluded. A third-party listing labels the entire October 3–9 run free, which contradicts the ticketed October 3 opening and is not used.

## Not published: Studio One open house

- Proposed event: **October 3, 2026, noon–6 PM**, **Studio One Arts Center, 365 45th Street, Oakland**.
- [Temescal Business Improvement District program](https://temescaldistrict.org/events/temescal-arts-week/?mo=10&yr=2026) corroborates that dated venue/time and all-ages art programming. Its broad series header is not the single open-house date or time.
- [Official event listing](https://www.eventbrite.com/e/studio-one-open-house-community-event-art-show-tickets-1998513010212) returned HTTP 429 during this check.
- [Organizer-submitted announcement](https://sf.funcheap.com/studio-art-center-open-house-art-show/) says free all day, drop-ins welcome, RSVP optional, and Eventbrite signups get a raffle ticket. This is supporting evidence, not a successfully fetched official ticket inventory.
- Before publishing, reopen the official organizer listing and confirm **free admission, reservation and raffle conditions, workshop availability**. Food vendors must not be described as free food.
- A separate Meetup group's pre-event gathering is at Mother Tongue Cafe; **that is not the open house venue**.

## Duplicate and source checks

Searches of current `src/data` and `public/event-catalog.json` found no canonical-name, known-alias, official-domain or ticket-ID match for the six candidates. Little Italy San Jose, Berkeley Bird Festival and Science in the Park were already present and excluded. Water Lantern Festival, UMe Tea San Mateo and Pinot's Palette Alameda were outside this packet per root coordination.

No confirmed new-store opening promotion was manufactured from evergreen offers or undated grand-opening labels. GospelFest Oakland remains outside this packet because only its October 25 date was confirmed, without dependable venue/time/price evidence.

## Backend synchronization note

The backend reads its own `data/planner-catalog.json` in `lib/planner.js:22` and `data/event-catalog.json` in `lib/eventEngagement.js:17`; both are loaded during route registration. Frontend publishing alone does not replace those running catalogs. Root owns export, independent backend synchronization and deployment.
