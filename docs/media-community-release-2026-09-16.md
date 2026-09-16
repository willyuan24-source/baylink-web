# BAYLINK introduction, imagery and interaction fixes

The public `/about` page explains the website in plain language: activities and offers, local guides, everyday tools, and housing, secondhand and service listings. It includes a short description of the existing BayBay assistant, a support email and links to the site's policies. Navigation, public HTML, canonical metadata, sitemap and English/Traditional Chinese rendering use the same page.

This release also includes the previously reviewed image and interaction changes:

- Thirteen new image assets, each with a smaller responsive version. Six guides have better matching covers or inline images; 16 offers, 29 events and five openings gain illustrations or sourced images. Local detail pages now display their image with source information and zoom. Posters retain their complete frame. Ten events intentionally remain text-only.
- AI illustrations are labelled; historical place photographs retain their dates, authors and licences; official business publicity retains its source. Source records are in `community-place-photo-sources-2026-09-16.md`, `media-generation-prompts-2026-09-16.md` and `media-and-about-update-2026-09-16.md`.
- Login cancellation and stale AI responses no longer restore dismissed state. BayBay conversations reset between accounts. Contact flows retain their intended recipient after login and reject outdated navigation responses. Event buddy reads are isolated by account, token and event. Profile loading errors can be retried.
- Event links point to actual detail pages; password-reset routes accept a trailing slash; two free-admission events retain their paid-extra notes while appearing in the correct filter.
- The companion API permits existing members to leave a public buddy list after an event ends or their posting access is limited, without creating or restoring an interest record. Deploy the backend before the frontend.

No receipt-scanning or offer-eligibility feature is included. The proposed new social experiences remain design work; this release does not present them as implemented features.

Both repositories were checked locally before publication. The backend passed 103 tests and syntax checks; both dependency audits reported zero vulnerabilities. The final frontend check, including the shorter About copy, passed 408 tests, generated 182 public HTML pages and validated 161 share-card images and QR destinations. The introduction was reviewed in a desktop browser and at a 390-pixel mobile viewport in Chinese and English; no horizontal overflow or failed images were found. Existing lint warnings (37, zero errors) and large-bundle warnings remain non-blocking. The full frontend log is `output/media-community-final-check-2026-09-16.log`.

Deployment commit IDs, CI results and live read-only verification are recorded locally in `output/media-community-release-2026-09-16.json` after publication. Production verification does not create posts, messages or participation records.
