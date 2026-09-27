# Opus Bay — San Francisco data v1

Built 2026-09-26T11:46:26.981Z by `scripts/opus-sf/build.ts` from snapshots in `opus-qa/sf-data` (OSM base 2026-09-26T10:09:51Z).

## Sources and licences

- **OpenStreetMap** — buildings, streets, steps, rail, landcover, coastline, county boundary (relation 111968), POIs.
  © OpenStreetMap contributors, licensed under the Open Database License 1.0 (https://www.openstreetmap.org/copyright).
  The chunk, far, graph, transit and places files are a *derived database* of OpenStreetMap and are therefore also
  available under the ODbL; show "© OpenStreetMap contributors" wherever the map or city is displayed.
- **DataSF** (City and County of San Francisco), Public Domain Dedication and License (PDDL):
  Building Footprints with 2010 LiDAR heights (ynuv-fyni) — fills OSM buildings without a height tag;
  Analysis Neighborhoods (j2bu-swwd) — the 41 zones; Street Tree List (tkzw-k3nq) — every 4th street tree.
- **Terrain**: AWS Open Data Terrain Tiles (Mapzen "terrarium", zoom 14), which include USGS 3DEP (public domain),
  NOAA ETOPO1 and GMRT bathymetry and SRTM. Attribution per https://github.com/tilezen/joerd/blob/master/docs/attribution.md.
- **landmarks.json** (opus-qa/sf-data) — positions from OSM; heights from published figures, OSM tags or DataSF LiDAR as noted per entry.
- Chinese neighbourhood names and transit line names are written for Opus Bay; POI Chinese names come from OSM `name:zh*` tags (converted to Simplified).

No GTA_SZ assets, models or data are used.
