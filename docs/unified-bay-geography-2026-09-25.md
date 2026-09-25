# Connected Bay Area game world

The four existing content districts now share one scene coordinate system. This file records the authored geography and navigation contract; it is not a real-world navigation dataset.

## Geography and source provenance

All 68 venue coordinates, source links, guide associations and photo identifiers are preserved from `sf-world.ts` and `regional-world.ts`. The new projection uses origin longitude −122.20, latitude 37.60, with east-positive x and south-positive z. One game unit is approximately 100 metres. This preserves the original San Francisco scale and relative positions across the Bay.

The shoreline is a new hand-authored, simplified polygon, not a stitched union of the earlier district polygons and not copied map tiles. One U-shaped mainland joins San Francisco, the Peninsula, South Bay and East Bay. Marin, Alcatraz, and Yerba Buena/Treasure Island are additional land shapes. Alameda's estuary, small salt-pond channels, piers and shoreline details are simplified to keep movement readable. Hills, bridge heights, widths and buildings are art-directed; they are not surveyed elevations or real access permissions.

Official references checked on 2026-09-25:

- [FasTrak Bay Area system map](https://www.bayareafastrak.org/en/common/docs/fastrak-bayarea-fullmap-v1.pdf): relative city, bay and bridge arrangement.
- [San Francisco–Oakland Bay Bridge](https://www.bayareafastrak.org/en/toll-locations/san-francisco-oakland-bridge.shtml): SF–Oakland crossing and I-80 connection.
- [San Mateo–Hayward Bridge](https://www.bayareafastrak.org/en/toll-locations/san-mateo-hayward-bridge.shtml): Foster City–Hayward crossing.
- [Dumbarton Bridge](https://www.bayareafastrak.org/en/toll-locations/dumbarton-bridge.shtml): Menlo Park–Fremont crossing. The site's route-number text was not adopted into the game dataset.
- [Golden Gate Bridge directions](https://www.goldengate.org/bridge/visiting-the-bridge/directions-parking/): San Francisco–Marin connection along US 101.
- [National Park Service Alcatraz directions](https://www.nps.gov/alca/planyourvisit/directions.htm): island access by ferry from Pier 33.

These sources establish the geographic relationships. The numeric coast and road control points are our own game approximation, not asserted to be extracted official GIS geometry. Real access, tickets, current traffic, road restrictions and visiting times remain with the linked official services.

## Traversal and navigation

- Land is freely walkable and drivable in the game. Movement is not constrained to narrow road centrelines.
- Four actual deck corridors cross water: Golden Gate, Bay Bridge, San Mateo–Hayward and Dumbarton. Water outside those decks is not traversable by walking or driving.
- US 101, I-280, I-880, El Camino Real, CA 92, CA 84, CA 237 and authored local branches form one connected navigation graph.
- Place entrance connections are checked against land and bridge geometry. Navigation cannot draw a straight shortcut through the bay merely because a destination is in another district.
- Alcatraz routes explicitly contain a `ferry` leg in both directions. Its mainland departure remains Pier 33; the island never moves to the mainland, and boats do not grant driving access to the ocean.
- After manually steering a ferry, resuming or choosing another destination rejoins the nearest ferry segment and follows the channel bends to the appropriate terminal. It does not chase a stale waypoint across open water.
- Named destinations stop at an arrival point in front of the miniature model. Explicit coordinate targets retain their exact coordinate semantics. Requesting a named place while already in its arrival area completes immediately.
- Region selection is content/camera grouping, not a coordinate-system or scene change.
- `BayRoute.distance` is game-world distance. It is not a real-world road distance or arrival-time estimate.

`baySegmentCanMove` splits navigation edges at every coastline and bridge capsule intersection, then checks each interval. This catches small gaps that coarse point sampling can miss at a diagonal shoreline or bridge approach.

## Verification

Ten focused geography and movement tests cover source/place preservation, projection, continuous mainland, open water, four bridge decks and their support heights, every rendered road segment, all 68 safe spawns and distinct arrivals, district routes, explicit Alcatraz ferry legs, bounded ferry rerouting, actual walking-controller traversal to all 68 entrances, and Marin region detection. Five additional HUD integration tests exercise the real explorer with a scene callback fixture: quick-travel position synchronization, no invented visit awards, zero-length arrival, manual takeover and safe resumption, ferry resumption, world/modal pause and cancellation.

A separate exhaustive read-only check computed all **4,624 ordered landmark pairs** (68 × 68), including every returned land-leg segment. All pairs were available; zero land legs crossed unsupported water. On the development machine the check took approximately 5.4 seconds. This is correctness evidence, not a browser frame-rate benchmark.

No paid tools or Higgsfield credits were used for this geography or routing implementation.
