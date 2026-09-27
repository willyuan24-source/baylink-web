# Opus Bay — satellite boards (Marin, East Bay)

Built 2026-09-27T12:32:07.354Z by `scripts/opus-sf/boards.ts` (lane C2-7a). Files: `boards.json` (index, freeways, the Bay
Bridge east span), `marin.obb` (4 u), `eastbay.obb` (8 u); format in `src/opus-bay/world/sf/boardData.ts`.

## Sources and licences

- **Terrain**: AWS Open Data Terrain Tiles (Mapzen "terrarium", zoom 13), which include USGS 3DEP / NED (public domain),
  NOAA ETOPO1 / CUDEM and GMRT bathymetry and SRTM. Attribution per https://github.com/tilezen/joerd/blob/master/docs/attribution.md.
- **OpenStreetMap** (the backdrop snapshot 2026-09-26T09:55:36Z and a motorway / trunk query of 2026-09-27): the coastline that sharpens the shores, the freeways
  drawn on the boards and the alignment of the Bay Bridge east span. © OpenStreetMap contributors, Open Database
  License 1.0 (https://www.openstreetmap.org/copyright); these files are a derived database and also ODbL.
- The toy-town dressing (Sausalito houses, Oakland towers, the port cranes, the Berkeley flats, trees) is procedural,
  placed at the runtime from the terrain and a few hand-picked real positions (`src/opus-bay/world/sf/boards.ts`).
