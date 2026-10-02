import { OPUS_BAY_ART } from '../lib/opus-bay-metadata';

/**
 * W9-E · /opus-bay's first paint (review 2026-10-01 R§5 #3: the page used to paint the BAYLINK homepage for 1–5 s first).
 * scripts/prerender.tsx writes it into dist/opus-bay.html as static HTML, and App.tsx renders the very same markup while
 * the game's route chunk loads, so the page goes static shell → the same shell → the title screen, with nothing else in
 * between. It looks like the title screen (the key art, 湾区小旅 · Little Bay Trip) and says 准备中… until the game's own
 * title replaces it; the guides link works without any script. Bilingual and never translated (translate="no"): the
 * static HTML cannot know the visitor's language and the React copy must not differ from it. Inline styles only (a
 * <style> element: the CSP allows inline styles, not inline scripts), no web fonts needed, nothing animated under
 * prefers-reduced-motion. public/boot-check.js swaps the 准备中 line for an old-system notice when the site's script cannot run.
 */
export function OpusBayShell({ halloween }: { halloween: boolean }) {
  const art = halloween ? OPUS_BAY_ART.halloween : OPUS_BAY_ART.key;
  return (
    <div className="obs" id="opus-bay-shell" translate="no" aria-busy="true">
      <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />
      <picture className="obs-art">
        <source media="(max-aspect-ratio: 4/5)" srcSet={art.tallSrcSet} sizes="100vw" />
        <img src={art.wide} srcSet={art.wideSrcSet} sizes="100vw" alt="" draggable={false} />
      </picture>
      <div className="obs-card">
        <span className="obs-mark">小小湾区 · BAYLINK</span>
        <h1 className="obs-h1">湾区小旅</h1>
        <p className="obs-en" lang="en">Little Bay Trip</p>
        <p className="obs-wait" role="status"><span className="obs-dot" aria-hidden="true" /><span className="obs-wait-text">准备中… <span lang="en">Loading…</span></span></p>
        <a className="obs-link" href="/guides">先不玩，直接看攻略 <span lang="en">· Read the guides</span> →</a>
      </div>
    </div>
  );
}

// The title screen's own layout (src/opus-bay/opus-bay.css .ob-title.has-art: the same card column and art box formulas,
// the same portrait-phone rule), without its safe-area variables and animations: desktop = the card on the left and the
// wide art on the right; a portrait phone = the tall art full-bleed, the card docked at the bottom.
const SHELL_CSS = `
.obs{--card-x:max(5.5vw,28px);--card-w:clamp(340px,28vw,430px);--card-r:calc(var(--card-x) + var(--card-w));--art-avail:calc(100vw - var(--card-r) - 56px);--art-w:min(calc(var(--art-avail) / .62),calc(100vh * 1.72));--art-x:calc(var(--card-r) + 32px + (var(--art-avail) - var(--art-w) * .62) / 2 - var(--art-w) * .19);position:fixed;inset:0;z-index:1;overflow:hidden;display:flex;align-items:center;box-sizing:border-box;padding-bottom:3vh;background:linear-gradient(180deg,#ead3b9 0%,#eed8c1 48%,#f0d9c3 100%);color:#22322f;font-family:'Plus Jakarta Sans','Noto Sans SC',system-ui,-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;-webkit-font-smoothing:antialiased;text-align:left}
.obs-art{position:absolute;left:var(--art-x);bottom:0;width:var(--art-w);aspect-ratio:16/9;pointer-events:none}
.obs-art img{display:block;width:100%;height:100%;object-fit:cover;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 21%),linear-gradient(180deg,transparent 0%,#000 18%);-webkit-mask-composite:source-in;mask-image:linear-gradient(90deg,transparent 0%,#000 21%),linear-gradient(180deg,transparent 0%,#000 18%);mask-composite:intersect}
.obs-card{position:relative;z-index:1;margin-left:var(--card-x);width:var(--card-w);padding:20px 0;display:flex;flex-direction:column;gap:16px}
.obs-mark{font-size:12.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#2f8f88}
.obs-h1{margin:0;font-size:clamp(50px,5.2vw,80px);line-height:1;font-weight:900;letter-spacing:.04em;font-family:'Noto Sans SC',system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif}
.obs-h1:after{content:'';display:block;width:84px;height:8px;margin-top:16px;border-radius:8px;background:linear-gradient(90deg,#2f8f88,#e0a94a)}
.obs-en{margin:0;font-size:18px;font-weight:700;letter-spacing:.02em;color:#4d5d58}
.obs-wait{margin:4px 0 0;display:inline-flex;align-items:center;justify-content:center;gap:12px;width:fit-content;min-width:180px;min-height:56px;box-sizing:border-box;padding:0 28px;border-radius:999px;background:#2f8f88;color:#fff;font-size:17px;font-weight:800;box-shadow:0 10px 24px -10px rgba(31,111,105,.55);opacity:.88}
.obs-dot{flex:none;width:10px;height:10px;border-radius:50%;background:currentColor;animation:obs-pulse .9s ease-in-out infinite alternate}
.obs-link{display:inline-flex;align-items:center;gap:6px;width:fit-content;min-height:44px;font-size:15px;font-weight:700;color:#1f6f69;text-decoration:none;border-bottom:1px dashed rgba(31,111,105,.4)}
@keyframes obs-pulse{from{opacity:.35;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.obs-dot{animation:none}}
@media (max-width:820px) and (max-aspect-ratio:5/4){
.obs{display:grid;align-items:end;justify-items:center;padding-bottom:0;background:#f2dcc2}
.obs-art{inset:0;width:auto;aspect-ratio:auto}
.obs-art img{object-position:50% 30%;-webkit-mask-image:none;mask-image:none}
.obs:after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(0deg,rgba(243,236,223,.9) 0%,rgba(243,236,223,.15) 45%,transparent 60%)}
.obs-card{width:100%;max-width:600px;margin:0;box-sizing:border-box;gap:12px;padding:22px 22px calc(20px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(255,250,241,.84),#fffaf1 34%);border-radius:28px 28px 0 0;box-shadow:0 -18px 40px -24px rgba(74,52,22,.3);border-top:1px solid #e7dccb}
.obs-h1{font-size:clamp(36px,11vw,48px)}
.obs-h1:after{margin-top:8px;height:6px;width:64px}
.obs-wait{width:100%}
}
`.trim();
