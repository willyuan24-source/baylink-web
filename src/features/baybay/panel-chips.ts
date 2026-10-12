/* Panel-only data for the BayBay welcome (lazy with the panel; guide pages never load it). */

/**
 * Starter chips (plan WEB-BB-UI): one tap asks, fills the box for the reader to finish, or opens the tool.
 * `send` questions are complete; `draft` ones end where the reader adds their own detail.
 */
export type BayBayStarter = { id: string; zh: string; en: string } & ({ action: 'send' | 'draft'; zhQuestion: string; enQuestion: string } | { action: 'screenshot' | 'plan' });
export const BAYBAY_STARTERS: readonly BayBayStarter[] = [
  { id: 'weekend', zh: '本周末去哪', en: 'This weekend', action: 'send', zhQuestion: '这个周末湾区有什么值得去的活动？', enQuestion: 'What is worth doing in the Bay Area this weekend?' },
  { id: 'paperwork', zh: '办事怎么准备', en: 'Getting things done', action: 'draft', zhQuestion: '我想了解怎么办：', enQuestion: 'How do I get this done: ' },
  { id: 'letter', zh: '帮我看懂英文信', en: 'Explain an English letter', action: 'draft', zhQuestion: '帮我看看这封英文信说了什么：', enQuestion: 'Help me understand this letter: ' },
  { id: 'seniors', zh: '长辈福利与医保', en: 'Senior benefits and health care', action: 'send', zhQuestion: '家里长辈 65 岁以上住在湾区，有哪些福利和医保可以先了解？', enQuestion: 'My parents are over 65 and live in the Bay Area. Which benefits and health coverage should we look into first?' },
  { id: 'screenshot', zh: '读活动截图', en: 'Read an event screenshot', action: 'screenshot' },
  { id: 'plan', zh: '安排一天', en: 'Plan a day', action: 'plan' },
];

export type BayBayPageRef = { kind: 'event' | 'offer' | 'opening' | 'guide'; id: string };
/** The listing a reader is looking at, from the URL (any language prefix). Other pages carry no capsule. */
export function bayBayPageRef(path: string): BayBayPageRef | null {
  const pathname = path.split(/[?#]/, 1)[0].replace(/^\/(?:en|zh-Hant)(?=\/|$)/, '').replace(/\/$/, '');
  const match = /^\/(events|offers|openings|guides)\/([A-Za-z0-9_-]{1,160})$/.exec(pathname);
  if (!match) return null;
  const kind = ({ events: 'event', offers: 'offer', openings: 'opening', guides: 'guide' } as const)[match[1] as 'events' | 'offers' | 'openings' | 'guides'];
  return { kind, id: match[2] };
}

/** Three page chips on event, offer and opening pages; "这个/this" resolves to the page on the server (currentPage). */
export const BAYBAY_ENTITY_QUESTIONS: Record<'event' | 'offer' | 'opening', readonly { zh: string; en: string }[]> = {
  event: [
    { zh: '这个活动适合带长辈和孩子去吗？', en: 'Is this event good for seniors and kids?' },
    { zh: '几点开始，要不要预约？', en: 'What time does it start, and do I need to book?' },
    { zh: '怎么去，停车方便吗？', en: 'How do I get there, and is parking easy?' },
  ],
  offer: [
    { zh: '这个优惠要会员或消费吗？', en: 'Do I need a membership or a purchase for this?' },
    { zh: '怎么领取，几点去合适？', en: 'How do I get it, and when should I go?' },
    { zh: '这个优惠什么时候截止？', en: 'When does this offer end?' },
  ],
  opening: [
    { zh: '这家店现在开了吗？几点营业？', en: 'Is this place open now? What are the hours?' },
    { zh: '这家店在哪里，怎么去？', en: 'Where is it, and how do I get there?' },
    { zh: '附近还能顺便去哪？', en: 'What else is nearby?' },
  ],
};
