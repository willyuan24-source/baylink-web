import type { Guide } from '../../data/guides';
import { guideKindOf } from './guide-kind';

// The reader's 问 BayBay question (GuideActions only): its own module, so /guides does not carry these sentences (UI9-GUIDES,
// route JS ≤ base). It moved here from guide-facts.ts unchanged.

/**
 * The question BayBay starts with, by the guide's kind (H75): what to do first for a task, the half day for an outing, my city's
 * entry for a directory, what still works this week for a deals board; never a generic "出发前" prompt (GUIDE-10). School and
 * district guides keep the enrollment-steps prompt that asks only for area and grade, never a child's details (the same
 * wording and rule as bayBayPageQuestions' "整理入学步骤" in src/lib/baybay-conversation.ts, copied so the guide route
 * does not load the assistant module; the title goes in front so a /plan?q= link still names the guide). The guide's
 * 问 BayBay opens it as a draft the reader can edit (H32); it is never sent by itself.
 */
export function guideBayBayQuestion(guide: Pick<Guide, 'slug' | 'category' | 'tags' | 'blocks'>, t: (zh: string, en: string) => string, title: string): string {
  switch (guideKindOf(guide)) {
    case 'school':
      return t(`我正在读《${title}》。根据这篇学校与学区指南，帮我整理入学步骤、要到官网核实的时间和材料类别。只需了解地区与年级，不要让我在聊天中提交孩子个人资料或证件。`,
        `I'm reading "${title}". Using this school and district guide, outline enrollment steps, dates to check on official websites and categories of required documents. Ask only for my area and grade, and do not ask me to submit a child's personal details or documents in chat.`);
    case 'outing':
      return t(`我正在读《${title}》。请根据这篇指南，帮我把半天怎么走排一下，并告诉我先要确认什么。`, `I'm reading "${title}". Using this guide, how should I plan the half day, and what should I confirm first?`);
    case 'directory':
      return t(`我正在读《${title}》。请根据这篇目录，帮我找我所在城市的官方入口和电话；先问我住在哪个城市。`, `I'm reading "${title}". Using this directory, find the official link and phone number for my city; ask me which city I live in first.`);
    case 'deals':
      return t(`我正在读《${title}》。请根据这篇优惠攻略，告诉我这周还能用哪些、分别要什么条件。`, `I'm reading "${title}". Using this deals guide, which offers can I still use this week, and what does each require?`);
    default:
      return t(`我正在读《${title}》。请根据这篇指南，告诉我第一步做什么、该联系谁、要准备什么。`, `I'm reading "${title}". Using this guide, what is my first step, who do I contact, and what should I prepare?`);
  }
}
