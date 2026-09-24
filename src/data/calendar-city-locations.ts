const CENSUS_PLACES = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_place_06.txt';
const CENSUS_COUNTIES = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_counties_06.txt';

/**
 * City/area reference points, checked 2026-09-23 and rounded to three decimals.
 * These are aggregation fallbacks, never venue entrances or navigation targets.
 * Sources, source identifiers and multi-city derivation are recorded in
 * docs/calendar-city-location-sources-2026-09-23.md.
 */
export const CALENDAR_CITY_LOCATIONS: Record<string, {
  lat: number;
  lng: number;
  precision: 'city' | 'area';
  sourceUrl: string;
}> = {
  'Benicia': { lat: 38.073, lng: -122.155, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Berkeley': { lat: 37.866, lng: -122.299, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Burlingame': { lat: 37.590, lng: -122.363, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Calistoga': { lat: 38.581, lng: -122.583, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Campbell': { lat: 37.280, lng: -121.953, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Clayton': { lat: 37.940, lng: -121.930, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Cupertino': { lat: 37.319, lng: -122.045, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Emeryville': { lat: 37.839, lng: -122.302, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Foster City': { lat: 37.565, lng: -122.251, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Fremont': { lat: 37.495, lng: -121.941, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Half Moon Bay': { lat: 37.467, lng: -122.440, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Menlo Park': { lat: 37.480, lng: -122.148, precision: 'city', sourceUrl: CENSUS_PLACES },
  // Arithmetic mean of the three Census city reference points; not a theater.
  'Mill Valley / San Rafael / Larkspur': { lat: 37.943, lng: -122.526, precision: 'area', sourceUrl: CENSUS_PLACES },
  'Napa': { lat: 38.297, lng: -122.301, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Novato': { lat: 38.085, lng: -122.548, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Oakland': { lat: 37.770, lng: -122.226, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Pacifica': { lat: 37.607, lng: -122.483, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Palo Alto': { lat: 37.397, lng: -122.143, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Petaluma': { lat: 38.242, lng: -122.629, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Piedmont': { lat: 37.823, lng: -122.230, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Redwood City': { lat: 37.515, lng: -122.214, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Rio Vista': { lat: 38.177, lng: -121.703, precision: 'city', sourceUrl: CENSUS_PLACES },
  'San Carlos': { lat: 37.499, lng: -122.268, precision: 'city', sourceUrl: CENSUS_PLACES },
  // Wikidata's preferred city coordinate avoids the offshore Census reference.
  'San Francisco': { lat: 37.775, lng: -122.419, precision: 'city', sourceUrl: 'https://www.wikidata.org/wiki/Q62#P625' },
  'San Jose': { lat: 37.296, lng: -121.815, precision: 'city', sourceUrl: CENSUS_PLACES },
  'San Rafael': { lat: 37.981, lng: -122.507, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Santa Rosa': { lat: 38.446, lng: -122.706, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Sonoma County': { lat: 38.522, lng: -122.916, precision: 'area', sourceUrl: CENSUS_COUNTIES },
  'Sunnyvale': { lat: 37.386, lng: -122.026, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Tiburon': { lat: 37.887, lng: -122.463, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Vacaville': { lat: 38.359, lng: -121.969, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Walnut Creek': { lat: 37.903, lng: -122.040, precision: 'city', sourceUrl: CENSUS_PLACES },
  'Windsor': { lat: 38.542, lng: -122.809, precision: 'city', sourceUrl: CENSUS_PLACES },
};
