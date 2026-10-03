import aliases from '../data/event-id-aliases.json';

/** Keep previously shared links and saved references after an editorial duplicate is merged. */
export const canonicalEventId = (id: string): string => Object.hasOwn(aliases, id) ? aliases[id as keyof typeof aliases] : id;
