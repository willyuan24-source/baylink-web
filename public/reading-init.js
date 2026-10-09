/* BAYLINK reading-init: runs before the first paint. ES5, blocking in <head> (CSP: no inline script).
 * D17: a saved 繁體 / English choice opens a neutral URL in that language (replace to /zh-Hant/… or /en/…, query and hash
 * kept, the page hidden meanwhile so 简体 never flashes). Never for /opus-bay and /play (the 3D world reads its own ?lang),
 * the email token pages, files, a language-prefixed URL or one that names ?lang= (both are explicit choices).
 * D5: the saved Aa size + 简洁显示; the 3D world keeps its own sizes.
 * Keys and URL parameters match src/i18n/locale.ts (LOCALE_KEY) and src/lib/reading-preferences.ts. */
(function (d, w) {
  var root = d.documentElement, loc = w.location, path = loc.pathname, query = loc.search, lang, size, simple;
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
})(document, window);
