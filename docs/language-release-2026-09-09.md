# Reading languages — September 9, 2026

BAYLINK now offers Simplified Chinese, Traditional Chinese and English through the shared top bar. The preference is saved locally. Links carrying `?lang=en` or `?lang=zh-Hant` select that reading language; guide sharing includes it. Existing route slugs, saved-guide identifiers, API category values and USD calculations are unchanged.

## Content and rendering

The English catalog contains the full text of all 39 published guides, monthly events, freebie conditions, image captions and application copy. Translations are static assets loaded on selection; no visitor content is submitted to a translation service. Traditional Chinese uses OpenCC's `cn` → `tw` phrase-aware conversion locally, including dynamically returned site text.

`src/i18n/host.ts` is a React JSX adapter for native elements and explicitly registered Link/NavLink text sinks. It translates visible text and accessibility attributes before React renders them. It does not modify the DOM behind React, change component identities based on their text, or translate input values, option values, URLs or business enums. Routes, Fragments, application components and render functions retain their original behavior. `translate="no"` protects user-authored posts, chat, profiles and custom tasks. Original artwork stays in its original language.

The Vite JSX runtime aliases are excluded from dependency optimization to keep a single language store. The React plugin uses its normal dependency includes while esbuild selects the local JSX runtime. Do not prebundle the local runtime as a separate dependency: that would duplicate the store.

## Search, copies and AI

Guide search indexes original and translated passages and normalizes Traditional Chinese. Monthly searches also include translated fields. Shared article links retain the selected reading language. Guide templates, calendar reminders, loan/rent summaries and the moving checklist export the current language; custom checklist text stays verbatim.

BayBay accepts an optional validated locale and uses a corresponding static guide catalog for English references. Its original grounding and bounded-history rules still apply. Explicit output-language instructions in the communication tool take precedence for the drafted message. The assistant does not gain live web browsing from this release.

## Maintaining translations

English entries in `src/i18n/en.json` use normalized original text as keys; dynamic phrases use `en-patterns.json`. New or changed editorial text must be translated before release. The localization tests check every Chinese string in the 39-guide dataset for coverage. Preserve eligibility qualifiers, dollar amounts, dates, URLs and place names. Do not translate canonical category values or identifiers in data objects used by business logic.

`npm run export:guides` emits both public guide catalogs. To sync the backend, run `npx tsx --tsconfig tsconfig.app.json scripts/export-guide-catalog.ts ../baylink-backend/data/guide-catalog.json`; it also writes the sibling `.en.json`. Do not expose credentials or user data in either catalog.

## Scope of language URLs

These are reading-language preferences on the existing URLs. Canonical URLs and pre-rendered crawlable pages remain the original edition; this release does not claim separate indexed English/Traditional editions or translated text inside promotional images. English and Traditional content are fully available after the application loads. A future independent-language SEO release should add dedicated routes, alternate links and per-locale pre-rendering together.

## Verification

Language tests cover preserved drafts, focus, refs, canonical option values, router identity, original user content, translated full-guide search, metadata, shared URLs, and exported financial/checklist values. Existing site and backend checks remain required, along with mobile and desktop browser checks in both added languages.
