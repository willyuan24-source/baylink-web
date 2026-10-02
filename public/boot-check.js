/*
 * BAYLINK boot check (W9-E; review 2026-10-01 R§5 #2, suggestion 3). A classic, ES5-only script that index.html loads
 * with 'defer' before the site's module, so it runs first on every engine, old ones included (the CSP allows 'self').
 * When this browser cannot run the site's script — no ES modules, a syntax or regex it cannot parse (the look-behind that
 * stopped iOS 15 / 16.0–16.3 until W9-E1), or the bundle failed to load — the page would sit on its prerendered HTML,
 * where nothing reacts and nothing says why. This shows one plain line instead (an old browser, or a load that did not
 * finish), with a link to the guides (static pages that read without script). On a browser that runs the site it does nothing: App.tsx marks <html data-app="ready"> on its
 * first render, after which no error shows the line (and an early one is taken away).
 */
(function () {
  var doc = document, root = doc.documentElement, shown = null;
  function ready() { return root.getAttribute('data-app') === 'ready'; }
  function text(tag, cls, value) { var el = doc.createElement(tag); if (cls) el.className = cls; if (value) el.appendChild(doc.createTextNode(value)); return el; }
  // why: 'old' (no modules, a syntax this engine cannot parse) or 'load' (the module did not arrive: a network problem)
  function show(why) {
    if (shown || ready() || !doc.body) return;
    var old = why !== 'load';
    var box = text('div', 'baylink-oldbrowser');
    box.setAttribute('role', 'alert');
    box.setAttribute('translate', 'no');
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;max-width:560px;margin:0 auto;padding:16px 18px;border-radius:16px;background:#fffaf1;color:#22322f;border:1px solid #d9cab2;box-shadow:0 12px 32px rgba(74,52,22,.25);font:15px/1.6 -apple-system,system-ui,"PingFang SC","Microsoft YaHei",sans-serif;text-align:left';
    box.appendChild(text('p', '', old ? '这台设备的浏览器版本较旧，BAYLINK 的互动功能打不开。生活攻略可以直接看；把系统和微信更新到最新版后再试。' : '页面没能加载完，网络可能不稳定。刷新一下试试，或者先看生活攻略。'));
    var en = text('p', '', old ? 'This browser is too old for BAYLINK’s interactive pages. The guides still work; update the system or the app and try again.' : 'The page did not finish loading; the connection may be unstable. Reload, or read the guides.');
    en.setAttribute('lang', 'en');
    en.style.cssText = 'margin-top:6px;color:#4d5d58;font-size:14px';
    box.appendChild(en);
    var a = text('a', '', '打开生活攻略 · Open the guides →');
    a.href = '/guides';
    a.style.cssText = 'display:inline-block;margin-top:10px;min-height:44px;line-height:44px;font-weight:700;color:#1f6f69';
    box.appendChild(a);
    doc.body.appendChild(box);
    shown = box;
    // /opus-bay's static first paint says 准备中… — say the same thing there
    var wait = doc.querySelector('#opus-bay-shell .obs-wait-text');
    if (wait) wait.textContent = old ? '这台设备打不开游戏 · This device cannot run the game' : '没能加载完 · Did not finish loading';
  }
  function hideIfReady() { if (shown && ready() && shown.parentNode) { shown.parentNode.removeChild(shown); shown = null; } }
  // 1. no ES modules at all (iOS < 11 and other old engines): the site's script never runs
  if (!('noModule' in doc.createElement('script'))) { if (doc.body) show('old'); else doc.addEventListener('DOMContentLoaded', function () { show('old'); }); return; }
  // 2. the site's module could not be parsed (SyntaxError) or loaded (a script element's error) before the app started
  window.addEventListener('error', function (e) {
    if (ready()) return;
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT' && t.getAttribute('type') === 'module') { show('load'); return; }
    var err = e && e.error, msg = String((e && e.message) || '');
    if ((err && err.name === 'SyntaxError') || /SyntaxError|Invalid regular expression/.test(msg)) show('old');
  }, true);
  if (window.MutationObserver) new MutationObserver(hideIfReady).observe(root, { attributes: true, attributeFilter: ['data-app'] });
})();
