# Bay Area attractions and everyday tools — 2026-09-09

The new `/explore` page turns city coverage into a usable outing finder. It lists 18 curated outings across San Francisco, East Bay, Peninsula, South Bay and North Bay, with regional, interest, admission and text filters. Home, navigation and the guide index link to it. Six existing city overviews now link directly to the relevant detailed attraction guides.

## Editorial coverage

13 new guides bring the published library to 52: five San Francisco guides and two each for East Bay, Peninsula, South Bay and North Bay. Each has verified official sources, practical arrival and return guidance, a route, checklists and two corresponding photographs. The 26 photographs have full-size and 480-pixel WebP variants, attribution and licensing links. Image dates identify reference photography rather than promising present-day conditions.

Source records are in `attractions-sf-sources-2026-09-09.md`, `attractions-regions-sources-2026-09.md` and `attractions-regions-photo-sources-2026-09.md`. Important current distinctions include the Hyde Street Pier closure, Alcatraz ferry charges, separate Muir Woods admission and parking/shuttle reservations, Cantor opening days and Hakone's narrowed resident discount eligibility.

## Interactions

- Outing list: up to six known places, reorder/remove, local-browser persistence, map links, text export and a shareable URL. Opening a friend's plan does not overwrite the local plan; editing or restoring removes the old shared URL parameter so refresh retains the chosen plan. Storage/clipboard failures remain usable and are explained.
- BayBay: a user-triggered planning prompt passes the chosen places and asks about starting point, date, transport and companions before arranging the day. New Chinese and English guide catalogs are synchronized to the API. No live ticket availability or travel-time calculation is implied.
- `/tools?tool=unit-price`: compare two to four products, normalize weight, volume or counts, rank before rounding, show comparable savings, and copy a summary. Invalid inputs immediately hide stale output. Real prices are supplied by the visitor; demo data is labeled. Mass and volume cannot be mixed.
- Simplified Chinese, Traditional Chinese and English remain supported, including search, image descriptions, export text and accessible labels. Product names remain verbatim.

## Validation

Full frontend lint/test/build passed with 236 tests and the existing 44 lint warnings, then the final language regression and planning interactions passed 13/13 after the last small changes. The final frontend suite contains 237 tests. Backend syntax and all 64 tests passed against the expanded catalogs. The build prerenders 72 HTML pages with explicit hosting routes and sitemap entries. All media variants are checked for complete WebP data and correct dimensions; cover images have unique content.

Desktop and 390-pixel browser checks covered the finder, English region filters, saved stops, photographs and unit-price example ($0.70 versus $0.75 per 100 g), with no horizontal overflow. The temporary viewport override was reset.

The planner saves only in the current browser; share links transfer the chosen places between devices. It provides starting-point maps rather than optimized driving directions. Admission filters exclude transport, parking, meals and optional paid extras. Suggested durations exclude travel to/from the outing and are editorial estimates.
