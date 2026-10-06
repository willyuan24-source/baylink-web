import { MONTHLY_EVENTS } from '../data/monthly-edition';
import { getEventStatus } from './monthly';

export type AiLocalGoal = 'all' | 'learn' | 'build' | 'community';
const EVENT_GOALS: Record<string, AiLocalGoal[]> = {
  'ai-conference-sf-2026': ['learn', 'build'],
  'pyladies-snowflake-ai-data-2026': ['learn', 'community'],
  'runtime-modal-sf-2026': ['build'],
  'llmday-san-francisco-q4-2026': ['build'],
  'oakland-civic-ai-design-sprint-2026': ['learn', 'community'],
  'surrealdb-mastra-shared-memory-2026': ['build'],
  'n8n-sf-tech-week-workshop-2026': ['learn', 'build'],
  'oss4ai-agent-day-menlo-park-2026': ['build', 'community'],
};

export function selectAiLocalEvents({ today, goal = 'all', week = 'all', includeEnded = false }: { today: string; goal?: AiLocalGoal; week?: string; includeEnded?: boolean }) {
  return MONTHLY_EVENTS.filter(event => Object.hasOwn(EVENT_GOALS, event.id)
    && (includeEnded || getEventStatus(event, today) !== 'ended')
    && (goal === 'all' || EVENT_GOALS[event.id].includes(goal))
    && (week === 'all' || (week === 'ai-week' ? event.startDate <= '2026-10-03' : event.startDate >= '2026-10-05')));
}
