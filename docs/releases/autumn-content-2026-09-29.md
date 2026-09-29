# September–October 2026 local content release

Reviewed 349 offline research records as of September 29, 2026. The accompanying JSON records the disposition and evidence links for every research record.

- Add 212 canonical discovery pages: 163 events, 25 offers and 24 openings.
- Refresh 122 existing records while preserving their public URLs.
- Keep 10 ended research records offline and hold 2 unconfirmed leads.
- Include 3 useful programs in the October weekend guide without inventing bookable calendar dates.
- Resulting catalog: 267 events, 86 offers, 44 openings and 97 guides. Visible counts exclude ended items by default.

Dates, eligibility, reservations, soft openings and celebration dates remain distinct. Unknown admission is `null` in planner data, never an assumed zero. Adult entry restrictions are passed to the planner. New city map points are Census reference points for city aggregation, not venue entrances or route coordinates.

The monthly edition, calendar, search, discovery pages, bilingual guides, planner export and OPUS San Francisco offer feed use the updated canonical records. Event engagement requests are split into 100-ID batches to stay below the existing API limit. New offerings and openings are searchable, with direct detail links.

New entries use BAYLINK-owned illustrations with explicit labels. Previously published image credits remain intact. Research image candidates with unconfirmed publication rights remain offline.

Validation includes the complete frontend regression suite, backend catalog tests, TypeScript, ESLint, dependency audit, public-page prerendering, independent decoding of all 494 share-card QR codes, and browser checks of English and Chinese event details, search, soft-opening labels and the calendar. Catalog source checks and translation coverage are retained in the release manifest; this release is a checked snapshot, not a claim of exhaustive or live Bay Area coverage.

The backend release synchronizes the four exported catalogs to `baylink-backend` at commit `d694073730ea886f06b9fc0ef90e49bbba1ef30a`.
