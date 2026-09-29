# BAYBAY reliable outings — 2026-09-29

This release adds usable half-day and full-day drafts to existing event recommendations. An outing combines real catalog stops, their available official time evidence and editable travel/stay allowances. It preserves the existing public stop-reference and private saved-plan formats.

## User-visible behavior

- Compare distinct half-day and full-day routes, preview every stop, then apply and edit the whole plan. Unsupported combinations keep the original single-event flow.
- Check opening windows, date overrides, fixed sessions, last admission and last orders. Missing or stale evidence remains unconfirmed; actual time conflicts block calendar export.
- Keep fixed performances at their official time. A museum's opening hours cannot confirm the time of a separate performance.
- Add operating new shops, dining and standalone museums. The expanded catalog contains 267 events and 68 places; announced shops are not added as visitable stops.
- Separate food, transport/parking and other group allowances. Unknown prices stay unknown, and offer eligibility is displayed without automatically reducing the total.
- Save, reopen and export plans with source notes, meal/rest buffers and itemized costs. Changing party size or transport also updates later recommendation constraints.

## Evidence and limits

The initial structured-hours set covers 20 places and 11 events, checked on 2026-09-29. Each rule retains its own official source and applicable dates. Evidence older than 45 days is not used for automatic opening/session guarantees. That threshold is a software freshness rule, not a promise that the venue cannot change its hours sooner.

Travel minutes are editable allowances, not live routes or traffic predictions. Ticket availability, reservations, complete meal prices and special eligibility still require confirmation. The release needs no Google Maps or Ticketmaster credentials.

## Compatibility

The API accepts the optional `costBreakdown`, `breakBeforeMinutes` and `breakLabel` fields and retains legacy saved details. Public share URLs expose only places and date. Per-field validation, ownership checks and optimistic concurrency remain in place. Deploy the API before the website.

The new catalog is also consumed by Little Bay; its card links, media attribution and opening dates must remain compatible.

## Validation

Validation covers official-hours edge cases, real Ferry Plaza / Gott’s / Exploratorium combinations, unknown performance times, explicit offer mapping, account and guest persistence, budget normalization, English notices and phone-width interaction. Local checks and deployment verification are reported in the release conversation; local logs and browser captures remain in `output/` and are not committed.
