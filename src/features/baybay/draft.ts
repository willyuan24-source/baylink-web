import type { AppContextValue } from '../../app/context';

/** The app's BayBay opener (AppLayout `openBayBay`, in the outlet context as `useApp().openBayBay`). */
export type OpenBayBay = AppContextValue['openBayBay'];

/**
 * H32: open BayBay with a question the reader finishes and sends ("问 BayBay" on a guide, the calendar, the planner).
 *
 * `openBayBay(question, { mode: 'draft' })` opens the panel with the text in the question box (up to 500 characters) and
 * the focus there; nothing is sent until the reader taps 问一下 or presses Enter. The page the reader is on goes with the
 * question as the "正在看：…" capsule (events, offers, openings and guides; `bayBayPageRef`), which the reader can dismiss.
 * Without `mode` (or with 'send') the question is asked at once.
 *
 * `bayBayDraft(openBayBay)` is that draft call as a `(question) => void`, for a component that takes an `onAsk(question)`
 * prop, e.g. in GuideDetailPage: `<GuideDetail … onAsk={bayBayDraft(openBayBay)} />`, so GuideActions' 问 BayBay prefills
 * the guide's question under 正在看：<the guide> and never sends by itself.
 */
export const bayBayDraft = (open: OpenBayBay | undefined) => (question: string) => open?.(question, { mode: 'draft' });
