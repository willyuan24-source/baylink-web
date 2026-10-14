import type { Guide, GuideBlock } from '../../data/guides';
import { guideTopicOf } from '../../data/guide-topics';

/**
 * What kind of help a guide gives, for the words BayBay starts with (H75, BB-1013-14): a task checklist asks "what first,
 * what to bring", an outing "how to spend the half day, what to check before going", a directory "which entry is mine", a
 * deals board "what still works this week". Schools keep their own privacy-safe prompts (baybay-conversation.ts).
 * No guide corpus here: the guide page and the BayBay panel both import it.
 */
export type GuideKind = 'school' | 'deals' | 'directory' | 'outing' | 'task';

const DIRECTORY: ReadonlySet<GuideBlock['type']> = new Set(['utility-directory', 'contact-directory', 'useful-platforms', 'city-exploration', 'shopping-directory']);

/** A school or district guide, including K-12 transfers ("k12" slug, 学年中转入 tag): BayBay asks only for area and grade there. */
export const isSchoolGuide = (guide: Pick<Guide, 'slug' | 'tags'>): boolean =>
  guide.tags.includes('学校与学区') || guide.tags.includes('学年中转入') || /(?:^|-)(?:schools?|k12)(?:-|$)/.test(guide.slug);

export function guideKindOf(guide: Pick<Guide, 'slug' | 'category' | 'tags' | 'blocks'>): GuideKind {
  if (guide.category === 'education' || isSchoolGuide(guide)) return 'school';
  if (guide.blocks.some(block => block.type === 'freebies') || /(?:^|-)(?:freebies|perks)(?:-|$)/.test(guide.slug)) return 'deals';
  if (guide.blocks.some(block => DIRECTORY.has(block.type))) return 'directory';
  return guideTopicOf(guide) === 'outings' ? 'outing' : 'task';
}

type Copy = { zh: string; en: string };
/** The two page chips the BayBay panel shows on a guide of each kind (label, then the question it sends). */
export const GUIDE_KIND_PROMPTS: Readonly<Record<Exclude<GuideKind, 'school'>, readonly { label: Copy; question: Copy }[]>> = {
  task: [
    { label: { zh: '我该先办哪一步？', en: 'What do I do first?' },
      question: { zh: '根据这篇指南，我该先办哪一步？要联系谁？只用文中和它列出的官方来源。', en: 'Using this guide, what should I do first, and who do I contact? Use only the guide and the official sources it lists.' } },
    { label: { zh: '要带哪些材料？', en: 'What should I bring?' },
      question: { zh: '根据这篇指南，办这件事要准备哪些材料和信息？文中没写到的，告诉我该去哪个官方来源查。', en: 'Using this guide, what documents and information should I prepare? For anything the guide does not cover, tell me which official source to check.' } },
  ],
  outing: [
    { label: { zh: '排一下半天怎么走', en: 'Plan the half day' },
      question: { zh: '根据这篇攻略，帮我把半天怎么走排一下：先去哪、每站停多久、怎么过去。', en: 'Using this guide, plan my half day: where to start, how long to stay at each stop and how to get between them.' } },
    { label: { zh: '出发前核实什么', en: 'What to check before going' },
      question: { zh: '根据这篇攻略，哪些日期、资格、费用或预约条件需要再到原文列出的来源核实？只说明已有资料，不把攻略更新时间当作实时查询。', en: 'Using this guide, which dates, eligibility rules, costs or bookings should I recheck on the sources it lists? Use only what is here; the guide’s update date is not a live check.' } },
  ],
  directory: [
    { label: { zh: '找我所在城市的入口', en: 'Find my city’s entry' },
      question: { zh: '根据这篇目录，帮我找我所在城市的官方入口和电话；先问我住在哪个城市。', en: 'Using this directory, find the official link and phone number for my city; ask me which city I live in first.' } },
    { label: { zh: '先比较哪几项', en: 'What to compare first' },
      question: { zh: '根据这篇目录，选择时先比较哪几项？只用文中写到的内容。', en: 'Using this directory, what should I compare first when choosing? Use only what the guide says.' } },
  ],
  deals: [
    { label: { zh: '这周还能用哪些？', en: 'What still works this week?' },
      question: { zh: '根据这篇优惠攻略，这周还能用哪些？分别要什么条件？只说文中列出的条目。', en: 'Using this deals guide, which offers can I still use this week, and what does each require? Only the ones listed here.' } },
    { label: { zh: '哪些不用消费？', en: 'Which need no purchase?' },
      question: { zh: '根据这篇优惠攻略，哪些福利不用消费就能领？要预约或要会员的分开列。', en: 'Using this deals guide, which perks need no purchase? List the ones that need a booking or a membership separately.' } },
  ],
};
