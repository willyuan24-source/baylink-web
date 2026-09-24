# Automatic reading language

First visits previously defaulted to Simplified Chinese because initialization never inspected browser language preferences. It now chooses from the browser's ordered `navigator.languages` list, falling back to `navigator.language` when that list is empty.

Priority is unchanged for existing choices: valid `?lang=en|zh-Hans|zh-Hant`, then a saved reading language, then the first supported browser language. English regional variants use English. Chinese explicit Hans/Hant script tags take priority over region; TW/HK/MO use Traditional Chinese, other Chinese tags use Simplified Chinese. Visitors without a supported preference receive English.

Automatic choices are not saved or appended to ordinary URLs, so a shared homepage adapts to its recipient. Existing explicit-link and manual-choice persistence remains compatible. Restricted storage, invalid preference values and malformed language tags are handled by fallback selection. User-written posts and names remain in their original language.

The app already waits for its selected language dictionary before its first React render. The static HTML and social-preview images remain Chinese; a slow initial script download can still expose the static prerender before the translated app appears. This change does not claim server-side language negotiation or translated social cards.

Validation: 20 language detection, localization and locale UI tests passed. Production build completed with 262 prerendered pages. ESLint: zero errors, 46 existing warnings. Browser check confirmed the English homepage and that opening a plain homepage URL retains an explicitly saved English choice.

Browser API reference: [MDN navigator.languages](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages).
