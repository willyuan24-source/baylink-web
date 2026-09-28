import { readSave } from '../data/save';
import { isPaid, ledgerVersion } from '../economy/ledger';

/**
 * Wave 5 · lane D (review) · "which of these ids has lane E's ledger paid", recomputed only when the ledger or the save
 * changed (`ledgerVersion()`, the save's identity: every write makes a new one, a reset drops it). The hosts ask it
 * about ten times a second (the pebbles' count, the found flag of the hosts in range) and the compass four times a
 * second while it is held: each `isPaid` decodes a base64 bitset, so asking 48 of them every step made garbage for
 * nothing on phones. `forget()` drops the memo (a reset, the ids registered, the tests).
 */
export interface PaidSet {
  (): ReadonlySet<string>;
  forget(): void;
}

export function paidSet(source: (id: string) => string, ids: () => readonly string[]): PaidSet {
  let save: unknown = null, version = -1, set: Set<string> | null = null;
  const get = (): ReadonlySet<string> => {
    const s = readSave(), v = ledgerVersion();
    if (set && s === save && v === version) return set;
    save = s; version = v;
    set = new Set();
    for (const id of ids()) { try { if (isPaid(source(id))) set.add(id); } catch { /* not payable: unfound */ } }
    return set;
  };
  return Object.assign(get, { forget: () => { set = null; version = -1; } });
}
