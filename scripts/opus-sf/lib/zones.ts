// The 41 DataSF Analysis Neighborhoods (PDDL) as zones: city-frame rings, a 4 u lookup raster, bilingual names.
import fs from 'node:fs';
import path from 'node:path';
import { type Ring, simplifyRing, ringArea } from './geom';
import { RAW } from './io';
import { Grid, fillRings } from './raster';
import { DOMAIN, projGeom } from './world';

/** zh-Hans names (common Chinese-community usage; the en name is the DataSF `nhood`). */
const ZH: Record<string, string> = {
  'Bayview Hunters Point': '湾景-猎人角', 'Bernal Heights': '伯纳尔高地', 'Castro/Upper Market': '卡斯特罗', Chinatown: '唐人街',
  Excelsior: '精益区', 'Financial District/South Beach': '金融区 · 南滩', 'Glen Park': '格伦公园', 'Golden Gate Park': '金门公园',
  'Haight Ashbury': '海特-阿什伯里', 'Hayes Valley': '海斯谷', 'Inner Richmond': '内列治文', 'Inner Sunset': '内日落区',
  Japantown: '日本城', Lakeshore: '湖岸区', 'Lincoln Park': '林肯公园', 'Lone Mountain/USF': '孤山 · 旧金山大学', Marina: '马里纳区',
  'McLaren Park': '麦克拉伦公园', Mission: '教会区', 'Mission Bay': '米慎湾', 'Nob Hill': '诺布山', 'Noe Valley': '诺伊谷',
  'North Beach': '北滩', 'Oceanview/Merced/Ingleside': '海景 · 默塞德 · 英格尔赛德', 'Outer Mission': '外教会区', 'Outer Richmond': '外列治文',
  'Pacific Heights': '太平洋高地', Portola: '波托拉', 'Potrero Hill': '波特雷罗山', Presidio: '要塞公园', 'Presidio Heights': '要塞高地',
  'Russian Hill': '俄罗斯山', Seacliff: '海崖区', 'South of Market': '南市场', 'Sunset/Parkside': '日落区 · 帕克赛德', Tenderloin: '田德隆',
  'Treasure Island': '金银岛', 'Twin Peaks': '双峰', 'Visitacion Valley': '维西塔西翁谷', 'West of Twin Peaks': '双峰西', 'Western Addition': '西增区',
};

export interface Zone { id: string; en: string; zh: string; rings: { hole: boolean; xz: Ring }[] }
export interface Zones { list: Zone[]; grid: Grid<Uint8Array> }

export const zoneId = (nhood: string) => nhood.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function loadZones(log: (s: string) => void): Zones {
  const gj = JSON.parse(fs.readFileSync(path.join(RAW, 'datasf-neighborhoods-j2bu-swwd.geojson'), 'utf8')) as {
    features: { properties: { nhood: string }; geometry: { type: string; coordinates: number[][][][] | number[][][] } }[];
  };
  const list: Zone[] = [];
  for (const f of gj.features) {
    const en = f.properties.nhood;
    const polys = (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]) as number[][][][];
    const rings: Zone['rings'] = [];
    for (const poly of polys) poly.forEach((ring, k) => {
      const xz = projGeom(ring.slice(0, -1).map(([lon, lat]) => ({ lat, lon })));
      if (ringArea(xz) > 1) rings.push({ hole: k > 0, xz });
    });
    if (!ZH[en]) throw new Error(`no zh name for neighbourhood ${en}`);
    list.push({ id: zoneId(en), en, zh: ZH[en], rings });
  }
  list.sort((a, b) => a.id.localeCompare(b.id));
  const cell = 4;
  const grid = Grid.u8(DOMAIN.x0, DOMAIN.z0, cell, (DOMAIN.x1 - DOMAIN.x0) / cell, (DOMAIN.z1 - DOMAIN.z0) / cell);
  list.forEach((z, i) => fillRings(grid, z.rings.map(r => r.xz), idx => { grid.data[idx] = i + 1; }));
  log(`zones: ${list.length} neighbourhoods`);
  return { list, grid };
}

/** Zone index (0-based) at a point, −1 if none. */
export const zoneIndexAt = (z: Zones, x: number, zz: number) => z.grid.at(x, zz) - 1;

export function simplifiedZoneRings(z: Zone, tol: number) {
  return z.rings.map(r => ({ hole: r.hole, xz: simplifyRing(r.xz, tol) })).filter(r => r.xz.length >= 6);
}
