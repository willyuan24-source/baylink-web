/* BAYLINK reading-init (D5): saved Aa size + 简洁显示 before first paint. ES5, blocking in <head> (CSP: no inline). Keys and
 * URL parameters match src/lib/reading-preferences.ts; the 3D world (/opus-bay, /play) keeps its own sizes. */
(function (d, w) {
  var root = d.documentElement, query = w.location.search, size, simple;
  if (/^\/(?:en\/|zh-Hant\/)?(?:opus-bay|play)(?:[/.]|$)/.test(w.location.pathname)) return;
  function saved(key) { try { return w.localStorage.getItem(key); } catch (e) { return null; } }
  size = /[?&]reading=(large|extra-large)(?:&|#|$)/.exec(query);
  size = size ? size[1] : saved('baylink.reading-size.v1');
  if (size === 'large' || size === 'extra-large') root.setAttribute('data-reading', size);
  simple = /[?&]simple=([01])(?:&|#|$)/.exec(query);
  simple = simple ? simple[1] : saved('baylink.simple-display.v1');
  if (simple === '1') root.setAttribute('data-simple', '');
})(document, window);
