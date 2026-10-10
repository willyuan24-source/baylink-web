# Adding or reusing an image

The checklist for anyone who adds an editorial image or points a page at one, including content-only pull requests. Since the WEB-IMAGES change (D8 image ladder), `npm run images:variants` builds each image's srcset. Media records no longer contain one.

中文摘要：新增或替换图片时，记录里不要写 `srcSet`；把 `rights` 和 `coverOk` 写进记录，或写进 `src/data/media-rights-overlay.json`；然后依次运行 `npm run pretest`、`npm run images:variants`、`npm test`，并把生成的图片文件和 `src/data/generated/` 下的三个文件一起提交。只是让页面改用一张已登记的图片时，不运行也不会让测试失败，但会少省一些流量。

## Checklist

1. **The file.** Put a WebP original under `public/guides/<folder>/`. Do not end its name with `-small`, `-800` or `-1200`, because those suffixes belong to the generated sizes. Resize and convert only: no crops, retouching or colour edits.
2. **The record.** Register it in the media JSON that `src/data/guide-media.ts` imports, with `src`, `width`, `height`, `kind`, `alt`, `caption`, `credit` and `creditUrl`, as before. Do **not** add `srcSet`, because the ladder writes it. `tests/image-manifest.test.ts` fails on any `"srcSet"` key, and `node scripts/codemods/registry-srcset.mjs` removes it.
3. **Rights and cover review.** A new image key needs a structured `rights` record and an explicit `coverOk`, either in its record or in `src/data/media-rights-overlay.json` (applied last). Without them, `tests/editorial-media-coverage.test.ts` fails with "a new image needs …". Only keys listed in `scripts/data/media-rights-baseline.json` (registered before 2026-10-09) get a warning instead.
   - `rights.basis` is one of `official`, `permission`, `press-kit`, `promo-editorial`, `public-domain`, `cc`, `owner` or `ai`. Every basis except `owner` and `ai` needs an `https://` `evidenceUrl`. `scope`, `grantedAt` (YYYY-MM-DD) and `promoAllowed` are optional.
   - AI-generated art is `basis: "ai"`, even when BAYLINK owns it. `getCover()` never uses it as the cover of an event, offer or opening.
   - `coverOk: false` vetoes the image as a cover, and `coverOk: true` approves it.
4. **Generate, then test.** Run these in order:
   ```
   npm run pretest          # refreshes the slim home catalog, which decides which images the home shows
   npm run images:variants  # -small/-800/-1200 files, the manifest and the runtime table; no network, a few seconds
   npm test                 # its pretest step refreshes the home catalog's srcsets from the new table
   ```
   Commit the new files under `public/guides/` together with `src/data/generated/image-manifest.json`, `image-ladder.json` and `home-catalog.json`.
5. **Budgets.** Rungs must stay within 90 KB (800 w) and 150 KB (1200 w). If one cannot fit even at the lowest quality step, `images:variants` lists it. Add it to `scripts/data/image-budget-exceptions.json` with a reason, or the tests and `verify:images` fail.

## What fails when a step is skipped

| Change | Without `npm run images:variants` |
|---|---|
| Add, replace, rename or remove a registered image | `image-manifest.test.ts` fails ("the generated ladder table belongs to today's image registry"). A stale table drops **every** page to the plain `-small` + original srcset, so this check is a hard failure. A new image without its `-small` file also fails `editorial-media-coverage.test.ts`. |
| Point a page at an image that is already registered (or stop showing one) | Nothing fails. The page renders with the plain srcset. The test run and `npm run verify:images` print a note, and running the generator gives the image its 800/1200 sizes. |
| Leave a `-800`/`-1200` file behind by hand | `verify:images` fails on stray rungs. The generator deletes the rungs it made when their image leaves the registry. |
