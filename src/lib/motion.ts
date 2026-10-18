/** Motion preferences in script (UI9-F): reduced motion and 简洁显示 scroll instantly, like the CSS durations go to 0. */
export const scrollBehavior = (): ScrollBehavior => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-simple')) ? 'auto' : 'smooth';
