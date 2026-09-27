import fs from 'node:fs';
const here = f => new URL(f, import.meta.url);
const helpers = fs.readFileSync(here('./perf-helpers.js'), 'utf8');
const spots = {
  'ferry-gate':  [null, null, 60, 120],
  chinatown:     [86.3, 178.1, 81.9, 174.7],
  'twin-peaks':  [128.9, 922.3, 125, 500],
  'ocean-beach': [-478.1, 1416, -530, 1466],
  'ggb-south':   [-714.3, 602.4, -866, 508],
  mission:       [198.7, 641.9, 194.1, 647.4],
};
for (const [name, [x, z, fx, fz]] of Object.entries(spots)) {
  const go = x === null
    ? `(() => { const a = window.__opusBay.district.anchors['ferry-gate']; return window.__perf.go(a.x, a.z, ${fx}, ${fz}); })()`
    : `window.__perf.go(${x}, ${z}, ${fx}, ${fz})`;
  const measure = tag => [
    { do: 'eval', label: `${tag}-idle`, expr: 'window.__perf.frames(10000, false)' },
    { do: 'eval', label: `${tag}-walk`, expr: 'window.__perf.frames(10000, true)' },
  ];
  for (const vp of ['desktop', 'mobile']) {
    const acts = [
      { do: 'eval', label: 'helpers', expr: helpers },
      { do: 'eval', label: 'info', expr: 'window.__perf.info()' },
      { do: 'eval', label: 'go', expr: go }, { do: 'wait', ms: 20000 },
      { do: 'shot', name: `perf-${name}-${vp}.jpg` },
      ...measure('1x'),
      { do: 'eval', label: 'go-again', expr: go }, { do: 'wait', ms: 15000 },
      { do: 'throttle', rate: 4 }, { do: 'wait', ms: 5000 }, ...measure('4x'), { do: 'throttle', rate: 1 },
    ];
    fs.writeFileSync(here(`./perf-${name}-${vp}.json`), JSON.stringify(acts));
  }
}
// district re-measure (4.3): no teleport, the page's own ?at= spot
const dmeasure = [
  { do: 'eval', label: 'helpers', expr: helpers },
  { do: 'eval', label: 'info', expr: 'window.__perf.info()' },
  { do: 'shot', name: 'SHOT' },
  { do: 'eval', label: '1x-idle', expr: 'window.__perf.frames(10000, false)' },
  { do: 'throttle', rate: 4 }, { do: 'wait', ms: 5000 },
  { do: 'eval', label: '4x-idle', expr: 'window.__perf.frames(10000, false)' },
  { do: 'eval', label: '4x-walk', expr: 'window.__perf.frames(10000, true)' },
  { do: 'throttle', rate: 1 },
];
fs.writeFileSync(here('./district.json'), JSON.stringify(dmeasure));
// phone emulation: auto quality (PerformanceMonitor may lower it), 4x throttle the whole time, 3 x 10 s windows
const phone = (go) => [
  { do: 'eval', label: 'helpers', expr: helpers },
  { do: 'eval', label: 'info', expr: 'window.__perf.info()' },
  ...(go ? [{ do: 'eval', label: 'go', expr: go }] : []),
  { do: 'throttle', rate: 4 }, { do: 'wait', ms: 20000 },
  { do: 'shot', name: 'SHOT' },
  { do: 'eval', label: 'p-idle-a', expr: 'window.__perf.frames(10000, false)' },
  { do: 'eval', label: 'p-walk-a', expr: 'window.__perf.frames(10000, true)' },
  { do: 'wait', ms: 10000 },
  { do: 'eval', label: 'p-idle-b', expr: 'window.__perf.frames(10000, false)' },
  { do: 'eval', label: 'p-walk-b', expr: 'window.__perf.frames(10000, true)' },
  { do: 'throttle', rate: 1 },
];
fs.writeFileSync(here('./phone-ferry.json'), JSON.stringify(phone(null)));
fs.writeFileSync(here('./phone-twinpeaks.json'), JSON.stringify(phone('window.__perf.go(128.9, 922.3, 125, 500)')));
