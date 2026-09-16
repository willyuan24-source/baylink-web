import { createContext, useContext } from 'react';
import type { AppContextValue } from '../app/context';
import type { EventEngagement, EventInterest } from './event-engagement';

type ParticipationContext = {
  entries: Record<string, EventEngagement>; loading: boolean; failed: boolean;
  busy: string[]; refresh: () => void; update: (id: string, value: EventInterest) => Promise<boolean>;
  app: AppContextValue | undefined;
};
export const EventParticipationContext = createContext<ParticipationContext | null>(null);
export const useEventParticipation = () => useContext(EventParticipationContext);
