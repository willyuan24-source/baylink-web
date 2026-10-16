import type { ComponentType } from 'react';
import type { PlannerWorkspaceProps } from './PlannerWorkspace';

/**
 * Node renders 行程 in one pass (the prerender and tests), as lib/planner-source.ts installs the catalog there; the browser
 * loads the workspace chunk with the catalog (plan-catalog.ts). BAYLINK_LAZY_PLAN=1 makes Node take the browser's path.
 * The specifier is built at run time on purpose: the browser bundle must not see a second, top-level-awaited import of the
 * workspace (Rollup would then split modules the workspace shares with the shell into chunks of their own).
 */
type NodeProcess = { env?: Record<string, string | undefined>; getBuiltinModule?: (id: string) => unknown };
const nodeProcess = (globalThis as { process?: NodeProcess }).process;
const specifier = ['.', 'PlannerWorkspace.tsx'].join('/');
export const nodeWorkspace: ComponentType<PlannerWorkspaceProps> | undefined = nodeProcess?.getBuiltinModule && nodeProcess.env?.BAYLINK_LAZY_PLAN !== '1'
  ? (await import(/* @vite-ignore */ specifier) as { PlannerWorkspace: ComponentType<PlannerWorkspaceProps> }).PlannerWorkspace
  : undefined;
