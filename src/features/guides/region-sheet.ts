/**
 * The 地区 sheet's chunk on /guides (UI9-GUIDES): fetched when the reader presses the 地区 ▾ chip, so the index route does not
 * carry it. GuidesHome falls back to an inline row of region chips when the fetch fails (offline, a stale deploy); a test can
 * swap `load` for a failing one.
 */
export const regionSheet = { load: () => import('./GuideRegionSheet') };
