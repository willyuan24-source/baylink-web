import type { Bilingual, DialogueNode } from '../core/types';
import * as POI_DATA from '../data/pois';
import * as SCRIPT from '../data/script';

/**
 * Optional content hooks. data/script.ts may export SCRIPT_HOOKS (entry nodes per situation), GUIDE_BARKS
 * (one-off bubbles) and NPC_LINES. They are not part of the core type contract, so everything here is
 * looked up defensively and every caller has a built-in fallback.
 */

type Hooks = Record<string, string | Record<string, string>>;
const S = SCRIPT as unknown as {
  NODES: Record<string, DialogueNode>;
  SCRIPT_HOOKS?: Hooks;
  GUIDE_BARKS?: Record<string, Bilingual[]>;
  NPC_LINES?: { key: string; anchor: string; name: Bilingual; nodeId: string }[];
};

const nodes = () => S.NODES ?? {};

/** Entry node id for a situation if the content defines it (and the node exists). */
export function hook(name: string, sub?: string): string | undefined {
  const value = S.SCRIPT_HOOKS?.[name];
  const id = typeof value === 'string' ? value : sub && value && typeof value === 'object' ? value[sub] : undefined;
  return id && nodes()[id] ? id : undefined;
}

/** Text of a node (first bubble) — for speech bubbles that reuse the script's voice. */
export function nodeText(id: string | undefined): Bilingual | undefined {
  return id ? nodes()[id]?.text : undefined;
}

export function hookText(name: string, sub?: string): Bilingual | undefined {
  return nodeText(hook(name, sub));
}

/** `{key}` placeholders of a text filled per language (e.g. `{station}` in the city transit hooks). */
export function fillText(text: Bilingual, vars: Readonly<Record<string, Bilingual>>): Bilingual {
  const fill = (s: string, lang: 'zh' | 'en') => s.replace(/\{(\w+)\}/g, (all, key: string) => vars[key]?.[lang] ?? all);
  return { zh: fill(text.zh, 'zh'), en: fill(text.en, 'en') };
}

/** hookText with its placeholders filled: `hookFill('cablecarStation', { station: st.name })`. */
export function hookFill(name: string, vars: Readonly<Record<string, Bilingual>>): Bilingual | undefined {
  const text = hookText(name);
  return text ? fillText(text, vars) : undefined;
}

/** Random one-off bubble line for a situation (wait, called, edge, idle, morning, day, golden, night). */
export function bark(kind: string): Bilingual | undefined {
  const list = S.GUIDE_BARKS?.[kind];
  return Array.isArray(list) && list.length ? list[Math.floor(Math.random() * list.length)] : undefined;
}

/** Verified one-liner about a telescope/photo subject, if content provides SUBJECT_FACTS. */
export function subjectFact(key: string): { name: Bilingual; fact: Bilingual } | undefined {
  const facts = (POI_DATA as unknown as { SUBJECT_FACTS?: Record<string, { name: Bilingual; fact: Bilingual }> }).SUBJECT_FACTS;
  if (!facts) return undefined;
  const hit = facts[key] ?? Object.entries(facts).find(([name]) => key.includes(name))?.[1];
  return hit?.name && hit.fact ? hit : undefined;
}

export function npcLine(key: string | undefined): { name?: Bilingual; nodeId?: string } {
  if (!key) return {};
  const line = S.NPC_LINES?.find(item => item.key === key);
  const nodeId = [line?.nodeId, `npc.${key}`, `npc-${key}`].find(id => !!id && !!nodes()[id]);
  return { name: line?.name, nodeId };
}
