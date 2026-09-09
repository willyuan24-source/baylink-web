# San Francisco attraction guides: research and photo provenance

Verified: 2026-09-09. Five guide records are in `src/data/guides-attractions-sf.ts`; each has four primary official sources and a dated source note. Chinese-to-English displayed strings are in `output/attractions-sf-en.json`. Slug-to-photo-key assignments are in `output/attractions-sf-mapping.json`.

## Editorial boundaries

- Route ordering and 2–4 hour durations are clearly identified as BAYLINK editorial suggestions, not official tour promises. No fixed ticket price, business hours or transit interval has been invented.
- Golden Gate Bridge: east sidewalk only for pedestrians; seasonal/construction restrictions checked. Fort Point admission is free but opening must be checked separately. Crissy Field East Beach and West Bluff parking are not interchangeable.
- Wharf: PIER 39 public entry is free; aquarium/cruises/attractions are separate. Sea lions vary. NPS currently says Hyde Street Pier is closed for reconstruction, with historic ships moved to Mare Island in Vallejo; the guide does not promise ship boarding in San Francisco.
- Alcatraz: NPS admission has no separate entrance fee, but the authorized ferry is paid and is not covered by annual passes or fee-free park days. Alcatraz City Cruises departs from Pier 33. The cellhouse approach rises about 40 m over 0.4 km; SEAT and food/water rules are linked.
- Chinatown/North Beach: living neighborhoods, public streets free; shopping, dining and ticketed venues separate. Private or religious interiors are not assumed open.
- Palace/Marina: public outdoor scenery is free; theater and reserved events separate. Marina work updates are linked and a historic aerial photo is not represented as an access map.

## Photos

All ten selected photographs were downloaded from Wikimedia Commons and individually inspected with the image viewer before acceptance. The original downloaded previews and API metadata are retained under `output/sf-attractions/`. Only orientation normalization, proportional resizing and WebP compression were applied. No object, person, sign or scene was generated, replaced or retouched. Small variants are 480 px wide. Portrait Wharf signage is flagged `fullFrame` to preserve the full sign. Photos explicitly state their capture year; none is presented as a September 2026 photograph.

Copyright and licensing apply to the individual photographs, independently of this website’s code. Each adapted/resized photo is distributed under its stated original license, including share-alike where applicable. The rendered metadata carries the photographer, source file link, license link and resizing disclosure.

| Key | Capture date reported by source | Photographer | Photograph license | Source | Full WebP |
| --- | --- | --- | --- | --- | --- |
| sf-bridge | 2017-06-24 08:45:10 | Frank Schulenburg | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons file](https://commons.wikimedia.org/wiki/File:Golden_Gate_Bridge_as_seen_from_Battery_East.jpg) | 1400 × 875; 189 KB |
| sf-fort-point | 2023-03-10 22:35:07 | Mike Seager Thomas | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons file](https://commons.wikimedia.org/wiki/File:The_interior_of_Fort_Point.jpg) | 1400 × 933; 175 KB |
| sf-pier39 | 2012-11-14 | Jennyhjert | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons file](https://commons.wikimedia.org/wiki/File:California,_San_Francisco,_Pier_39,_sea_lions.jpg) | 1400 × 933; 195 KB |
| sf-wharf | 2016-08-30 | Tobias Kleinlercher / Wikipedia | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | [Commons file](https://commons.wikimedia.org/wiki/File:Fisherman%27s_Wharf,_San_Francisco_sign_(TK2).JPG) | 1000 × 1500; 171 KB |
| sf-alcatraz | Taken on 27 August 2019, 15:29:41 | © Radomianin / Wikimedia Commons | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [Commons file](https://commons.wikimedia.org/wiki/File:Alcatraz_recreation_yard,_NW_view.jpg) | 1400 × 892; 268 KB |
| sf-cellhouse | 2012-03-24 13:41 | HarshLight | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Commons file](https://commons.wikimedia.org/wiki/File:Alcatraz_Island_(6870454844).jpg) | 1400 × 933; 139 KB |
| sf-chinatown | 2023-02-10 17:03:28 | Bob B. Brown | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Commons file](https://commons.wikimedia.org/wiki/File:San_Francisco_California,_February_2023_-_Dragon_Gate.jpg) | 1400 × 933; 288 KB |
| sf-northbeach | 2019-03-17 15:23:33 | Buzzlovestravel | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | [Commons file](https://commons.wikimedia.org/wiki/File:WashingtonSquareParkSanFrancisco2.jpg) | 1400 × 1050; 475 KB |
| sf-palace | 2017-12-08 17:43:00 | Daderot | [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Commons file](https://commons.wikimedia.org/wiki/File:Lagoon_-_Palace_of_Fine_Arts_-_San_Francisco,_CA_-_DSC02422.jpg) | 1400 × 933; 259 KB |
| sf-marina | 2016-05-28 | Sasha • Stories | [CC0](https://creativecommons.org/publicdomain/zero/1.0/deed.en) | [Commons file](https://commons.wikimedia.org/wiki/File:Aerial_view_of_The_Palace_of_Fine_Arts.jpg) | 1400 × 933; 422 KB |

### License verification notes

- Important correction: `sf-alcatraz` API extmetadata incorrectly summarizes the architectural object’s public-domain status. The actual file page’s **Photograph** licensing and required attribution specify **© Radomianin / Wikimedia Commons / CC BY-SA 4.0**. The delivered metadata follows that explicit photo license, not the API’s ambiguous public-domain value.
- `sf-marina` is Sasha • Stories’ 2016 image, published on Unsplash before its 2017 license change. Its Commons file page explicitly records CC0 for that earlier publication; this does not imply all current Unsplash images are CC0.
- `sf-cellhouse` is file 6870454844 (historic control room), CC BY 2.0. A clock close-up (7016523353) and typewriter image (6870476730) were reviewed but rejected; they are not shipped in the public asset set.
- All ten Commons file pages were checked directly. Cellhouse, Washington Square and Palace lagoon pages returned HTTP 200 via direct fetch and confirmed CC BY 2.0, CC BY-SA 4.0 and CC0 respectively; their source HTML is saved with the originals. These are separate works, not generic decorative photos.
