# Practical Bay Area guides — September 27, 2026

Added six evergreen guides, taking the guide catalog from 86 to 92 articles:

| Topic | Guide slug | Official source entries |
| --- | --- | --- |
| Street parking, signs, daylighting and garages | `bay-area-street-parking-first-time-guide` | 8 |
| Bridge tolls, FasTrak, express lanes and rental cars | `bay-area-fastrak-bridge-express-lanes-guide` | 7 |
| Bulky items, electronic waste and household hazardous waste | `bay-area-bulky-items-ewaste-hhw-guide` | 7 |
| County alerts, utility outages and household preparation | `bay-area-alerts-outages-first-day-checklist` | 11 |
| Free ESL and adult learning | `bay-area-free-esl-adult-learning-guide` | 6 |
| Municipal reporting and community assistance via 311 / 211 | `bay-area-311-211-local-help-guide` | 7 |

Each article includes practical steps, a checklist, a copyable template, official action links and the review date. Regional programs are described with their actual city/county scope. Fees, seats, collection eligibility, toll discounts and live conditions are not guaranteed. The articles distinguish operational sources from examples and archive photography.

Research and editorial boundaries:

- [Transport sources](daily-transport-sources-2026-09-27.md): eight parking sources, seven toll sources; source conflicts and daylighting scope documented.
- [Home and preparedness sources](daily-home-sources-2026-09-27.md): hauler/county distinctions, Palo Alto and Novato exceptions, utility-specific outage lookup.
- [Learning and assistance sources](daily-community-sources-2026-09-27.md): enrollment versus placement, noncredit fees and waitlists, city-specific reporting and county referral providers.

Some official pages block direct retrieval. The research notes identify those cases and distinguish official indexed excerpts from fully read pages. The published guides link to the official destination and avoid unverified exact hours or telephone numbers.

## Discovery and language

The guide home now has an “Everyday essentials / 日常办事速查” section with six task links and a search link for the shared 日常办事 tag. It appears on the unfiltered guide view, preserving category, query and saved-reading views. The search placeholder includes practical tasks.

Full English dictionaries cover article bodies, metadata, templates, sources, media and navigation; Traditional Chinese uses the existing converter. Dictionary keys normalize whitespace for multiline template lookup while preserving readable line breaks in translated template values.

The guide registry, image registry, explicit hosting route list, exported guide catalogs, share cards and prerender output include the additions.

## Media

Four new licensed photographs have 1400-pixel and 480-pixel WebP variants; two existing verified photographs become distinct guide covers. Attribution, original URLs, license links and archive dates are in `src/data/daily-life-media.json` and the existing coverage registry.

- Bay Bridge: [Jan.Keromnes, CC0](https://commons.wikimedia.org/wiki/File:The_San_Francisco–Oakland_Bay_Bridge.jpg), April 2017.
- Recology facility: [Derrick Coetzee, CC0](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Recology_San_Francisco.jpg), July 2013.
- Smoke over Duboce Park: [Agomulka, CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:San_Francisco_fire_season_2020.jpg), September 9, 2020; explicitly not a current alert.
- CCSF Student Success Center: [Mariwlqs, CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:CCSF_SSC.jpg), July 2025; campus context, not an ESL class location claim. Month precision avoids the file description / EXIF day mismatch.
- Reused City Hall and Presidio car photographs retain their original author and license. The car caption now explains that an archive photo cannot establish current parking permission.

Contact sheet: `output/daily-media-contact.png`. Browser preview: `output/daily-guides-preview.png`.

## Validation

Targeted ESLint passed. The guide/search/media/template/localization run passed all 42 tests; the final daily-guide and SEO run passed all 9 tests (including the two daily-guide tests repeated after switching their server-render test to StaticRouter). The production build generated 280 public pages. All 255 share-card dimensions and direct-link QR codes passed verification. Test, build and share-card logs are in `output/daily-guides-*.log`; Vite retains its existing large-chunk warning.

Browser checks confirmed all six navigation links, all six filtered search results, an actual article opening, its loaded cover and an English parking article without untranslated editorial strings. The regenerated sitemap was copied from the final prerender output to `public/sitemap.xml` before the SEO checks.

Changes are local; no production deployment was performed.
