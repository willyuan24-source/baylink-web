# BAYLINK September–October content refresh

Reviewed against official sources on September 15, 2026, using Bay Area local dates. The active editorial window now runs from the remaining September dates through October 31.

## Removed or corrected

- Removed five ended event entries: Opera in the Park, Mountain View Art & Wine Festival, SF Turkish Festival, Solano Stroll and Viva CalleSJ, all ending September 12–13.
- Removed Target's September 12 Eucerin giveaway, Lowe's September 12 haunted-house workshop, Michaels' September 12 foam craft and the September 15 limited cake giveaway. Cleaned expired La Boulangerie/ERIA September 12 opening giveaways from the shop and guide copy.
- ERIA now shows open status with the official current hours. Other unconfirmed opening announcements retain their original verification dates and status.
- Upcoming Home Depot workshop copy uses the absolute date October 3. The verified Lowe's fire-plane workshop is October 17. SMCL Discover & Go includes age, card-type and service-area residency requirements.
- Tilden guidance includes the end of public animal feeding and current construction notices. Emma Prusch guidance includes the small-animal-area renovation closure.
- Older-year pumpkin-farm prices and schedules, unconfirmed Halloween programs and cancelled source entries were not republished as confirmed 2026 events.

## Added

- 25 officially sourced events covering all nine Bay Area counties, every October weekend and October 31. The combined active September–October edition contains 41 event entries at the review date.
- 15 additional local offers and free cultural benefits; the combined collection has 26 unique entries, including still-valid September offers and ongoing benefits. Eligibility, registration, paid extras and recurring-date rules remain visible.
- Seven guides: October weekend planning; Half Moon Bay pumpkin/coast planning; San José history/farm family outing; East Bay Tilden; North Bay China Camp; library/museum passes; October savings. The published guide catalog now contains 62 guides.
- Three independently generated conceptual illustrations with explicit AI/non-location captions, full-size and mobile WebP assets. Existing contextual artwork and accurately captioned relevant photos are reused where suitable.
- English editorial translations and corresponding Traditional Chinese rendering remain available through the site's language selector.

Source evidence and exclusions are recorded in:

- `october-events-research-2026-09-15.md`
- `october-offers-research-2026-09-15.md`
- `october-local-guides-research-2026-09-15.md`
- `october-media-prompts-2026-09-15.json`

## Behavior and validation

The monthly page offers separate remaining-September and full-October filters. Ended events are hidden by default, including after the edition becomes an archive; the explicit archive toggle can show retained ended entries. Expired and invalid dated offer cards are omitted. Homepage, monthly promotion, related-guide discovery, sitemap, static guide routes and both BayBay knowledge catalogs point to the updated content. Guide edition notices distinguish travel guidance from offer conditions.

Frontend `npm run check`: 323 tests passed; ESLint has zero errors and 38 existing warnings; TypeScript, Vite and 82-page prerender passed. After final illustration mapping and English edition-label polish, 19 relevant guide/media/localization tests passed. Backend catalog update: 90 tests plus syntax check passed.

Browser checks at desktop and 390×844 verified October filtering, combined search/region/cost filters after reload, English monthly and savings pages, image loading and absence of horizontal overflow. Publication verification and actual commit IDs are recorded separately under local `output/` after deployment.

The update concerns editorial events, offers, openings and guides; it does not certify the availability of user-authored community listings.
