# September 2026 activity images

Reviewed on 2026-09-08 (Pacific time). Each activity has its own subject and file. Images were inspected before acceptance. The site must retain source credits, historical dates and the complete poster when opened at full size. No watermark, logo, artist credit, event text or date was removed. Only resizing and WebP encoding were applied.

The eight source records are in `src/data/event-media-assets.json`; their full and 480 px images are in `public/guides/distinct/`. Local source downloads and saved official source pages are in `output/monthly-media-originals/`. The Flower Piano asset is supplied separately by BAYLINK's original illustration workflow.

## Source and usage evidence

| Key | Asset and source | Evidence / context |
| --- | --- | --- |
| event-mountain-view | [Mountain View official Press Kit](https://www.mvartwine.com/press-kit), 2026 marketing image | Press kit expressly says assets are for editorial use and prohibits commercial use without prior approval. The image is used only beside editorial coverage of that same festival. Downloaded through the official `MVAW-MarketingImage.zip` link; preserve the complete illustration. |
| event-mill-valley | [Mill Valley official Press page](https://www.mvfaf.org/press), [2026 poster](https://www.mvfaf.org/s/2026-MVFAF-Poster.jpg) | Official Press page explicitly supplies a 2026 Poster Image for media. Artwork is **Golden Beams by Hilary Williams**, as printed on the poster. Use only to illustrate coverage of the same event; do not imply a CC license. |
| event-opera | [San Francisco Opera season press release](https://www.sfopera.com/press/press-releases/San-Francisco-Opera-2026-27-season/), Opera in the Park 2025 double photograph | The [Press Room](https://www.sfopera.com/press/) allows images only for editorial promotion of SF Opera and requires photographer credit. Caption in the release identifies **Kristen Loken / San Francisco Opera**, 2025. Use the publicly supplied release image, not the password-protected download area. Explicitly labeled as a 2025 archive image. |
| event-muni | [Wikimedia Commons: Muni 3287 during Heritage Weekend, September 2017](https://commons.wikimedia.org/wiki/File:Muni_3287_during_Heritage_Weekend,_September_2017.JPG) | **Pi.1415926535**, photographed 2017-09-10, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). License metadata retained locally. Downloaded the server-provided 1280 px thumbnail. Caption records resize/WebP conversion and clarifies that this is not the 2026 vehicle list. |
| event-moon | [Chinatown Merchants Association official festival site](https://www.moonfestival.org/), dragon procession photograph | This exact official event illustration shows the dragon procession in Grant Avenue; lower-right credit is **Calvin Jeng 2021**, retained in the image. Used in reporting the same annual event at the user's direction. The page carries an all-rights-reserved notice and does **not** grant a CC/open license. Caption clearly says 2021 archive photograph. |
| event-portola | [Portola official homepage](https://www.portolamusicfestival.com/), current Portola 2026 lineup poster | Homepage labels it **Portola 2026 Poster** and provides the artwork alongside ticket links. Used as the subject-specific official promotional visual in editorial reporting of the festival. Credit **Portola / Goldenvoice**; no CC/open license is claimed. Preserve complete poster and refer users to the official source for lineup updates. |
| event-lafayette | [Lafayette official Media Assets](https://lafayettefestival.com/media-assets/), [2026 Music Card dated 090326](https://lafayettefestival.com/wp-content/uploads/LAWF-26-Music-Card-090326.png) | Media Assets page invites download of logos, video and ads, and links the current music schedule. The official public media library identifies this image as `LAWF 26 Music Card 090326`. Used only to illustrate the same festival. Caption identifies the September 3 version; no CC/open license is claimed. |
| event-bark | [Bark in the Park official homepage](https://www.barksanjose.org/), `bark26_1200x628.jpg` promotional graphic | Official homepage publishes this dated 2026 graphic, showing the same September 19 date and William Street Park location. [Press page](https://www.barksanjose.org/inthenews) supplies event press material and PSAs. Used as the subject-specific official promotional graphic in editorial coverage; **Naglee Park Campus Community Association** retains copyright/trademark. No open license is claimed. The accepted public rendition is 600 × 294, not upscaled. |

For sources without an express open license, the record describes the limited, attributed editorial context and does not assert that public availability equals blanket permission. These assets are not sold, used for merchandise, used as BAYLINK's own branding, or presented as BAYLINK photography. Any different downstream use needs its own rights review.

## Accepted asset URLs

- Mountain View: `https://www.mvartwine.com/_files/archives/984766_4b560d9d1153413aaa8b2337306b57b9.zip?dn=MVAW-MarketingImage.zip` → `MVAW-MarketingImage/2026MarketingImage.png`
- Mill Valley: `https://www.mvfaf.org/s/2026-MVFAF-Poster.jpg`
- Opera: `https://www.sfopera.com/link/3da193f5b8504c419941874798d0996e.aspx`
- Muni: server-provided `thumburl` retained in `output/monthly-media-originals/muni-license.json`
- Autumn Moon: `https://images.squarespace-cdn.com/content/v1/629ea90b27bf2b1528862d49/93642daf-023f-425f-b5ae-7247153f6f95/DSC_0538DRAGONEE.jpg`
- Portola: `https://aegwebprod.blob.core.windows.net/content/portola/2026/portola-2026-lineup.jpg`
- Lafayette: `https://lafayettefestival.com/wp-content/uploads/LAWF-26-Music-Card-090326.png`
- Bark: exact homepage rendition saved in `output/monthly-media-originals/bark-assets.json`, image with alt `bark26_1200x628.jpg`.

## Visual review

- Eight images have different compositions and distinct subjects: mountain event identity, forest poster, opera performance, vintage bus, dragon parade, electronic music lineup, street festival music schedule, and dog event graphic.
- Poster typography and credits remain complete in the image files. Use `object-fit: contain` for official poster cards so event details remain visible; full-screen zoom should contain all image types.
- The Opera file intentionally contains two photographs side by side and should preferably also use containment.
- Previewed every accepted WebP with `view_image`; verified current poster dates and historical photo years from captions or visible source credits.

## Independent second review

All eight source links returned HTTP 200 on the second review. The response receipt, including final URLs and content types, is saved in `output/monthly-media-originals/second-source-review.json`.

| Key | Date / activity comparison against BAYLINK | Finding |
| --- | --- | --- |
| event-mountain-view | Artwork is undated event identity supplied in the 2026 press kit; that kit lists September 12–13, 2026 on Castro Street. BAYLINK has those dates and location. | Matched. Caption deliberately says “from the 2026 media kit,” not that a date is printed on the artwork. |
| event-mill-valley | Poster visibly says 2026, September 19–20 and Old Mill Park. BAYLINK has September 19–20, 2026 at Old Mill Park. | Matched. Artist/title credit is present on both image and caption. |
| event-opera | Official 2026–27 release captions the exact double image “Opera in the Park in 2025” and names Kristen Loken. The same release lists the new concert on Sunday, September 13, 2026 at 1:30 p.m.; BAYLINK uses that date/time. | Matched archive illustration, explicitly labeled 2025. Both halves should be shown in full: at 1440 × 478, a landscape card with `cover` would discard substantial parts of one/both photographs. Use containment for this photo as well as posters. |
| event-muni | Commons metadata records September 10, 2017 and vehicle 3287. Current SFMTA event and BAYLINK are September 19–20, 2026. | Matched archive illustration; caption warns that the 2017 vehicle is not a promise about the 2026 fleet. |
| event-moon | Visible photograph credit is Calvin Jeng 2021. Current official event is September 19–20, 2026 on Grant Avenue; BAYLINK matches. | Matched archive illustration, explicit 2021 caption; original credit retained. |
| event-portola | Poster visibly says 2026, Saturday September 26 and Sunday September 27, Pier 80, and 21+. BAYLINK has the same dates, venue and age restriction. | Matched. Complete image required so footer venue and 21+ detail remain visible. |
| event-lafayette | Image headline says 2026 Music Lineup with Saturday September 19 and Sunday September 20. Official media metadata confirms creation `2026-09-03T22:55:27`, modification `2026-09-03T22:55:53`, title `LAWF 26 Music Card 090326`, and caption “Lafayette Art & Wine Festival Music Lineup 2026.” BAYLINK has September 19–20. | Matched. This is a detailed music schedule, not an undated ambience photograph. Caption correctly identifies September 3 version; preserve the entire chart and provide full-image viewing for small text. |
| event-bark | Graphic visibly says Saturday September 19, 2026, 10 a.m.–5 p.m., William Street Park, San Jose. BAYLINK has September 19, 2026, William Street Park, San Jose. | Matched. Accepted image is the official homepage rendition at 600 × 294; do not upscale the source file or crop event date/location. |

No material date, event, location, author or year mismatch was found. The media records remain unchanged after this second review.
