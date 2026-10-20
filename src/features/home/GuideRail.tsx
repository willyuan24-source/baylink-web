import { HOME_INTENTS } from '../../data/home-pathways';
import { TOPIC_LABELS } from './home-model';
import { GuideRailView, type GuideRailProps } from './GuideRailView';

/**
 * ⑥ 办事与生活指南 with the home's five intents and the guide topic names (GuideRailView.tsx draws it). HomeDiscovery renders
 * the view itself, after the page in production, and passes the same two in.
 */
export function GuideRail(props: GuideRailProps) {
  return <GuideRailView {...props} intents={HOME_INTENTS} topicLabels={TOPIC_LABELS} />;
}
