import { useEffect } from 'react';

/**
 * The entry points' small stylesheet (feedback-entry.css), requested after the first render instead of imported: the
 * entry links sit at the end of detail, About and 404 pages and inside BayBay, so a static CSS import would put the
 * file into every one of those graphs and into every node test that imports them. Unstyled, they are still usable
 * buttons; Vite loads the chunk once and caches it.
 */
export function useFeedbackEntryStyles(): void {
  useEffect(() => { void import('./feedback-entry.css').catch(() => { /* Usable without it. */ }); }, []);
}

/** The admin panels' stylesheet, loaded the same way when an admin opens the workspace. */
export function useFeedbackAdminStyles(): void {
  useEffect(() => { void import('./feedback-admin.css').catch(() => { /* Usable without it. */ }); }, []);
}
