# BAYLINK September content update — 2026-09-11

## Published scope

- 11 newly researched events, 21 total monthly events, covering San Francisco, East Bay, South Bay, Peninsula and North Bay.
- 15 offer cards: 5 added cards and 4 refreshed cards. Of the added cards, 3 are new discoveries and 2 were previously mentioned only in article text. Separately label current dated offers, ongoing benefits and the October workshop preview.
- 6 restaurant/shop news items: 1 confirmed September opening, 1 celebration at a store already operating (first service date unverified), 4 announced openings/relocations/reopenings. Plans never become confirmed openings merely because the date passes.
- 1 new bookmarkable/shareable guide, bringing the public guide catalog to 55.
- Monthly quick navigation, independently filtered opening cards, image enlargement, source links, maps and direct links into specific offer cards.
- Mobile offer cards use one column below 480px to keep eligibility text readable. Original monthly illustration remains the leading homepage feature.
- 377 additional English entries; Simplified and Traditional Chinese remain supported.

## Source evidence

See [events](september-events-research-2026-09-11.md), [offers](september-offers-research-2026-09-11.md) and [openings](september-openings-research-2026-09-11.md). Each published card links to its source. Confirmation dates belong to individual entries; old entries have not silently received a new verification date. No reservations, purchases, mailing-list registrations or outbound messages were made.

The unverified Lowe’s LG ice-mold lead and unannounced National Coffee Day offers were excluded. Restaurant recommendations describe the concept and location, not first-hand meals or scores. Woods' already-operating Alioto’s Plaza stand is distinct from the planned 2847 Taylor Street location.

## Media

26 distinct new optimized media records: 22 official publicity/product/archive assets and 4 original illustrations. No unrelated stock image stands in for a confirmed restaurant interior. Year and provenance are stated in captions. Solano uses the explicit advertising-asset page rather than the photo page that requests notification. The page credits/link requirement is retained.

Starbucks' two official image URLs returned HTTP 403 during asset preparation. The site instead uses an original café illustration and labels it as such; research notes retain the original candidate for traceability. Hedley uses a conceptual Art Deco illustration, explicitly not an actual view. Official opening images show Sergeant Ma, ERIA, brand pastries, handrolls and Woods' older products with the corresponding context.

Responsive WebP assets live in `public/guides/september-2026/`; registry and captions are in `src/data/september-update-media.json`. Small sources are not enlarged to invent resolution. Original downloaded candidates and contact sheets remain locally under `output/september-update-media/`.

### Original illustration generation

Mode: built-in image_gen tool. No external image API or CLI was used. Each asset was generated independently, inspected and copied to the workspace before responsive WebP conversion. No requested detail was omitted.

#### sep26-peets-orange

Workspace original: `output/september-update-media/originals/sep26-peets-orange.png`

Published: `public/guides/september-2026/sep26-peets-orange.webp`

Prompt:

> Use case: illustration-story. Asset type: original editorial illustration for BAYLINK's September coffee-deals cards. Create a landscape 3:2 hand-painted gouache and cut-paper illustration: one small glass of dark cold-brew coffee with crystalline ice on an orange cafe table, dramatic afternoon sun and long diagonal shadows, a tiny paper Friday calendar without legible text in one corner, vivid burnt orange, rust, warm cream, cocoa, sophisticated magazine art, pleasing tactile grain. Close-up still life, strong simple composition readable at thumbnail size. This is a concept illustration, not an official advertisement or product photograph. No brand logos, no words, no numbers, no prices, no watermarks, no extra beverages.

#### sep26-peets-pass

Workspace original: `output/september-update-media/originals/sep26-peets-pass.png`

Published: `public/guides/september-2026/sep26-peets-pass.webp`

Prompt:

> Use case: illustration-story. Asset type: original editorial illustration for BAYLINK's coffee-pass explanation. Create a landscape 3:2 playful sophisticated risograph illustration seen directly from above: an iced black coffee in a tall clear glass on a pale sage cafe table, beside a teal reusable cafe pass card and a small month-grid notebook with one coral dot per day; a pair of keys, green botanical leaf and cream paper shapes. Pale sage, deep teal, soft pistachio, sky blue and a coral accent; clean clever composition, tactile printed-paper grain, warm and inviting. Entirely different layout and palette from an orange coffee still life. Concept image only, no official brands or logos, no readable text, no numerals or prices, no watermark, no implication of a free subscription.

#### sep26-open-hedley-club

Workspace original: `output/september-update-media/originals/sep26-open-hedley-club.png`

Published: `public/guides/september-2026/sep26-open-hedley-club.webp`

Prompt:

> Create a refined editorial illustration for BAYLINK, a Bay Area city guide. Landscape 3:2. An imagined Art Deco lounge opening to a palm-filled glass-roof garden courtyard in San Jose: curved velvet chairs in oxblood and jade, brass geometry, a terrazzo table with two tiny unbranded drinks, warm early-evening lighting and subtle cream gouache paper grain. Painterly architectural concept, inviting and sophisticated, conspicuously illustrated rather than photorealistic. Wide composition with a relaxed foreground and a receding courtyard. Not a reconstruction of any real hotel or restaurant. No people, words, logos, dates, prices, signage or watermark. Different from coffee/product illustrations; emphasize architectural space and evening atmosphere.

#### sep26-starbucks-refills

Workspace original: `output/september-update-media/originals/sep26-starbucks-refills.png`

Published: `public/guides/september-2026/sep26-starbucks-refills.webp`

Prompt:

> Create a horizontal 3:2 editorial illustration for a Bay Area everyday-life guide about purchased café drinks and same-visit brewed-coffee refills. Quiet modern café table: steaming plain white ceramic mug with black filter coffee on a saucer, a second small pitcher being set near it, an open paperback with abstract ink marks (no readable text), and a simple wooden chair beside a sunny window with blurred leaves. Emphasize pausing to read in a café. Crisp ink contour and broad cream, forest-green and pale-blue watercolor washes, abundant light negative space. Different from iced coffee/calendar artworks; no iced drinks, no calendar, no pass cards. No people, branded cups, siren logos, lettering, prices, labels or watermark. Clearly an editorial drawing, not a photograph or an official Starbucks advertisement.

## Validation

314 regression tests verified after updating the sitemap (313 passed in the full run; the six-test SEO file passed after the sitemap repair). ESLint: no errors, 38 pre-existing warnings. TypeScript/Vite build passed and prerendered 75 public pages. New opening and offer filters, date boundaries, source/image mapping, archive behavior and English DOM translation were tested.

Browser review at desktop and 390×844: monthly layout, new-shop status filtering, image modal, offer hash navigation, no broken loaded images or horizontal overflow. Final mobile offer readability adjustment reviewed separately. No production user content or accounts were changed.

Deployment verification will be recorded after publishing.
