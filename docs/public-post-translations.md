# Public post reading translations

English readers automatically receive English versions of Chinese user-post titles,
descriptions, budgets and scheduling text in feed cards and post details. A small
“Automatically translated” label offers “Show original”; the author's stored post,
edit form, sharing payload, account name and contact fields retain their originals.
The detail-page browser title follows the displayed version. Chinese readers keep
the author's original text. Comments, private messages, images and social crawler
previews are outside this feature.

Cards begin requests when they approach the viewport. The client shares requests
between cards and details, limits concurrency to three and keeps at most 128 entries
in memory. Keys include the reading session and all four source fields. Responses
must match those source fields before display, so an edit cannot inherit an older
translation. Automatic failures back off for 30 seconds; an explicit retry can try
again, subject to server limits. Failed translations leave the original readable.

`POST /api/posts/:id/translation` accepts `{ "target": "en" }`. The backend loads
the public source fields itself, checks visibility and blocks before and after
generation, and keeps a persistent content-hash cache. Deploy the backend endpoint
before the frontend. It reuses the existing OpenAI credentials; model, concurrency
and daily-generation settings are documented in the backend README and environment
example. No secret or arbitrary input text is sent by the browser.

Tests: `post-translation.test.tsx` covers the client queue, cache, source validation,
locale/session changes and edit races. `post-translation-ui.test.tsx` covers visible
cards, original/translation controls, original edit/share payloads, detail metadata
and failure recovery. Backend route tests cover visibility, source changes, quotas,
provider format validation and cache invalidation.
