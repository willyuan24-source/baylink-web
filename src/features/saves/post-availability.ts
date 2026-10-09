import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

/** `live`: the listing still opens. `gone`: deleted or hidden (404/403). `unknown`: the check itself failed. */
export type PostAvailability = 'live' | 'gone' | 'unknown';
const PARALLEL = 4;
const NONE: ReadonlyMap<string, PostAvailability> = new Map();

/**
 * Whether saved neighbourhood listings still open (`GET /api/posts/:id`). A saved post is a device copy of a public
 * listing that its author may since have deleted or hidden, so My Week checks the rows it shows, and only those: up to
 * four reads at a time, each listing once per visit, cancelled when the rows leave the screen. Unchecked ids are
 * absent from the result.
 */
export function usePostAvailability(ids: readonly string[]): ReadonlyMap<string, PostAvailability> {
  const [results, setResults] = useState(NONE);
  /** Ids read or being read; an id whose read was cancelled leaves it, so it is read when it shows again. */
  const requested = useRef(new Set<string>());
  const key = ids.join('\n');
  useEffect(() => {
    const seen = requested.current;
    const queue = (key ? key.split('\n') : []).filter(id => !seen.has(id));
    if (!queue.length) return;
    queue.forEach(id => seen.add(id));
    const controller = new AbortController();
    const unsettled = new Set(queue);
    let active = 0;
    const settle = (id: string, availability: PostAvailability) => {
      if (controller.signal.aborted) return;
      unsettled.delete(id);
      setResults(previous => new Map(previous).set(id, availability));
    };
    const pump = () => {
      while (!controller.signal.aborted && active < PARALLEL && queue.length) {
        const id = queue.shift()!;
        active += 1;
        api.request(`/posts/${encodeURIComponent(id)}`, { signal: controller.signal })
          .then((post: { id?: unknown } | null) => settle(id, String(post?.id) === id ? 'live' : 'unknown'))
          .catch((error: unknown) => {
            const status = error && typeof error === 'object' ? (error as { status?: number }).status : undefined;
            settle(id, status === 404 || status === 403 ? 'gone' : 'unknown');
          })
          .finally(() => { active -= 1; pump(); });
      }
    };
    pump();
    return () => { controller.abort(); unsettled.forEach(id => seen.delete(id)); };
  }, [key]);
  return results;
}
