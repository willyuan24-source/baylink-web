import { MONTHLY_EVENTS } from './monthly-edition';
import { currentFreebies } from './october-offers';
import { septemberOpenings } from './september-openings';
import { additionalOctoberOpenings } from './october-openings-extra';
import { communityDiscoveryOpenings } from './community-discovery-openings';
import { eventShare, offerShare, openingShare } from '../lib/editorial-share';
import type { MonthlyEvent } from './monthly-types';
import type { FreebieOffer } from '../components/FreebieBoard';
import type { SeptemberOpening } from './september-openings';

export const currentOpenings = [...septemberOpenings, ...additionalOctoberOpenings, ...communityDiscoveryOpenings].sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.verifiedAt.localeCompare(a.verifiedAt) || (b.openedOn || '').localeCompare(a.openedOn || '') || a.name.localeCompare(b.name));
export type LocalDiscovery = { kind: 'event'; event: MonthlyEvent } | { kind: 'offer'; offer: FreebieOffer } | { kind: 'opening'; shop: SeptemberOpening };
export const localDiscoveries: LocalDiscovery[] = [...MONTHLY_EVENTS.map(event => ({ kind: 'event' as const, event })), ...currentFreebies.map(offer => ({ kind: 'offer' as const, offer })), ...currentOpenings.map(shop => ({ kind: 'opening' as const, shop }))];
export const discoveryShare = (item: LocalDiscovery) => item.kind === 'event' ? eventShare(item.event) : item.kind === 'offer' ? offerShare(item.offer) : openingShare(item.shop);
export const getLocalDiscovery = (kind: string, id: string) => localDiscoveries.find(item => item.kind === kind && discoveryShare(item).id === id);
