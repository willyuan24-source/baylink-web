# BAYLINK journal imagery and content release — 2026-09-08

The life-guide library now has 36 guides, with a visual cover and a section-level illustration/photo for every article. The library uses a large illustrated newcomer feature, photo starter cards, photo article cards and six interactive weekend-interest choices. Mobile starter cards use one row per guide so titles remain legible.

## Editorial additions

- Half Moon Bay: Francis Beach coastal half-day, with a four-stop out-and-back plan.
- Reinhardt Redwood: first short walk from Canyon Meadow, with explicit current maintenance context and a four-step plan.
- Presidio: choosing a picnic location before arranging a short walk, with a four-step plan.
- Farmers markets: shopping preparation, food handling and a copyable two-meal shopping list.
- Rainy-day family visits: choosing OMCA or The Tech, checking admission and preparing for children.
- Dogs in public parks: understanding the managing agency, leash areas, current closures and cleanup.

The source review is in `guide-weekends-source-review-2026-09-08.md`. The six additions have independently checked official sources; no article claims first-hand visits or guaranteed access. Old article verification dates were preserved. The events category is now exposed in the library so every published guide remains discoverable and crawlable.

## Images and interaction

- Eight Wikimedia Commons photos with individually reviewed attribution and compatible reuse licenses; real location and capture year stay in article captions. Older skyline/bay photos are labeled archival, not current conditions.
- Three original built-in image_gen illustrations. Prompt text, output names and original PNG handling are recorded in `guide-illustration-prompts-2026-09-08.md`.
- Eleven full images and eleven 480px responsive thumbnails are served locally as WebP. Images reserve dimensions; card and article-body images load lazily. Source metadata is retained in `public/guides/editorial/photo-credits.json`.
- Accessible photo lightboxes preserve focus, support Escape and use the existing modal scroll lock. The two existing city posters remain available in a disclosure.
- Three article itineraries expose four steps each. Keyboard tabs, previous/next actions and Google Maps place links work in the browser. Server rendering retains all steps for readers without JavaScript, indexing and search.
- Guide search and BayBay catalog export share complete block text, including every itinerary stop. New cover images are also used in Open Graph and Article metadata.

## Validation

- Final frontend `npm run check`: 143 tests passed; TypeScript, production build and 54-page prerender passed. ESLint: 0 errors, 44 existing warnings.
- Backend catalog-only update: all 39 API tests passed; no server code changes.
- Fifteen new tests cover imagery, media-file integrity and dimensions, licenses, six interest choices, navigation modifiers, all guide routes, image metadata, route search, no-JS content, lightbox accessibility and article-state isolation.
- Browser checks at desktop and 390 × 844: all viewed assets loaded, new interest choices changed the correct article, mobile starter titles remained readable, image enlargement/close and itinerary switching worked, and no page-level horizontal overflow was present.
- A full-check failure caught the newly populated events category missing from the tab/group list; adding its entry restored all-guide crawlable coverage. The source sitemap was regenerated for the six routes before final checks.

Deployment receipt with the actual frontend/backend commits and production results is recorded under `output/` after deployment. No live posts, accounts or messages were modified.
