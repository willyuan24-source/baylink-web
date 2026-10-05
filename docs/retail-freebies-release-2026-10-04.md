# BAYLINK retail and perks release — October 4, 2026

## Scope

Built on production main `303ddd358d925b73f66783ad11a1479048eefddf`, retaining newer site features and all existing offer IDs. The supplied Instagram collage is visual inspiration only; it is not evidence for eligibility, dates or participating stores.

- 64 newly published offer/program records: 50 retail and dining records, four additional birthday programs, and ten everyday Bay Area benefits.
- Seven existing records updated, retaining canonical IDs and existing location metadata: Ulta, Starbucks, Jersey Mike's, Red Robin kids, Nothing Bundt Cakes, Sephora and Krispy Kreme.
- 181 total catalog records, including retained historical anchors; the board hides expired and unconfirmed offers. This is not a claim that 181 unconditional gifts are available today.
- Three new bilingual guides: retail/family deals, birthday perks and everyday free resources. The monthly guide is updated with the complete catalog.
- Four original 1080 × 1350 social posters with verified source records, full conditions, dates, downloadable PNGs, copyable captions and direct-guide QR codes.
- Search within offer boards supports brands, cities, terms, straight/curly apostrophes, Traditional Chinese and the selected English locale. It combines with purchase/reservation filters.
- Frontend catalogs, explicit Vercel routes, prerendered guide/offer pages and BayBay's backend guide catalogs are synchronized.

## Evidence

See `birthday-perks-sources-2026-10-04.md`, `everyday-perks-sources-2026-10-04.md`, `retail-target-lowes-sources-2026-10-04.md`, `retail-family-sources-2026-10-04.md` and `retail-dining-sources-2026-10-04.md`.

Target Liquid I.V. was excluded because its official participating-store list has no Bay Area location. Lowe's mini-bucket/magnet and Halloween-candy social posts did not have sufficient current public official evidence; only the general member-event lookup is provided. Target eos is explicitly a purchase offer. Lowe's MrBeast start time and store stock are not guaranteed. Lakeshore dates come from its explicitly labeled 2026 official PDF, with local confirmation advised.

For IKEA cinnamon buns and the Lowe's year-end tool-bag program, October 4 is the first date verified in this release, not a claim about the original promotion start. Their published deadlines remain explicit.

## Validation and known dependency limitation

New tests cover data/route integrity, translations, spending requirements, subscriptions, combined search, social PNG dimensions and decoded QR destinations. Backend regressions check that Target, Lowe's, Michaels, Lakeshore and Taco Bell questions retrieve their complete conditions and official sources within bounded excerpts. Mobile browser validation uses a 390 × 844 viewport.

The existing frontend dependency tree has an npm audit finding in build-time `braces` through Tailwind 3. The package lock and dependencies are unchanged by this release. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version as of this check; npm suggests a breaking Tailwind 4 migration. The audit gate has not been weakened or bypassed. Backend npm audit reports no vulnerabilities. This dependency migration is separate from the content release.
