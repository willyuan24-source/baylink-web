type ContextPhotoUse = {
  purpose: 'venue' | 'theme';
  eventIds: readonly string[];
};

/**
 * Explicit editorial approvals for archival place photos and thematic photos.
 * They are not photographs of the advertised event. A venue photo may only be
 * reused for its reviewed venue; event photos and posters remain event-specific.
 * Captions and source links are checked by the media audit alongside this list.
 */
export const EVENT_CONTEXT_PHOTOS: Readonly<Record<string, ContextPhotoUse>> = {
  'ferry-market': { purpose: 'venue', eventIds: ['oct2026-foodwise-flour-craft-demo', 'oct2026-foodwise-fall-fruit'] },
  'presidio': { purpose: 'venue', eventIds: ['nov2026-presidio-dia-muertos-diwali'] },
  'expanded-peninsula-hiller': { purpose: 'venue', eventIds: ['hiller-starlight-nights-nov13-2026'] },
  'region-filoli-house': { purpose: 'venue', eventIds: ['filoli-holidays-from-nov14-2026'] },
  'expanded-coyote-hills': { purpose: 'venue', eventIds: ['nov2026-coyote-hills-kids-birding'] },
  'roundup-south-existing-belmont': { purpose: 'venue', eventIds: ['belmont-centennial-fest-2026'] },
  'roundup-chase-center': { purpose: 'venue', eventIds: ["sf-warriors-heat-november-2026","sf-journey-final-frontier-november-2026"] },
  'roundup-sap-center': { purpose: 'venue', eventIds: ["sj-sharks-flames-nov2-2026","sj-don-omar-nov-2026","sj-mon-laferte-nov-2026","sj-smashing-pumpkins-nov-2026"] },
  'roundup-oakland-arena': { purpose: 'venue', eventIds: ["oakland-xg-the-core-november-2026","oakland-jo-koy-november-2026"] },
  'roundup-levis-stadium': { purpose: 'venue', eventIds: ["santa-clara-49ers-raiders-nov-2026","santa-clara-49ers-seahawks-nov-2026","santa-clara-bruno-mars-oct-2026"] },
  'water-lantern-festival-promo': { purpose: 'theme', eventIds: ['foster-city-water-lantern-festival-2026'] },
  'coverage-yerba-buena': { purpose: 'venue', eventIds: [
    'sf-african-arts-festival-2026', 'sf-quinteto-latino-lunchtime-2026',
    'sf-ybg-dance-day-2026', 'sf-indigenous-peoples-day-2026',
  ] },
  'coverage-redwood-port': { purpose: 'venue', eventIds: ['redwood-city-portfest-2026'] },
  'coverage-rio-vista': { purpose: 'venue', eventIds: ['rio-vista-bass-derby-2026'] },
  'coverage-petaluma-river': { purpose: 'venue', eventIds: ['petaluma-witches-wizards-water-2026'] },
  'region-omca': { purpose: 'venue', eventIds: ['oakland-omca-dia-muertos-2026', 'oakland-omca-friday-finale-2026'] },
  'coverage-laptop': { purpose: 'theme', eventIds: [
    'ai-conference-sf-2026', 'pyladies-snowflake-ai-data-2026', 'llmday-san-francisco-q4-2026',
    'runtime-modal-sf-2026', 'n8n-sf-tech-week-workshop-2026',
    'surrealdb-mastra-shared-memory-2026', 'oss4ai-agent-day-menlo-park-2026',
  ] },
  'coverage-wine': { purpose: 'theme', eventIds: [
    'tiburon-wine-festival-2026', 'sonoma-harvest-fair-gala-2026', 'napa-harvest-after-dark-2026',
  ] },
  'coverage-stage': { purpose: 'theme', eventIds: [
    'walnut-creek-diablo-improv-2026', 'bay-area-musical-improv-festival-2026', 'palo-alto-addams-family-opening-2026',
  ] },
  'coverage-classic-car': { purpose: 'theme', eventIds: ['novato-nostalgia-days-2026'] },
};

export const isApprovedEventContextPhoto = (imageKey: string, eventId: string) =>
  Object.hasOwn(EVENT_CONTEXT_PHOTOS, imageKey) && EVENT_CONTEXT_PHOTOS[imageKey].eventIds.includes(eventId);
