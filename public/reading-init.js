/* BAYLINK reading-init: runs before the first paint. ES5, blocking in <head> (CSP: no inline script).
 * D17: a saved 繁體 / English choice opens a neutral URL in that language (replace to /zh-Hant/… or /en/…, query and hash
 * kept, the page hidden meanwhile so 简体 never flashes). Never for /opus-bay and /play (the 3D world reads its own ?lang),
 * the email token pages, files, a language-prefixed URL or one that names ?lang= (both are explicit choices).
 * D5: the saved Aa size + 简洁显示; the 3D world keeps its own sizes.
 * CW-02: a page prerendered for another Pacific day (<html data-built-for>) is marked data-date-stale="day[ weekend]", so its
 * date blocks show a skeleton until the app renders today's result (src/lib/date-guard.ts states the same rule). week():
 * the 本周末 a day shows, Monday–Friday the coming Saturday's, Saturday and Sunday their own (the list drops past days).
 * Keys and URL parameters match src/i18n/locale.ts (LOCALE_KEY) and src/lib/reading-preferences.ts. */
(function (d, w) {
  var root = d.documentElement, loc = w.location, path = loc.pathname, query = loc.search, lang, size, simple, built, today;
  if (/^\/(?:en\/|zh-Hant\/)?(?:opus-bay|play)(?:[/.]|$)/.test(path)) return;
  function saved(key) { try { return w.localStorage.getItem(key); } catch (e) { return null; } }
  lang = saved('baylink.reading-language.v1');
  if ((lang === 'en' || lang === 'zh-Hant') && !/^\/(?:en|zh-Hant)(?:\/|$)|^\/(?:verify-email|notifications\/unsubscribe)\/?$|\.\w+$/.test(path) && !/[?&]lang=/.test(query)) {
    try { loc.replace('/' + lang + path + query + loc.hash); root.style.visibility = 'hidden'; return; } catch (e) { /* stay on this page */ }
  }
  size = /[?&]reading=(large|extra-large)(?:&|#|$)/.exec(query);
  size = size ? size[1] : saved('baylink.reading-size.v1');
  if (size === 'large' || size === 'extra-large') root.setAttribute('data-reading', size);
  simple = /[?&]simple=([01])(?:&|#|$)/.exec(query);
  simple = simple ? simple[1] : saved('baylink.simple-display.v1');
  if (simple === '1') root.setAttribute('data-simple', '');
  function week(day) { var x = new Date(day + 'T12:00:00Z'), n = x.getUTCDay(); x.setUTCDate(x.getUTCDate() + (n % 6 && 6 - n)); return x.toISOString().slice(0, 10); }
  try {
    built = root.getAttribute('data-built-for');
    today = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    today = today.slice(6, 10) + '-' + today.slice(0, 2) + '-' + today.slice(3, 5);
    if (/^(\d{4}-\d\d-\d\d){2}$/.test(built + today) && built !== today) root.setAttribute('data-date-stale', week(built) === week(today) ? 'day' : 'day weekend');
  } catch (e) { /* no time-zone support: the page stays as built */ }
})(document, window);
