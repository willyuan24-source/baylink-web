# BAYLINK discovery redesign — 2026-10-07

## Brief and evidence

The owner finds the current homepage dated and asks for independent design research and a more considered visual direction. The product remains a Chinese-first Bay Area discovery and practical-life site with English/traditional Chinese support, adjustable reading sizes, real event dates and explicit image provenance.

The visual problem is navigation competing with content: a permanent 222px sidebar plus an 82px utility header, a large abstract slogan beside a small framed photograph, repeated equal-weight grids, and redundant separators. The screenshot alone does not establish that Chinese text renders in a serif font; CSS contains several inconsistent sans-serif fallback stacks.

Primary references reviewed:

- [Airbnb homepage](https://www.airbnb.com/): clear primary categories and one central search workflow. Adopt hierarchy, not its booking fields or branding.
- [Airbnb product release](https://news.airbnb.com/product-releases/airbnb-2025-summer-release): photographs make local experiences tangible. Adopt image-led browsing with meaningful titles.
- [Apple Maps](https://www.apple.com/maps/): curated Guides group places around useful intentions. This is a product-description reference, not a pixel audit of the app.
- [Google Maps Explore update](https://blog.google/products-and-platforms/products/maps/holiday-gemini-tips-new-explore-tab/): nearby discovery with practical visit information. Surface real location/date/cost facts.
- [Anthropic frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): establish a specific design system before coding, give the page one memorable focal point, and critique actual browser screenshots. Read as a public design reference; no external package installed.

## Chosen direction

A contemporary local discovery publication. White canvas, forest-green navigation and actions, a substantial Golden Gate Bridge photograph, and quiet open content rows. Real licensed photography carries the character; decorative gradients, artificial ratings and invented live information are unnecessary.

Palette: white `#ffffff`, soft green `#edf5f1`, ink `#162e29`, supporting text `#54645e`, green `#096b54`, divider `#e7ebe8`. Final shared text colors must satisfy the existing contrast guard.

Type: one native sans-serif stack with deliberate CJK fallbacks and consistent control/portal typography. Headlines 44–52px desktop / 32px mobile; section headings 24–28px; card titles 18–20px; body 16–18px; all participate in reading-scale tokens. No remote font dependency.

Layout:

```text
Logo     Home / Events / Guides / BayBay / More       Search / account / language
-------------------------------------------------------------------------------
Clear purpose + search                 Large Bay Area photo
Three helpful search shortcuts         Specific linked recommendation + source
-------------------------------------------------------------------------------
Weekend date range                                      All events
Photo / title / date / cost     Photo / facts              Photo / facts

Guides for your next step                                  All guides
Intent selection
Photo + useful description     Photo + description        Photo + description

Offers with eligibility / useful tools / calendar / community / footer
```

Preserve every existing data, source, search-vs-question, saved-intent, plan link, language, keyboard, mobile-navigation and reading-size behavior. Existing sourced media only. Use responsive image sizes that match the new real display widths. Secondary destinations remain accessible from More and mobile navigation. Dates and offers continue to be computed from the shared catalog.

## Review scope

Build and inspect a working local version before deciding on release. Verify desktop, mobile, English and traditional Chinese, large reading size, menu/keyboard navigation, search hand-off and original homepage regression tests. Compare browser screenshots, not just CSS or build success. This document does not claim the new design is in production.


## Verified local implementation

- Replaced the fixed rail with one horizontal header and a keyboard-operable More disclosure; existing mobile primary navigation remains.
- Featured a licensed Golden Gate Bridge photo from the existing media catalog, with its archive year and full source/license disclosure. The homepage catalog now explicitly includes this feature.
- Reordered weekend cards to put their linked image first; kept real dates, costs, official sources and plan URLs. Guide photos use responsive sizes matched to their rendered widths.
- Added direct place/new-opening/offer/guide entry points; removed repeated source separators, decorative rankings, and the separate English serif headline rule.
- Kept system fonts and existing dependencies. Shared root/portal/control typography uses the same font token.
- Passed 37 targeted tests, a final four-test homepage rerun, TypeScript, changed-TSX lint, editorial contrast/reading-size guard, full build and static release verification. Final homepage route graph: 217.6 KiB gzip; English with dictionaries: 357.8 KiB, both within unchanged budgets. All 2,662 public pages prerendered and 2,661 sitemap pages have inbound links.
- Browser reviewed: 320px English at 125%, 390px Simplified Chinese, 768px Traditional Chinese at 125%, 1024px English at 125%, 1280×720 laptop, 1440×1000 desktop. Checked search result loading, intent selection, More menu, reading controls and the guide index. Added `vh` fallback for the More panel on pre-15.4 Safari; no physical Safari device run was performed.
- This is a local design preview, not a production release. The development server uses the default local API; community data and authenticated/provider-backed workflows require a running backend. Production acceptance, CI and deployment have not been performed for this design branch.
