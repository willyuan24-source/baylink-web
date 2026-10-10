# Editorial overlay (events, offers, openings)

Short reader-facing forms and structured facts for catalog items live in `src/data/editorial-overlay/`, keyed by id and applied
after every content and media overlay (`apply.ts`; hooks in `monthly-edition.ts`, `october-offers.ts`, `local-discoveries.ts`).
Source packages stay as they are. Cards and detail pages read the fields through `src/lib/event-facts.ts` and fall back to the full
fields when an item has no entry.

## Fields (events, `events.json`)

| Field | Rule |
|---|---|
| `shortTitle` | Card title, ≤16 display units (CJK 1, Latin ½), no colon. A title that already fits is used as is. |
| `dek` | "Why go", ≤30 units, no dates or prices (they are on the chips). |
| `sessions` | `[{date, start?, end?}]`, 24-hour times, one per confirmed day. When present they are the event's confirmed days, so they must agree with `occurrenceDates`. |
| `price` | `{free?, min?, max?, note?}` in USD. `free` only when entry is free; amounts only for paid or mixed events. |
| `venueShort`, `address` | Derived from `venue` ("Name · street address"); store only to override. `address: ""` means no single address. |
| `ageChip` | Only from a stated age rule ("21+", "0–5 岁"). |
| `tips` | ≤3, each ≤40 units, each adding information the other fields do not carry. |
| `dateNote` | Schedule exceptions, detail page only. |
| `plan` | Replaces the cleaned plan: a number keeps that line of the cleaned plan, a string is a rewritten line. |
| `fix` | Corrects a source fact (title, dateLabel, costLabel, occurrenceDates…). Never `id`, `verifiedAt` or `imageKey`. Each correction needs a dated source read in `docs/source-reads-2026-10.md`. |

Offers (`offers.json`): `shortTitle`, `dek`, `tips`, `valueText`, `publicBenefit`, `fix`. Openings (`openings.json`): `shortTitle`,
`dek`, `openedOn` (only the stated first day of public service), `fix`.

For a covered event the plan is cleaned automatically: the filler sentence "出发前查看主办方最新公告，按场次确认余票、入场要求及交通安排。",
a "时间安排：" line that only repeats the date label, and the copy of the cost label at the start of a "费用与参加条件：" line are removed.
A date label also drops its repeated dates ("10/24 · 10 月 24 日 · 11:00–14:00" reads "10/24 · 11:00–14:00";
"10/17–10/18 · 10 月 17–18 日 · 周六…" reads "10/17–10/18 · 周六…").
New content does not need those lines at all.

The calendar schedule (`scripts/data/event-calendar-schedule.ts`) applies an entry's `fix.occurrenceDates` last, and a
corrected `fix.dateLabel` replaces the calendar note copied from the old label.

## English

Every Chinese string an entry adds needs an entry in `src/data/editorial-overlay-en.json` (registered last in
`scripts/english-sources.json`). zh-Hant is the runtime conversion. Do not re-translate a string another pack already covers.

## Checks

- `npx tsx --tsconfig tsconfig.app.json scripts/audit-editorial-content.ts 2026-10-16 --strict` — the content.md §4.4 lints. Items
  with an entry get errors; items without one only warnings, so new catalog content is never blocked (RC-29).
- `tests/editorial-overlay.test.ts` runs the same lint in CI. A displayed date label must translate whole or part by part
  at its " · " separators, as `translateText` does.
- After editing entries, run the audit with `--write-basis` so `basis.json` records the source fields each entry was written
  against. When a source field later changes under an entry, the audit warns `source-changed`: re-check that entry.

## For content PRs (GPT)

New events, offers and openings may ship without an entry; cards derive a short title from the title. Please do not add the filler
sentence or plan lines that repeat the date or cost label, avoid editor's-log wording in reader fields (本次/本条/本卡/本轮…), and
never write 免费 in a title unless `cost` is `free` or `mixed`.
