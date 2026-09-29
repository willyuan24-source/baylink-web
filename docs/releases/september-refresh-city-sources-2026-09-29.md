# September refresh city reference points

Checked 2026-09-29 against the 26 events in `september-refresh-sf-east-events.json` and `september-refresh-regional-events.json`.

The 26 events use 14 distinct city labels. Nine already have reference points in `calendar-city-locations.ts` or its imported `autumn-calendar-cities.json`; the five missing labels are supplied by `september-refresh-city-locations.json`. These are city/CDP aggregation fallbacks, not venue coordinates, entrances, directions, or route inputs.

## Official source and derivation

[U.S. Census Bureau 2026 California place Gazetteer TXT](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_place_06.txt), retrieved directly on 2026-09-29. The pipe-delimited rows supply `GEOID`, `NAME`, `INTPTLAT`, and `INTPTLONG`. The implementation rounds the two representative-point coordinates to three decimal places, matching existing calendar city points.

| Calendar city key | Official Census NAME | GEOID | INTPTLAT | INTPTLONG | Stored lat, lng |
| --- | --- | --- | --- | --- | --- |
| Corte Madera | Corte Madera town | 0616462 | 37.931783 | -122.507741 | 37.932, -122.508 |
| Fairfax | Fairfax town | 0623168 | 37.988532 | -122.595208 | 37.989, -122.595 |
| Mountain View | Mountain View city | 0649670 | 37.399686 | -122.079269 | 37.400, -122.079 |
| Point Reyes Station | Point Reyes Station CDP | 0657960 | 38.084647 | -122.809226 | 38.085, -122.809 |
| San Lorenzo | San Lorenzo CDP | 0668112 | 37.6759 | -122.135973 | 37.676, -122.136 |

`precision: "city"` follows the existing calendar schema for a city, town, or CDP reference point. It does not claim that Census classifies every entry as an incorporated city.

## Same-name and branch checks

- Use **Fairfax town, GEOID 0623168**, in Marin County. The same California source also contains Fairfax CDP, GEOID 0623158, at latitude 35.346885; that is not the event's town and was excluded.
- Use **Mountain View city, GEOID 0649670**, for the Castro Street, Rengstorff Park, and Ameswell Hotel events. The source also contains Mountain View CDP, GEOID 0649651, and Mountain View Acres CDP, GEOID 0649684; neither is this city.
- The event venue is named Point Reyes Library, but its [official branch page](https://marinlibrary.org/locations/mp/) lists **11431 State Route One, Point Reyes Station, CA 94956**. The event data already uses `Point Reyes Station`, so no ambiguous `Point Reyes` alias or peninsula-wide point is introduced.

## Event coverage

New reference points cover eight events: Corte Madera (1), Fairfax (1), Mountain View (3), Point Reyes Station (1), and San Lorenzo (2). Existing reference points cover the remaining 18 events in Berkeley, Menlo Park, Novato, Redwood City, San Francisco, San Rafael, Santa Rosa, Sonoma, and Stanford.

No venue geocoding or coordinate estimation was performed. Root integration must import and spread the new JSON into `CALENDAR_CITY_LOCATIONS` before these new reference points become active.
