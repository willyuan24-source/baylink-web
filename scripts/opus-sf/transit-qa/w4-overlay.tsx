// Wave 4 · lane T: dev-only QA harness for the subway overlay (served by the vite dev server at
// /scripts/opus-sf/transit-qa/w4-overlay.html). ?line=n-judah|m-ocean-view &at=<arc> &dir=1|-1 &stopped=<station> &en=1
import { createRoot } from 'react-dom/client';
import { TUNNELS, W4_LINES } from '../../../src/opus-bay/data/sf/stationNames';
import type { TransitFile } from '../../../src/opus-bay/world/sf/format';
import { SubwayOverlay } from '../../../src/opus-bay/ui/SubwayOverlay';

const q = new URLSearchParams(location.search);
const lineId = (q.get('line') ?? 'n-judah') as 'n-judah' | 'm-ocean-view';
const file = (await (await fetch('/opus-bay/sf/v1/transit-w4.json')).json()) as TransitFile;
const line = file.lines.find(l => l.id === lineId)!;
const at = Number(q.get('at') ?? '250');
const dir = (Number(q.get('dir') ?? '1') > 0 ? 1 : -1) as 1 | -1;
const tun = line.tunnels!.find(t => at >= t.fromAt && at <= t.toAt) ?? line.tunnels![0];
const stations = line.stops.filter(s => s.at >= tun.fromAt - 1 && s.at <= tun.toAt + 1).map(s => ({ id: s.id, name: s.name, at: s.at }));
const stopped = q.get('stopped');
const ahead = stations.filter(s => (s.at - at) * dir > 0.5).sort((a, b) => (a.at - b.at) * dir)[0];
const key = lineId === 'm-ocean-view' && at > 661 ? 'twin-peaks-tunnel' : tun.name?.en === 'Sunset Tunnel' ? 'sunset-tunnel' : 'market-street-subway';
const dest = dir > 0 ? line.stops[line.stops.length - 1] : line.stops[0];
const meta = W4_LINES[lineId];
createRoot(document.getElementById('root')!).render(
  <SubwayOverlay
    visible moving={!stopped} line={{ short: meta.short, name: meta.name, color: meta.color }} destination={dest.name}
    tunnel={{ fromAt: tun.fromAt, toAt: tun.toAt, name: TUNNELS[key].name, fact: TUNNELS[key].fact, portalA: tun.portalA?.name ?? null, portalB: tun.portalB?.name ?? null }}
    stations={stations} at={at} dir={dir} stopped={stopped} next={ahead ? { id: ahead.id, name: ahead.name, eta: Math.abs(ahead.at - at) / 25 + 1 } : null}
    portalWait={q.get('portal') === '1'} onAlight={() => {}}
  />,
);
