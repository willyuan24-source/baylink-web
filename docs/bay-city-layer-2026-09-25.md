# BAYLINK city layer — 2026-09-25

The continuous Bay world now has 30 named city, town, community and area centres. These are authored game regions, not administrative boundaries or a real-world navigation product. The shared longitude/latitude projection remains the only coordinate system.

`BayCity.position` is the camera and map-label anchor. `focusKey` suggests an existing nearby attraction; it must never replace the city's camera target. For example, Sunnyvale is visible at its own centre even though its nearest implemented museum recommendation is in Mountain View. Stanford is explicitly a community, Woodside a town, and Mount Hamilton an area.

`bayCityForPlace` preserves the existing venue affiliation for all 68 attractions. `bayCityAt` rejects water, bridge decks and the unimplemented Marin scenery, then applies the known venue affiliation near a landmark. Elsewhere it uses nearby same-region centres with a distance ceiling, leaving distant countryside unlabelled. The compact authoring intentionally does not claim municipal accuracy.

The pure presence reducer requires 1,000 ms in the same candidate before announcing entry. A 1,500 ms departure buffer avoids flicker near an unlabelled edge. A new city confirmed for 1,000 ms can replace the previous city directly. Overview mode, explicit teleport, invalid input and a backwards clock reset pending presence without an announcement. Leaving and returning later can produce a fresh arrival, while remaining in the same city does not repeat the banner.

## Reference checks

- [San Mateo County LAFCo — Cities in San Mateo County](https://www.smcgov.org/lafco/cities-san-mateo-county): official city/town naming and Woodside's town classification.
- [San Mateo County — Third District](https://www.smcgov.org/third-district): distinguishes its incorporated cities/towns from unincorporated Stanford Lands.
- [Santa Clara County FY 2022–23 annual report](https://files.santaclaracounty.gov/2023-10/county-of-santa-clara-fy22-23-mrp-annual-report-final.pdf): identifies the Stanford portion in unincorporated Santa Clara County. Stanford is not labelled as an incorporated city.
- Existing attraction source URLs in `regional-world.ts` and `sf-world.ts` remain the venue references; this layer adds no opening-hours, admission or event claims.

## Verification

`tests/bay-cities.test.ts` exercises centre ownership, actual camera anchors, all landmark affiliations, water and bridge rejection, delayed entry, boundary jitter, departure grace, preview and teleport suppression, bad inputs and clock rollback. Browser rendering and HUD integration are validated by the parent task.
