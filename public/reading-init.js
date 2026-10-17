/* BAYLINK reading-init: runs before the first paint. ES5, blocking in <head> (CSP: no inline script).
 * D17: a saved 繁體 / English choice opens a neutral URL in that language (replace to /zh-Hant/… or /en/…, query and hash
 * kept, the page hidden meanwhile so 简体 never flashes). Never for /opus-bay and /play (the 3D world reads its own ?lang),
 * the email token pages, files, a language-prefixed URL or one that names ?lang= (both are explicit choices).
 * D5: the saved Aa size + 简洁显示; the 3D world keeps its own sizes.
 * CW-02: a page prerendered for another Pacific day (<html data-built-for>) is marked data-date-stale="day[ weekend]", so its
 * date blocks show a skeleton until the app renders today's result (src/lib/date-guard.ts states the same rule). week():
 * the 本周末 a day shows, Monday–Friday the coming Saturday's, Saturday and Sunday their own (the list drops past days).
 * Today's Pacific day follows the US rule (since 2007: PDT from the second Sunday of March 10:00 UTC to the first Sunday of
 * November 09:00 UTC), not Intl with a time zone: its first use in a page costs ~95 ms at 4x CPU before the first paint,
 * this rule ~1 ms (lanes/WEB-FRESH2/reading-init-cost*.json). tests/date-guard.test.tsx checks it against Intl for 2026-2035.
 * G52: a family link (?reading=…&simple=…) leaves the address bar at once (replaceState, before the router reads the URL)
 * and is handed to the app for this tab as sessionStorage 'baylink.reading-link.v1' = "size|simple"; the app keeps it
 * for this visit only when the reader already has a saved choice, else saves it (src/lib/reading-preferences.ts). A reload
 * in the same tab reads the handed-over link before the saved choice.
 * H20 (WEB-PERF-3): a guest's saved plan for today or later in this browser (the days 已排的日子 lists: plan-stop-cover.ts
 * upcomingPlans) marks <html data-plans>, so 行程's prerendered 已排的日子 shows a loading block instead of its empty state
 * until the app lists the days; a link that opens a plan (?edit=, ?stops=, ?places=, ?baybayDraft=: plan-catalog.ts
 * opensPlan) marks <html data-plan-link>, so the prerendered page never shows this weekend's picks above it
 * (src/styles/plan-page.css; key and format: src/lib/planner-storage-key.ts, planner-library.ts).
 * Keys and URL parameters match src/i18n/locale.ts (LOCALE_KEY) and src/lib/reading-preferences.ts. */
(function (d, w) {
  var root = d.documentElement, loc = w.location, path = loc.pathname, query = loc.search, key = 'baylink.reading-link.v1', link = [], lang, size, simple, built, today, y;
  if (/^\/(?:en\/|zh-Hant\/)?(?:opus-bay|play)(?:[/.]|$)/.test(path)) return;
  function saved(key) { try { return w.localStorage.getItem(key); } catch (e) { return null; } }
  lang = saved('baylink.reading-language.v1');
  if ((lang === 'en' || lang === 'zh-Hant') && !/^\/(?:en|zh-Hant)(?:\/|$)|^\/(?:verify-email|notifications\/unsubscribe)\/?$|\.\w+$/.test(path) && !/[?&]lang=/.test(query)) {
    try { loc.replace('/' + lang + path + query + loc.hash); root.style.visibility = 'hidden'; return; } catch (e) { /* stay on this page */ }
  }
  size = /[?&]reading=(large|extra-large)(?:&|#|$)/.exec(query);
  simple = /[?&]simple=([01])(?:&|#|$)/.exec(query);
  try {
    if (size || simple) {
      w.sessionStorage.setItem(key, (size ? size[1] : '') + '|' + (simple ? simple[1] : ''));
      query = query.slice(1).replace(/(^|&)(?:reading|simple)=[^&]*/g, '').replace(/^&/, '');
      w.history.replaceState(w.history.state, '', path + (query ? '?' + query : '') + loc.hash);
    } else link = (w.sessionStorage.getItem(key) || '').split('|');
  } catch (e) { /* the link still applies to this page */ }
  size = size ? size[1] : link[0] || saved('baylink.reading-size.v1');
  if (size === 'large' || size === 'extra-large') root.setAttribute('data-reading', size);
  simple = simple ? simple[1] : link[1] || saved('baylink.simple-display.v1');
  if (simple === '1') root.setAttribute('data-simple', '');
  if (/[?&](edit|stops|places|baybayDraft)\b/.test(loc.search)) root.setAttribute('data-plan-link', '');
  /* Days count from 1970-01-01, a Thursday. week(): the coming Saturday's number Monday to Friday, its own on the weekend.
     sunday(): the first Sunday on or after day n of month m, at h:00 UTC, in ms. today: hours, then the Pacific day number.
     A stored plan's "date" (after "plans":[) on or after today marks data-plans. */
  function week(n) { return n + ((n + 4) % 7 % 6 && 6 - (n + 4) % 7); }
  function sunday(m, n, h) { var t = Date.UTC(y, m, n, h); return t + (7 - (t / 864e5 + 4 | 0) % 7) % 7 * 864e5; }
  try {
    built = Date.parse(root.getAttribute('data-built-for') + 'T00:00Z') / 864e5; y = new Date(today = Date.now()).getUTCFullYear();
    today = (today / 36e5 - (today >= sunday(2, 8, 10) && today < sunday(10, 1, 9) ? 7 : 8)) / 24 | 0;
    if (built % 1 === 0 && built - today) root.setAttribute('data-date-stale', week(built) === week(today) ? 'day' : 'day weekend');
    (/"plans":\[\{.*/.exec(saved('baylink.planner.guest.v1')) || [''])[0].replace(/"date":"([\d-]{10})"/g, function (m, day) { if (Date.parse(day + 'T00:00Z') / 864e5 >= today) root.setAttribute('data-plans', ''); });
  } catch (e) { /* no date support: the page stays as built */ }
})(document, window);
