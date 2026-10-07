# October–November 2026 calendar reference points

Checked 2026-10-07 by reading the official [Census 2026 California places gazetteer](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_place_06.txt). The web text reader could not render this plain-text file; a normal anonymous GET returned HTTP 200 with the following records.

| Calendar label | Official record | Original latitude / longitude | Saved point | Precision |
| --- | --- | --- | --- | --- |
| Portola Valley | Portola Valley town, GEOID 0658380 | 37.365242 / -122.233003 | 37.365 / -122.233 | city |
| West Marin | Point Reyes Station CDP, GEOID 0657960 | 38.084647 / -122.809226 | 38.085 / -122.809 | area |

Portola Valley is a town reference for the two Windy Hill programs. It is **not** the Portola Road parking lot or a trailhead. The published event instructions and official program links remain the source for meeting directions.

West Marin is a broad region containing scattered artist studios, not a city. Its map marker deliberately reuses the Point Reyes Station town reference as one orientation point, with `area` precision and the UI's “区域参考位置” label. It does not claim to be the center of West Marin, a studio address, the Point Reyes National Seashore visitor center, or the start of a route. Visitors still choose actual participating studios from the organizer's map.

These fallbacks are registered only in `CALENDAR_CITY_LOCATIONS`. They do not add `event.location` venue coordinates and therefore cannot establish venue proximity or qualify an event for nearby-stop distance calculations.
