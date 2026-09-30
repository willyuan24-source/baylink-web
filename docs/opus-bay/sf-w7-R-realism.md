# Wave 7 · lane R · realism scorecard (do the famous places look like the real ones?)

Written 2026-09-29 ≈ 21:00 PDT by lane R (`C:/Users/willy/wt/w7-r`, tree `76de8820` + origin at 21:00), updated as fixes
land. **For lane V**: the last column says whether a generated model (Higgsfield → GLB through the wave-4 swap gate)
would help more than code; the "owner" column says who may touch the site this wave (R fixes only rows marked **R**).

## How it was scored

- **In-game**: `C:/Users/willy/opus-qa/w7/r/shots.mjs` (one headless Chrome, `?world=city&time=day&quality=high`,
  1440 × 900, HUD hidden) puts a camera at each site's own photo pose (`SF_LANDMARK_INFO.photo` / `w4.photo`) and at a
  player's eye 6 u behind its arrival spot, or at a hand-set view for the district landmarks; 62 JPEGs in
  `C:/Users/willy/opus-qa/w7/r/shots/a/` (a few key ones in `docs/opus-bay/qa/w7/R/`).
- **Reference**: the lead photo of each Wikipedia article (or a Commons search), 640 px thumbnails downloaded to
  `C:/Users/willy/opus-qa/w7/r/ref/` (scratch only, never shipped); the Commons file pages are listed at the end. Where
  no usable photo came back (the zoo, PIER 39, Alcatraz) the row is scored from the documented features.
- **Scores /5**: **C** colour (the main surfaces' hue and value), **P** proportion (height : width, the parts' sizes to
  each other), **F** the one identifying feature a visitor would name. 5 = reads as the real place at a glance.
- Toy rules stand: no lettering or brands on models, vertical exaggeration H = 3.2 + 0.155·h (a tall thing is squat on
  purpose), 0.14 u/m in plan.

## Scorecard (by fame, attractions.ts)

| # | place (fame) | owner · model | C | P | F | what is off / what would make it more recognisable | generated model? |
|---|---|---|---|---|---|---|---|
| 1 | Golden Gate Bridge (100) | site T1, proc | 5 | 4 | 5 | International Orange, the two towers and the catenary read at once. More: the towers' stepped Art Deco portals and the fluted top struts | no |
| 2 | Alcatraz (95) | **W2** (building its T1 this wave) | 2 | 2 | 1 | today OSM boxes + the lighthouse; the long white cellhouse with barred window bands and the water tower on stilts are what everyone knows | W2 procedural first; a GLB of the cellhouse only if W2's shot loses |
| 3 | Fisherman's Wharf sign (90) · **fixed, now 4/4/5** | **R** · site T2 proc | 2 | 4 | 3 | the real wheel is **dark-brown wood with a cream band and cream face**, not blue, and it hangs on a bundle of **tall wooden pilings wrapped in rope** that rise above the wheel (a grey steel post here) → **R fixes (part a/b)** | no |
| 4 | Ferry Building (88) | district (frozen) | 5 | 4 | 5 | cream stone, the clock tower with four faces, the long arcade, the Bay Bridge behind: correct | no |
| 5 | Chinatown Dragon Gate (86) | **W1** | 4 | 4 | 4 | green-tiled roofs and the three portals are right; the dragons and fish on the ridges are small; the street behind is grey-blue boxes (lane X's facades) | no |
| 6 | Lombard St crooked block (85) | site T2 proc | 4 | 4 | 3 | red brick switchbacks between hedges ✔; the **hydrangeas** that make the postcard are tiny cubes — rounder, bigger blue / pink / purple clumps at the bends would sell it | no |
| 7 | Painted Ladies (84) | site T2 proc | 4 | 4 | 4 | pastel bodies, white trim, front gables, the stepped roofline and the downtown skyline behind from Alamo Square ✔. Real bodies are paler today (near-white with pastel accents) | no |
| 8 | Palace of Fine Arts (83) | site T1 · AI swap | 4 | 4 | 4 | ochre rotunda and dome on the lagoon ✔; the curved **peristyle reads as a solid wall** (the real one is open columns with the lagoon in front) | **yes** (V: a peristyle wing GLB, or regenerate) |
| 9 | Golden Gate Park (82) | park + sites | – | – | – | scored through its sites (Cal Academy, de Young, Tea Garden, Conservatory, windmills) | – |
| 10 | Coit Tower (80) | district (frozen) | 5 | 5 | 5 | the fluted white column with its arched lantern top on Telegraph Hill, Pioneer Park steps ✔ | no |
| 11 | Twin Peaks overlook (78) | site T1 proc | 4 | 4 | 4 | the terrace and the view down Market St to downtown ✔ (the view is the feature) | no |
| 12 | Union Square (77) | **W2** (to T2 this wave) | 3 | 3 | 2 | Dewey column ✔; the plaza is bare (terraces, palms, red café umbrellas, the heart sculpture missing) | W2 procedural |
| 13 | PIER 39 (74) | district gateway + sea lions | 4 | 4 | 4 | weathered-wood two-storey shops, the gate, the sea-lion floats ✔ | no |
| 14 | City Hall (72) · **fixed, now 5/4/5** | **R** · site T1 proc + AI mesh | 3 | 4 | 4 | the **dome is grey-green here; the real dome is dark lead-grey with gold-leaf ribs and a gold lantern** (the lantern is gold already) → **R fixes the dome colour** | no |
| 15 | Bay Bridge (70) | backdrop | 4 | 4 | 4 | grey west span with its suspension towers seen from the Ferry plaza ✔ | no |
| 16 | Cal Academy (70) | site · AI swap | 5 | 4 | 5 | the green living roof with the round skylights, the thin white canopy ✔ | no |
| 17 | Haight-Ashbury (70) | corner (W5-L) | 3 | 3 | 3 | a busker, a clock, some colour; the famous corner is **bright Victorians and murals**; the rest of Haight St is generic | maybe (a mural-house kit) |
| 18 | Sutro Baths ruins (68) | site T2 proc | 4 | 4 | 4 | concrete ruin walls, the pools, the cliff ✔ | no |
| 19 | SFMOMA (68) | site T2 proc | 4 | 4 | 4 | Botta's brick block with the black-and-white striped oculus ✔, Snøhetta's white ripples ✔; hard to see from the street (towers around it): the photo is from Yerba Buena Gardens | no |
| 20 | Powell & Market turntable (67) | site T2 proc | 5 | 4 | 5 | maroon-and-cream Powell car on the wooden turntable ✔ | no |
| 21 | SF State (66) | site proc | 3 | 3 | 3 | purple-and-gold gate ✔; the quad and the brutalist buildings are generic | maybe |
| 22 | de Young + Hamon Tower (66) | site T1 proc | 4 | 3 | 3 | copper-brown ✔; the tower's **twist** is subtle at this size and the real copper is darker (almost chocolate) and perforated | **yes** (V: a GLB tower would show the twist and perforation) |
| 23 | Ocean Beach (66) | site plaza | 4 | 3 | 3 | sand, logs, fire rings ✔; no surfers (lane X), the Great Highway seawall is plain | no |
| 24 | Transamerica Pyramid (66) | district (frozen) | 5 | 4 | 4 | white, slender, the two wings and the spire ✔ | no |
| 25 | Lands End (65) | site plaza | 3 | 3 | 3 | the Lookout building, cypress, the coast trail ✔; the famous view is the bridge from the cliff path — fine | no |
| 26 | Stonestown Galleria (64) | site proc | 3 | 3 | 3 | a big low mall ✔; generic | no |
| 27 | Japanese Tea Garden (64) | site proc | 4 | 3 | 4 | red five-storey pagoda, the drum bridge, the gate ✔ | no |
| 28 | Oracle Park (64) | site T2 proc | 4 | 4 | 4 | brick walls, green seats, the big glove, the Willie Mays gate clock tower ✔ | no |
| 29 | Ghirardelli Square (63) | site T2 proc | 4 | 4 | 4 | red brick, the clock tower with its dark roof, the rooftop sign frame (no letters) ✔ | no |
| 30 | Mission Dolores Park (62) | site plaza | 4 | 3 | 3 | palms on the Church St side, the downtown view ✔ | no |
| 31 | Exploratorium · Pier 15 (62) | district pier shed | 4 | 4 | 4 | cream shed with green trim ✔ | no |
| 32 | Salesforce Tower (62) | district (frozen) | 3 | 4 | 4 | rounded obelisk and the white crown ✔; the shaft reads **dark-banded**, the real one is pale silver-blue glass with fine white lines | no (a district change: the lead only) |
| 33 | Conservatory of Flowers (60) | site · AI swap | 5 | 4 | 5 | white Victorian glasshouse with its central dome ✔ | no |
| 34 | Mission Dolores (60) | site · AI swap | 4 | 4 | 4 | the old adobe mission and the ornate basilica towers ✔ | no |
| 35 | SF Zoo (60) | site proc | 3 | 3 | 3 | toy giraffes and zebras; fine for a toy | no |
| 36 | Sutro Tower (60) | site T1 proc | 5 | 4 | 5 | red-and-white, three legs pinched at the waist, the claw on top ✔ | no |
| 37 | Legion of Honor (58) | site T2 proc | 4 | 4 | 4 | white arch, colonnaded court, the Thinker ✔ | no |
| 38 | Cable Car Museum (57) | site proc | 4 | 4 | 4 | red-brick powerhouse with its chimney ✔ | no |
| 39 | Dutch Windmill (57) · **fixed, now 4/4/4** | **R** · site T2 proc + AI mesh | 2 | 4 | 4 | the real tower is **weathered grey-brown shingle** with a dark cap and a wooden gallery; the model is cream-white → **R fixes the colours** | no |
| 40 | Fort Point (57) | site T2 proc | 4 | 4 | 5 | brick fort under the bridge's orange arch ✔ | no |
| 41 | Castro Theatre (56) | site · AI swap + corner | 4 | 4 | 4 | the tall vertical blade sign with bulbs ✔ (red in reality, a little orange here), white Spanish-baroque front | no |
| 42 | Grace Cathedral (55) · **fixed, now 4/4/4** | **R** · site T2 proc + AI mesh | 3 | 4 | 4 | twin towers, blue rose window ✔; the real concrete is **cool light grey** and the roofs dark grey (warm beige and green here) → **R fixes the colours** | no |
| 43 | Harvey Milk Plaza (55) | site plaza (castro) | 4 | 3 | 4 | the giant rainbow flag and the rainbow crosswalk ✔ | no |
| 44 | Japantown Peace Pagoda (54) | site T2 proc | 4 | 4 | 4 | five pale concrete tiers and the bronze sōrin ✔ | no |
| 45 | St Ignatius (48) | site · AI swap | 4 | 4 | 4 | tall cream twin towers ✔; the tower cupolas are **grey metal** in reality (cream here) | maybe (V: regenerate with grey cupolas) |
| 46 | Asian Art Museum (44) | site T3 (civic kit) | 3 | 3 | 3 | a granite Beaux-Arts block with a colonnade ✔; hidden between tall city blocks in most views | no |
| 47 | War Memorial Opera House (42) | site T3 (civic kit) | 3 | 3 | 3 | twin civic blocks + the court ✔; the real ones have a mansard roof and paired columns | no |
| 48 | Cliff House (42) | site T2 proc | 4 | 4 | 4 | the white 1909 block with the glass addition on the cliff, the camera obscura ✔ | no |

**Summary for V** (generated models most likely to beat code): the Palace of Fine Arts peristyle (#8), the de Young
tower (#22), St Ignatius's grey cupolas (#45), and a Haight Victorian / mural kit (#17). The cheap code fixes are R's:
the Fisherman's Wharf wheel (#3), the City Hall dome (#14), the Dutch Windmill (#39), Grace Cathedral (#42), Lombard's
hydrangeas (#6) if time. District landmarks (Coit, the Ferry Building, Transamerica, Salesforce, PIER 39's gate) stay
as they are (district mode never changes; Salesforce's colour would be the lead's call).

## Fixes made by lane R

Same cameras before (tree `80ef896b`) and after; calls / triangles read at each view with the dev QA hooks (the ±3 calls
are walkers and cars moving between the two runs: every fix is inside the site's existing mesh, 0 new calls).

| # | place | what changed | score now (C/P/F) | calls · tris before → after (photo view) | shot |
|---|---|---|---|---|---|
| 3 | Fisherman's Wharf wheel | the ring is dark-brown wood (was blue), a thin dark ring inside the plain band and one round the crab, the spokes only outside the rim (they no longer cross the face), and the wheel hangs on **four wooden pilings bound with rope** that rise above the rim (was a grey steel post); procedural site, +≈ 180 triangles, tops row regenerated (6.0 u) | 4 / 4 / 5 | 70 · 142.1k → 72 · 141.9k | `qa/w7/R/b-fishermans-wharf-before-after.jpg` |
| 14 | City Hall | the AI mesh's texture: the sage dome and window panels → **lead-grey** (the gold ribs, lantern and trim stay gold); the procedural far model's dome the same grey | 5 / 4 / 5 | 75 · 238.4k → 78 · 239.1k | `qa/w7/R/b-city-hall-before-after.jpg` |
| 39 | Dutch Windmill | the AI mesh's texture: the cream tower → **weathered grey-brown shingle**, the orange wood darker; the procedural body the same | 4 / 4 / 4 | 94 · 261.4k → 94 · 261.4k | `qa/w7/R/b-dutch-windmill-before-after.jpg` |
| 42 | Grace Cathedral | the AI mesh's texture: warm beige → **cool light-grey concrete**, the green roofs and flèche → **dark slate**; the procedural model the same | 4 / 4 / 4 | 72 · 304.8k → 73 · 301.1k | `qa/w7/R/b-grace-cathedral-before-after.jpg` |

The texture recolour is `scripts/opus-sf/assets/w7r/recolour-glb.py` (HSV rules per model on the baked WebP, the Draco
mesh untouched, the GLB rewritten; sizes 151,068 → 146,860 B, 118,076 → 111,804 B, 91,692 → 83,956 B, pinned in
`data/assets.ts` and `tests/opus-bay-w7-r.test.ts`). No Higgsfield credits were spent.

## References (Wikimedia Commons, thumbnails fetched 2026-09-29 to scratch only)

- Golden Gate Bridge: https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge_as_seen_from_Battery_East.jpg
- Fisherman's Wharf sign: https://commons.wikimedia.org/wiki/File:Fishermans_Wharf_Sign,_SF,_CA,_jjron_25.03.2012.jpg
- Ferry Building: https://commons.wikimedia.org/wiki/File:Ferry_Building_San_Francisco_from_Hyatt_Regency_with_R-Evolution_and_Bay_Bridge_2026_dllu.jpg
- Dragon Gate: https://commons.wikimedia.org/wiki/File:1_chinatown_san_francisco_arch_gateway.JPG
- Lombard Street: https://commons.wikimedia.org/wiki/File:Lombard_Street_2020.jpg
- Painted Ladies: https://commons.wikimedia.org/wiki/File:Painted_Ladies_San_Francisco_January_2013_panorama_2.jpg
- Palace of Fine Arts: https://commons.wikimedia.org/wiki/File:Palace_of_Fine_Arts_(16794p).jpg
- Coit Tower: https://commons.wikimedia.org/wiki/File:Coit_Tower_1.jpg
- Twin Peaks: https://commons.wikimedia.org/wiki/File:Twin_Peaks_2022_Aerial.png
- Union Square: https://commons.wikimedia.org/wiki/File:San_Francisco_Union_Square.jpg
- City Hall: https://commons.wikimedia.org/wiki/File:San_Francisco_City_Hall_September_2013_panorama_2.jpg
- Cal Academy: https://commons.wikimedia.org/wiki/File:Living_roof_at_the_California_Academy_of_Sciences.jpg
- Sutro Baths: https://commons.wikimedia.org/wiki/File:Sutro_Baths_in_San_Francisco.jpg
- SFMOMA: https://commons.wikimedia.org/wiki/File:2017_SFMOMA_from_Yerba_Buena_Gardens.jpg
- Cable car: https://commons.wikimedia.org/wiki/File:Cable_car_19_on_Hyde_Street,_July_2023.JPG
- SF State: https://commons.wikimedia.org/wiki/File:The_Quad_at_SFSU.jpg
- de Young: https://commons.wikimedia.org/wiki/File:De_Young_Museum1.jpg
- Ocean Beach / Cliff House: https://commons.wikimedia.org/wiki/File:Cliff_House_from_Ocean_Beach.jpg
- Transamerica: https://commons.wikimedia.org/wiki/File:Transamerica_Pyramid_from_Coit_Tower.jpg
- Lands End: https://commons.wikimedia.org/wiki/File:Coastal_Trail_and_Golden_Gate_Bridge,_April_2019.JPG
- Stonestown: https://commons.wikimedia.org/wiki/File:Stonestown_Galleria_1.jpg
- Japanese Tea Garden: https://commons.wikimedia.org/wiki/File:Japanese_tea_garden_Golden_Gate_Park.JPG
- Oracle Park: https://commons.wikimedia.org/wiki/File:Oracle_Park_from_China_Basin_Park.jpg
- Ghirardelli Square: https://commons.wikimedia.org/wiki/File:Ghirardelli_Square_entrance,_Larkin_St,_SF.jpg
- Dolores Park: https://commons.wikimedia.org/wiki/File:Mission_Dolores_Park_view_January_2026.jpg
- Salesforce Tower: https://commons.wikimedia.org/wiki/File:Karl_the_Fog_playing_with_the_Salesforce_Tower-L1003555.jpg
- Conservatory of Flowers: https://commons.wikimedia.org/wiki/File:Summer_of_Love_50th,_Conservatory_of_Flowers_San_Francisco_-_02.jpg
- Mission Dolores: https://commons.wikimedia.org/wiki/File:Mission_Dolores_San_Francisco_California_June_1987_-_Exterior.jpg
- Sutro Tower: https://commons.wikimedia.org/wiki/File:Sutro_Tower_from_Grandview.jpg
- Legion of Honor: https://commons.wikimedia.org/wiki/File:San_Francisco_-_Legion_Of_Honor_Museum_(1166435032).jpg
- Cable Car Museum (HAER): https://commons.wikimedia.org/wiki/File:EAST_FRONT_AND_SOUTH_SIDE_OF_POWERHOUSE_AND_CAR_BARN._-_San_Francisco_Cable_Railway,_Washington_and_Mason_Streets,_San_Francisco,_San_Francisco_County,_CA_HAER_CAL,38-SANFRA,137-34.tif
- Dutch Windmill: https://commons.wikimedia.org/wiki/File:GGParkNorthWindmill2.jpg
- Murphy Windmill: https://commons.wikimedia.org/wiki/File:Murphy_windmill.jpg
- Fort Point: https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge_tower_views_07.jpg
- Castro Theatre: https://commons.wikimedia.org/wiki/File:Castro,_San_Francisco,_CA.jpg
- Grace Cathedral: https://commons.wikimedia.org/wiki/File:2009-0723-CA-005-GraceCathedral_(pc).jpg
- Harvey Milk Plaza: https://commons.wikimedia.org/wiki/File:Harvey_Milk_Plaza,_February_2025.jpg
- Peace Pagoda: https://commons.wikimedia.org/wiki/File:Peace_Pagoda,_Japantown_(8116918015).jpg
- St Ignatius (dome detail): https://commons.wikimedia.org/wiki/File:Dome,_Saint_Ignatius_Church_-_San_Francisco,_CA.jpg
- Music Concourse bandshell: https://commons.wikimedia.org/wiki/File:Golden_Gate_Park_-_Spreckels_Temple_of_Music_02.jpg
- Asian Art Museum: https://commons.wikimedia.org/wiki/File:Asianartmuseumnight.jpg
- War Memorial Opera House: https://commons.wikimedia.org/wiki/File:War_Memorial_Opera_House,_San_Francisco_-_facade_detail_near_south-eastern_corner.jpg
