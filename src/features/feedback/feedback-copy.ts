import type { FeedbackFailure } from './feedback-api';
import type { FeedbackKind } from './open-feedback';

import type { Copy } from './say';
export { say, type Copy } from './say';

/** The sheet's copy: Simplified Chinese with its English (Traditional from OpenCC). Loaded with the sheet, not the entry links. */

export const REASON_LABELS: Record<string, Copy> = {
  'find-events': { zh: '找活动', en: 'Finding events' },
  'get-help': { zh: '办事', en: 'Getting something done' },
  'ask-baybay': { zh: '问 BayBay', en: 'Asking BayBay' },
  plan: { zh: '计划行程', en: 'Planning a day' },
  outdated: { zh: '已过期', en: 'Out of date' },
  'wrong-time': { zh: '时间不对', en: 'Wrong time' },
  'wrong-place': { zh: '地点不对', en: 'Wrong place' },
  'wrong-price': { zh: '价格不对', en: 'Wrong price' },
  'broken-link': { zh: '链接打不开', en: 'Link doesn’t work' },
  closed: { zh: '已取消或关门', en: 'Cancelled or closed' },
  'wrong-answer': { zh: '答错了', en: 'Wrong answer' },
  'too-slow': { zh: '太慢', en: 'Too slow' },
  'not-answered': { zh: '没答到点上', en: 'Didn’t answer it' },
  other: { zh: '其他', en: 'Something else' },
};

export const SHEET_COPY: Record<FeedbackKind, { title: Copy; lede: Copy; legend: Copy; textLabel: Copy; textHint: Copy }> = {
  page: {
    title: { zh: '反馈与报错', en: 'Feedback' },
    lede: { zh: '哪里不好用、看不懂，或者你希望我们加什么，都可以告诉我们。', en: 'Tell us what is hard to use, unclear or missing.' },
    legend: { zh: '你刚才在做什么？', en: 'What were you doing?' },
    textLabel: { zh: '哪里不对，或者你的建议（选填）', en: 'What went wrong, or your idea (optional)' },
    textHint: { zh: '请不要填写证件号码、密码等敏感信息。', en: 'Please leave out ID numbers, passwords and other sensitive details.' },
  },
  content: {
    title: { zh: '这条信息有误？', en: 'Something wrong here?' },
    lede: { zh: '告诉我们哪里不对，编辑会去官方来源核对后更正。', en: 'Tell us what is wrong. An editor checks the official source and corrects it.' },
    legend: { zh: '哪里不对？', en: 'What is wrong?' },
    textLabel: { zh: '正确的信息是？（选填）', en: 'What is the correct information? (optional)' },
    textHint: { zh: '有官方链接或通知的话，写上更快核对。', en: 'An official link or notice helps us check faster.' },
  },
  baybay: {
    title: { zh: 'BayBay 哪里没答好？', en: 'What went wrong with BayBay?' },
    lede: { zh: '只发送你在这里写的内容，不会附带对话记录。', en: 'Only what you write here is sent, never the conversation.' },
    legend: { zh: '问题是？', en: 'The problem' },
    textLabel: { zh: '补充说明（选填）', en: 'Anything to add (optional)' },
    textHint: { zh: '比如你想问什么、哪里答错了。', en: 'For example what you wanted to know, or what was wrong.' },
  },
};

export const COMMON_COPY = {
  about: { zh: '关于：', en: 'About: ' },
  chooseOne: { zh: '请先选一项', en: 'Please choose one' },
  contactLabel: { zh: '联系方式（选填）', en: 'Contact (optional)' },
  contactHint: { zh: '想收到回复，可以留邮箱或微信号。', en: 'Leave an email or WeChat ID if you would like a reply.' },
  attached: { zh: '会一起发送：页面类型、语言、字号和网站版本。不含网址、账号或其他内容。反馈保存 90 天。', en: 'Sent along: the page type, language, text size and site version. No address, account or anything else. Kept for 90 days.' },
  /** A report about one item also sends that item's id (the payload's entity), so its disclosure names it. */
  attachedItem: { zh: '会一起发送：页面类型、这条信息的编号、语言、字号和网站版本。不含网址、账号或其他内容。反馈保存 90 天。', en: 'Sent along: the page type, this item’s id, the language, text size and site version. No address, account or anything else. Kept for 90 days.' },
  privacy: { zh: '隐私说明', en: 'Privacy' },
  send: { zh: '发送反馈', en: 'Send feedback' },
  sending: { zh: '正在发送…', en: 'Sending…' },
  cancel: { zh: '取消', en: 'Cancel' },
  close: { zh: '关闭', en: 'Close' },
  closeSheet: { zh: '关闭反馈', en: 'Close feedback' },
  thanksTitle: { zh: '收到了，谢谢你！', en: 'Thank you, we have it.' },
  thanksBody: { zh: '每一条反馈我们都会看。需要回复时，会用你留下的联系方式找你。', en: 'We read every message. If you left a contact, we will use it to reply when needed.' },
  characters: { zh: '字', en: 'characters' },
  testerNote: { zh: '内测模式已开启', en: 'Tester mode is on' },
  testerLeave: { zh: '退出内测', en: 'Leave the test' },
  testerLeft: { zh: '已退出内测，反馈按钮不再显示。', en: 'You have left the test. The feedback button is gone.' },
  testerContact: { zh: '测试编号 ', en: 'Tester ' },
} satisfies Record<string, Copy>;

export const FAILURE_COPY: Record<FeedbackFailure, Copy> = {
  invalid: { zh: '内容格式有误，请检查后再发。', en: 'Something in the form is not valid. Please check and try again.' },
  rate: { zh: '发送太频繁了，请一分钟后再试。', en: 'Too many messages at once. Please try again in a minute.' },
  daily: { zh: '今天已经发了 10 条，明天再来；着急的话请发邮件给我们。', en: 'You have sent 10 today. Please try tomorrow, or email us if it is urgent.' },
  global: { zh: '今天的反馈已满，请明天再试；着急的话请发邮件给我们。', en: 'We have reached today’s limit. Please try tomorrow, or email us if it is urgent.' },
  unavailable: { zh: '暂时没发出去，你写的内容还在，请稍后再试。', en: 'It did not go through. Your text is still here; please try again shortly.' },
};
