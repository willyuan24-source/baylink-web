import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { UserData } from '../src/lib/types';
import type { AppContextValue } from '../src/app/context';
import type { Outing, OutingDraft, OutingResult } from '../src/lib/outings';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/together' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { OutingForm } = await import('../src/features/outings/OutingForm');
const { OutingDetail } = await import('../src/features/outings/OutingDetail');
const { OutingTimePoll } = await import('../src/features/outings/OutingTimePoll');
const { OutingsHub } = await import('../src/features/outings/OutingsHub');
const { OutingDiscussion, OutingReport } = await import('../src/features/outings/OutingDiscussion');
const { useOutingSession, outingSessionKey } = await import('../src/features/outings/outing-session');
const { outings } = await import('../src/lib/outings');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { guides } = await import('../src/data/guides');
const { getGuideMedia, GUIDE_IMAGES } = await import('../src/data/guide-media');
const { getListingImage } = await import('../src/lib/offer-media');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const coverGuide = guides.find(guide => guide.slug === 'san-francisco-guide')!;
const coverEvent = MONTHLY_EVENTS.find(event => getListingImage(event.imageKey))!;
const now = Date.parse('2026-09-30T18:00:00Z');
const user = { id: 'member', token: 'member-token', nickname: 'Neighbour', email: 'member@example.test', city: 'Fremont', role: 'user', contactType: 'email', contactValue: 'member@example.test', isBanned: false, isPhoneVerified: true } as UserData;
const host = { ...user, id: 'host', token: 'host-token', nickname: 'Host' };
const initial: OutingDraft = { title: '周六公园散步', description: '仅用于隔离测试的虚构小队。', eventId: null, date: '2026-10-17', startTime: '14:00', endTime: '16:00', city: 'Fremont', venue: 'Public park entrance', capacity: 3, costNote: '交通餐饮各自支付，门票待核实。', transport: 'transit', language: 'any' };
const outing = (patch: Partial<Outing> = {}): Outing => ({ ...initial, id: 'outing-fixture', startAt: Date.parse('2026-10-17T21:00:00Z'), endAt: Date.parse('2026-10-17T23:00:00Z'), timezone: 'America/Los_Angeles', status: 'open', revision: 4, planVersion: 2, host: { id: host.id, nickname: host.nickname, verified: true }, confirmedCount: 1, me: null, createdAt: now, updatedAt: now, ...patch });
const signIn = (account: UserData | null) => account ? localStorage.setItem('currentUser', JSON.stringify(account)) : localStorage.removeItem('currentUser');
const noop = () => {};
function FormHarness({ account = host, existing, draft = initial, onSaved = noop }: { account?: UserData; existing?: Outing; draft?: OutingDraft; onSaved?: (result: OutingResult) => void }) {
  const session = useOutingSession(account);
  return <OutingForm initial={draft} outing={existing} session={session} onSaved={onSaved} onCancel={noop} />;
}
const form = (props: React.ComponentProps<typeof FormHarness> = {}) => <MemoryRouter><FormHarness key={outingSessionKey(props.account || host)} {...props} /></MemoryRouter>;
function DiscussionHarness({ item, account = user }: { item: Outing; account?: UserData }) {
  const session = useOutingSession(account);
  const [current, setCurrent] = React.useState(item);
  const app = { user: account, blockedUserIds: [], openUserProfile: noop } as unknown as AppContextValue;
  return <OutingDiscussion outing={current} app={app} session={session} refreshOuting={async () => { try { setCurrent((await outings.get(current.id)).outing); return true; } catch { return false; } }} />;
}
const memberOuting = (patch: Partial<Outing> = {}) => outing({ confirmedCount: 2, me: { userId: user.id, role: 'member', status: 'confirmed', confirmedVersion: 2 }, ...patch });
const appFor = (account: UserData | null, extras: Partial<AppContextValue> = {}) => ({ user: account, blockedUserIds: [], openUserProfile: noop, handleToggleBlockUser: noop, setShowLogin: noop, showToast: noop, ...extras }) as unknown as AppContextValue;
const detail = (account: UserData | null = user, extras: Partial<AppContextValue> = {}) => <MemoryRouter><OutingDetail key={outingSessionKey(account)} id={outing().id} app={appFor(account, extras)} onBack={noop} /></MemoryRouter>;
function PollHarness({ item, account = host, onSaved = noop }: { item: Outing; account?: UserData; onSaved?: (result: OutingResult) => void }) {
  const session = useOutingSession(account), [current, setCurrent] = React.useState(item);
  return <OutingTimePoll outing={current} session={session} onRefresh={async () => true} onUpdated={result => { setCurrent(result.outing); onSaved(result); }}/>;
}
const timePoll = (patch: Partial<NonNullable<Outing['timePoll']>> = {}): NonNullable<Outing['timePoll']> => ({ id: 'poll-fixture', status: 'open', planVersion: 2, createdAt: now, eligibleCount: 2, repliedCount: 0, myAnswers: null,
  options: [{ id: 'option-1', date: '2026-10-17', startTime: '14:00', endTime: '16:00', startAt: Date.parse('2026-10-17T21:00:00Z'), endAt: Date.parse('2026-10-17T23:00:00Z'), counts: { yes: 0, maybe: 0, no: 0 } }, { id: 'option-2', date: '2026-10-18', startTime: '14:00', endTime: '16:00', startAt: Date.parse('2026-10-18T21:00:00Z'), endAt: Date.parse('2026-10-18T23:00:00Z'), counts: { yes: 0, maybe: 0, no: 0 } }], ...patch });
const hub = (account: UserData | null = user, path = '/together', extras: Partial<AppContextValue> = {}) => <MemoryRouter initialEntries={[path]}><OutingsHub app={appFor(account, extras)} /></MemoryRouter>;
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const consent = (view: ReturnType<typeof render>) => {
  fireEvent.click(view.getByRole('checkbox', { name: /我已年满 18 岁/ }));
  fireEvent.click(view.getByRole('checkbox', { name: /我已自行核对集合地点/ }));
};
beforeEach(async t => { t.mock.timers.enable({ apis: ['Date'], now }); localStorage.clear(); signIn(host); await setLocale('zh-Hans'); });
afterEach(() => cleanup());
after(() => { styles.deregister(); dom.window.close(); });

test('time poll displays current arrangement separately, saves all choices explicitly and requires host adoption confirmation', async t => {
  const current = outing({ me: { userId: host.id, role: 'host', status: 'confirmed', confirmedVersion: 2 }, timePoll: timePoll() });
  const writes: unknown[] = [];
  t.mock.method(outings, 'timePoll', async (_outing, action) => { writes.push(action); return { outing: { ...current, revision: 5 } }; });
  const view = render(<PollHarness item={current}/>);
  assert.ok(view.getByText('当前安排')); assert.ok(view.getByText(/投票仅表达时间偏好/));
  const save = view.getByRole('button', { name: '保存我的时间选择' }) as HTMLButtonElement;
  assert.equal(save.disabled, true);
  fireEvent.click(view.getAllByRole('button', { name: '可以' })[0]);
  fireEvent.click(view.getAllByRole('button', { name: '待定' })[1]);
  assert.equal(writes.length, 0, 'choosing chips does not send a vote'); assert.equal(save.disabled, false);
  fireEvent.click(save); await view.findByText('你的时间偏好已保存，可在投票结束前修改。');
  assert.deepEqual(writes[0], { action: 'vote', pollId: 'poll-fixture', answers: { 'option-1': 'yes', 'option-2': 'maybe' } });
  fireEvent.click(view.getAllByRole('button', { name: '选择这个时间…' })[1]);
  assert.equal(writes.length, 1); assert.ok(view.getByRole('group', { name: '确认采用时间' }));
  fireEvent.click(view.getByRole('button', { name: '确认采用并通知成员' })); await act(async () => {});
  assert.deepEqual(writes[1], { action: 'adopt', pollId: 'poll-fixture', optionId: 'option-2' });
});

test('only host can propose time polls and cancelled or stale arrangements cannot vote', async () => {
  const item = memberOuting({ timePoll: timePoll() }); signIn(user);
  const view = render(<PollHarness item={item} account={user}/>);
  assert.equal(view.queryByRole('button', { name: '选择这个时间…' }), null);
  assert.equal(view.queryByRole('button', { name: '提出 2–3 个候选时间' }), null);
  view.rerender(<PollHarness key="stale" item={{ ...item, me: { ...item.me!, confirmedVersion: 1 } }} account={user}/>);
  assert.equal((view.getByRole('button', { name: '保存我的时间选择' }) as HTMLButtonElement).disabled, true);
  assert.ok(view.getByText('请先在上方确认最新安排，再参与协调。'));
  view.rerender(<PollHarness key="cancelled" item={{ ...item, status: 'cancelled' }} account={user}/>);
  assert.equal(view.queryByRole('button', { name: '保存我的时间选择' }), null);
  view.rerender(<PollHarness key="guest" item={{ ...item, me: null }} account={user}/>);
  assert.equal(view.queryByText('小队时间投票'), null);
});

test('time poll creation offers bounded concrete dates and preserves retry identity on an uncertain response', async t => {
  const item = outing({ me: { userId: host.id, role: 'host', status: 'confirmed', confirmedVersion: 2 } }), writes: Array<{ action: unknown; key: string }> = [];
  t.mock.method(outings, 'timePoll', async (_outing, action, key) => { writes.push({ action, key }); throw { status: 503 }; });
  const view = render(<PollHarness item={item}/>);
  fireEvent.click(view.getByRole('button', { name: '提出 2–3 个候选时间' }));
  fireEvent.change(view.getAllByLabelText('日期')[1], { target: { value: '2026-10-18' } });
  fireEvent.click(view.getByRole('button', { name: '加一个候选时间' }));
  assert.equal(view.getAllByLabelText('日期').length, 3); assert.equal(view.queryByRole('button', { name: '加一个候选时间' }), null);
  fireEvent.click(view.getByRole('button', { name: '移除' }));
  fireEvent.click(view.getByRole('button', { name: '发起投票，暂不改期' })); await view.findByRole('alert');
  fireEvent.click(view.getByRole('button', { name: '发起投票，暂不改期' })); await act(async () => {});
  assert.equal(writes.length, 2); assert.equal(writes[0].key, writes[1].key);
  assert.deepEqual(writes[0].action, { action: 'create', options: [{ date: '2026-10-17', startTime: '14:00', endTime: '16:00' }, { date: '2026-10-18', startTime: '14:00', endTime: '16:00' }] });
});

test('creating an outing requires explicit adult and public-place consent and sends one request while pending', async t => {
  const pending = deferred<OutingResult>(), writes: Record<string, unknown>[] = [], saved: OutingResult[] = [];
  const storageBefore = Array.from({ length: localStorage.length }, (_, index) => { const key = localStorage.key(index)!; return [key, localStorage.getItem(key)]; });
  t.mock.method(api, 'request', async (_path: string, options: RequestInit) => { writes.push(JSON.parse(String(options.body))); return pending.promise; });
  const view = render(<React.StrictMode>{form({ onSaved: value => saved.push(value) })}</React.StrictMode>);
  const publish = view.getByRole('button', { name: '发布小队' }) as HTMLButtonElement;
  assert.equal(publish.disabled, true); assert.equal(writes.length, 0);
  assert.ok(view.getByText(/不会公开私人地址或联系方式/));
  consent(view); assert.equal(publish.disabled, false);
  fireEvent.click(publish); fireEvent.click(publish);
  assert.equal(writes.length, 1); assert.equal(writes[0].date, '2026-10-17'); assert.equal(writes[0].adultConsent, true); assert.equal(writes[0].publicPlaceConsent, true);
  assert.ok(writes[0].idempotencyKey); assert.equal(saved.length, 0, 'pending network work is not a published outing');
  await act(async () => pending.resolve({ outing: outing() })); assert.equal(saved.length, 1);
  assert.deepEqual(Array.from({ length: localStorage.length }, (_, index) => { const key = localStorage.key(index)!; return [key, localStorage.getItem(key)]; }), storageBefore, 'private form text is not persisted into shared browser storage');
});

test('an uncertain create can retry the same intent without duplicating it and preserves all editable text', async t => {
  const writes: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (_path: string, options: RequestInit) => { writes.push(JSON.parse(String(options.body))); throw { status: 503 }; });
  const view = render(form()); consent(view);
  fireEvent.click(view.getByRole('button', { name: '发布小队' })); await view.findByRole('alert');
  assert.equal((view.getByRole('textbox', { name: '活动与同行说明' }) as HTMLTextAreaElement).value, initial.description);
  fireEvent.click(view.getByRole('button', { name: '发布小队' })); await act(async () => {});
  assert.equal(writes[0].idempotencyKey, writes[1].idempotencyKey);
  fireEvent.change(view.getByRole('textbox', { name: '小队名称' }), { target: { value: '更新后的散步名称' } });
  fireEvent.click(view.getByRole('button', { name: '发布小队' })); await act(async () => {});
  assert.notEqual(writes[2].idempotencyKey, writes[1].idempotencyKey);
});

test('AI only creates a preview until adopted, resets consent, and never publishes or invents a linked event', async t => {
  const requests: string[] = [];
  t.mock.method(api, 'request', async (path: string) => { requests.push(path); return { source: 'ai', answer: '请核对公共集合地点。', questions: ['具体在哪个入口？'], missing: ['venue'], draft: { title: 'AI 建议的名称', city: 'Oakland', eventId: 'not-a-real-event' } }; });
  const view = render(form()); consent(view);
  view.getByText('可选：让 AI 帮我起草').closest('details')!.open = true;
  fireEvent.change(view.getByRole('textbox', { name: '描述你的同行想法' }), { target: { value: '周六下午从 Fremont 坐公共交通出发。' } });
  fireEvent.click(view.getByRole('button', { name: '生成草稿' })); await view.findByText('具体在哪个入口？');
  assert.equal((view.getByRole('textbox', { name: '小队名称' }) as HTMLInputElement).value, initial.title);
  fireEvent.click(view.getByRole('button', { name: '采用草稿后逐项检查' }));
  assert.equal((view.getByRole('textbox', { name: '小队名称' }) as HTMLInputElement).value, 'AI 建议的名称');
  assert.equal((view.getByRole('checkbox', { name: /我已年满 18 岁/ }) as HTMLInputElement).checked, false);
  assert.equal((view.getByRole('button', { name: '发布小队' }) as HTMLButtonElement).disabled, true);
  assert.equal(view.queryByText(/not-a-real-event/), null); assert.deepEqual(requests, ['/ai/outing-draft']);
});

test('changing an AI request or account discards its late private result instead of replacing current input', async t => {
  const pending = deferred<unknown>(); let signal: AbortSignal | null | undefined;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit) => { signal = options.signal; return pending.promise; });
  const view = render(form()); view.getByText('可选：让 AI 帮我起草').closest('details')!.open = true;
  const input = view.getByRole('textbox', { name: '描述你的同行想法' });
  fireEvent.change(input, { target: { value: '第一份私人需求' } }); fireEvent.click(view.getByRole('button', { name: '生成草稿' }));
  fireEvent.change(input, { target: { value: '我改主意了，第二份需求' } }); assert.equal(signal?.aborted, true);
  signIn(user); view.rerender(form({ account: user }));
  await act(async () => pending.resolve({ source: 'ai', answer: '旧账号私人结果', questions: [], missing: [], draft: { title: '不应出现' } }));
  assert.equal(view.queryByText('旧账号私人结果'), null);
  assert.equal((view.getByRole('textbox', { name: '描述你的同行想法', hidden: true }) as HTMLTextAreaElement).value, '');
});

test('adopting AI suggestions preserves fields edited before, during and after generation, including deliberately cleared fields', async t => {
  const pending = deferred<unknown>(), paths: string[] = [];
  t.mock.method(api, 'request', async (path: string) => { paths.push(path); return pending.promise; });
  const view = render(form());
  fireEvent.change(view.getByRole('combobox', { name: '人数上限（包含你）' }), { target: { value: '6' } });
  fireEvent.change(view.getByRole('textbox', { name: '公共集合地点' }), { target: { value: '' } });
  view.getByText('可选：让 AI 帮我起草').closest('details')!.open = true;
  fireEvent.change(view.getByRole('textbox', { name: '描述你的同行想法' }), { target: { value: '10月17日一共4个人在 Oakland Public entrance 散步。' } });
  fireEvent.click(view.getByRole('button', { name: '生成草稿' }));
  fireEvent.change(view.getByLabelText('参加日期'), { target: { value: '2026-10-18' } });
  await act(async () => pending.resolve({ source: 'ai', answer: '先看这份建议。', questions: [], missing: [], draft: { title: 'AI 提议的步行小队', date: '2026-10-17', capacity: 4, city: 'Oakland', venue: 'Public entrance', costNote: 'AI 原有费用建议' } }));
  await view.findByRole('button', { name: '采用草稿后逐项检查' });
  assert.equal((view.getByRole('textbox', { name: '小队名称' }) as HTMLInputElement).value, initial.title, 'preview must not mutate the form');
  fireEvent.change(view.getByRole('textbox', { name: '费用与报名说明' }), { target: { value: '交通各自支付，其他待确认。' } });
  consent(view);
  fireEvent.click(view.getByRole('button', { name: '采用草稿后逐项检查' }));
  assert.equal((view.getByRole('combobox', { name: '人数上限（包含你）' }) as HTMLSelectElement).value, '6');
  assert.equal((view.getByLabelText('参加日期') as HTMLInputElement).value, '2026-10-18');
  assert.equal((view.getByRole('textbox', { name: '公共集合地点' }) as HTMLInputElement).value, '');
  assert.equal((view.getByRole('textbox', { name: '费用与报名说明' }) as HTMLTextAreaElement).value, '交通各自支付，其他待确认。');
  assert.equal((view.getByRole('textbox', { name: '小队名称' }) as HTMLInputElement).value, 'AI 提议的步行小队', 'untouched initial values may be improved');
  assert.equal((view.getByRole('checkbox', { name: /我已年满 18 岁/ }) as HTMLInputElement).checked, false);
  assert.equal((view.getByRole('checkbox', { name: /我已自行核对集合地点/ }) as HTMLInputElement).checked, false);
  assert.equal((view.getByRole('button', { name: '发布小队' }) as HTMLButtonElement).disabled, true);
  assert.deepEqual(paths, ['/ai/outing-draft']);
});

test('answering one of two AI questions retains its wording, original intent and prior answers on the next round', async t => {
  const calls: { path: string; payload: Record<string, unknown> }[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    calls.push({ path, payload: JSON.parse(String(options.body)) });
    return calls.length === 1
      ? { source: 'ai', answer: '先确认集合入口和人数。', questions: ['在哪个公共入口集合？', '一共几个人？'], missing: ['venue', 'capacity'], draft: { title: '周六散步建议' } }
      : calls.length === 2
        ? { source: 'ai', answer: '入口已记录，再确认人数。', questions: ['一共几个人？'], missing: ['capacity'], draft: { title: '周六散步建议', venue: 'Ferry Building 正门' } }
        : { source: 'ai', answer: '入口和人数都已记录，发布前还需要核对。', questions: [], missing: [], draft: { title: '周六散步建议', venue: 'Ferry Building 正门', capacity: 4 } };
  });
  const view = render(form()); view.getByText('可选：让 AI 帮我起草').closest('details')!.open = true;
  const originalIntent = '10月17日14:00到16:00散步，各自公共交通前往。';
  fireEvent.change(view.getByRole('textbox', { name: '描述你的同行想法' }), { target: { value: originalIntent } });
  fireEvent.click(view.getByRole('button', { name: '生成草稿' }));
  const entrance = await view.findByRole('textbox', { name: '在哪个公共入口集合？' });
  assert.equal((view.getByRole('button', { name: '补充并更新草稿' }) as HTMLButtonElement).disabled, true);
  fireEvent.change(entrance, { target: { value: 'Ferry Building 正门' } });
  fireEvent.click(view.getByRole('button', { name: '补充并更新草稿' }));
  await view.findByText('入口已记录，再确认人数。');
  assert.equal(calls[1].payload.intent, originalIntent);
  assert.deepEqual(calls[1].payload.answers, [{ question: '在哪个公共入口集合？', answer: 'Ferry Building 正门' }], 'an unanswered question must not become an invented preference');
  fireEvent.change(view.getByRole('textbox', { name: '一共几个人？' }), { target: { value: '4 人，包含我' } });
  fireEvent.click(view.getByRole('button', { name: '补充并更新草稿' }));
  await view.findByText('入口和人数都已记录，发布前还需要核对。');
  assert.equal(calls[2].payload.intent, originalIntent);
  assert.deepEqual(calls[2].payload.answers, [{ question: '在哪个公共入口集合？', answer: 'Ferry Building 正门' }, { question: '一共几个人？', answer: '4 人，包含我' }]);
  assert.equal((view.getByRole('textbox', { name: '公共集合地点' }) as HTMLInputElement).value, initial.venue, 'follow-up still only previews a draft');
  assert.ok(calls.every(call => call.path === '/ai/outing-draft'));
});

test('failed AI follow-up preserves the answer for retry and changing the original idea clears old answer context', async t => {
  const calls: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => {
    assert.equal(path, '/ai/outing-draft'); calls.push(JSON.parse(String(options.body)));
    if (calls.length === 2) throw { status: 503 };
    return calls.length === 1
      ? { source: 'ai', answer: '先确认公共集合点。', questions: ['在哪个入口？'], missing: ['venue'], draft: {} }
      : { source: 'ai', answer: '更新的建议仍需要你核对。', questions: [], missing: [], draft: { title: '待核对的草稿' } };
  });
  const view = render(form()); view.getByText('可选：让 AI 帮我起草').closest('details')!.open = true;
  const intent = view.getByRole('textbox', { name: '描述你的同行想法' });
  fireEvent.change(intent, { target: { value: '10月17日散步。' } }); fireEvent.click(view.getByRole('button', { name: '生成草稿' }));
  fireEvent.change(await view.findByRole('textbox', { name: '在哪个入口？' }), { target: { value: 'Ferry Building 正门' } });
  fireEvent.click(view.getByRole('button', { name: '补充并更新草稿' })); await view.findByRole('alert');
  assert.equal((view.getByRole('textbox', { name: '在哪个入口？' }) as HTMLTextAreaElement).value, 'Ferry Building 正门');
  fireEvent.click(view.getByRole('button', { name: '补充并更新草稿' })); await view.findByText('更新的建议仍需要你核对。');
  assert.deepEqual(calls[2], calls[1], 'an uncertain follow-up must not duplicate or discard the answer');
  fireEvent.change(intent, { target: { value: '现在改为10月18日去图书馆。' } });
  assert.equal(view.queryByText('已补充的信息'), null); assert.equal(view.queryByRole('button', { name: '采用草稿后逐项检查' }), null);
  fireEvent.click(view.getByRole('button', { name: '生成草稿' })); await view.findByText('更新的建议仍需要你核对。');
  assert.equal(calls[3].intent, '现在改为10月18日去图书馆。'); assert.equal(calls[3].answers, undefined);
});

test('editing requires renewed public-place consent and sends only edit-contract fields', async t => {
  const writes: { path: string; method?: string; payload: Record<string, unknown> }[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => { writes.push({ path, method: options.method, payload: JSON.parse(String(options.body)) }); return { outing: outing() }; });
  const view = render(form({ existing: outing({ me: { userId: host.id, role: 'host', status: 'confirmed', confirmedVersion: 2 } }) })); consent(view);
  fireEvent.change(view.getByRole('textbox', { name: '公共集合地点' }), { target: { value: 'New public library entrance' } });
  const publicConsent = view.getByRole('checkbox', { name: /我已自行核对集合地点/ }) as HTMLInputElement;
  assert.equal(publicConsent.checked, false); assert.equal((view.getByRole('button', { name: '保存更新' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(publicConsent); fireEvent.click(view.getByRole('button', { name: '保存更新' })); await act(async () => {});
  assert.equal(writes.length, 1); assert.equal(writes[0].method, 'PATCH'); assert.equal(writes[0].payload.revision, 4);
  assert.equal(writes[0].payload.venue, 'New public library entrance'); assert.equal(writes[0].payload.publicPlaceConsent, true);
  assert.equal('adultConsent' in writes[0].payload, false, 'create-only consent is not a valid PATCH field');
});

test('a rejected date retains the draft and a visible recovery message rather than claiming an outing was saved', async t => {
  let saved = 0;
  t.mock.method(api, 'request', async () => { throw { status: 400, error: '这一天不是已确认的活动场次。' }; });
  const view = render(form({ onSaved: () => saved++ })); consent(view);
  fireEvent.click(view.getByRole('button', { name: '发布小队' })); await view.findByRole('alert');
  assert.equal((view.getByLabelText('参加日期') as HTMLInputElement).value, '2026-10-17'); assert.equal(saved, 0);
  assert.equal((view.getByRole('button', { name: '发布小队' }) as HTMLButtonElement).disabled, false);
});

test('requested, withdrawn and removed users never fetch or render member discussion', async t => {
  signIn(user); let reads = 0;
  t.mock.method(api, 'request', async () => { reads++; throw new Error('Private discussion must not be requested'); });
  for (const status of ['requested', 'left', 'removed', 'declined'] as const) {
    const view = render(<DiscussionHarness item={outing({ me: { userId: user.id, role: 'member', status, confirmedVersion: 2 } })} />);
    assert.ok(view.getByText(/讨论内容仅对当前已确认成员开放/));
    assert.equal(view.queryByRole('textbox', { name: '给小队发消息' }), null); view.unmount();
  }
  assert.equal(reads, 0);
});

test('confirmed members can read after a changed plan but cannot speak on the old confirmation', async t => {
  signIn(user);
  t.mock.method(api, 'request', async () => ({ messages: [{ id: 'existing-message', outingId: initialOutingId, senderId: host.id, senderName: 'Host', text: '集合入口已更改，请重新确认。', createdAt: now }] }));
  const initialOutingId = outing().id;
  const view = render(<React.StrictMode><DiscussionHarness item={memberOuting({ planVersion: 3 })} /></React.StrictMode>);
  await view.findByText('集合入口已更改，请重新确认。');
  assert.ok(view.getByText(/请先在上方确认新的安排/)); assert.equal(view.queryByRole('button', { name: '发送消息' }), null);
});

test('discussion removes cached private messages after access is revoked and rechecks before recovery', async t => {
  signIn(user); let denied = false, reads = 0;
  t.mock.method(api, 'request', async (path: string) => {
    if (!path.endsWith('/messages')) return { outing: memberOuting() };
    reads++; if (denied) throw { status: 403 };
    return { messages: [{ id: 'private-message', outingId: outing().id, senderId: host.id, senderName: host.nickname, text: '仅成员可见的集合说明', createdAt: now }] };
  });
  const view = render(<DiscussionHarness item={memberOuting()} />); await view.findByText('仅成员可见的集合说明');
  fireEvent.change(view.getByRole('textbox', { name: '给小队发消息' }), { target: { value: '保留未发送草稿' } });
  denied = true; fireEvent.click(view.getByRole('button', { name: '刷新讨论' }));
  await view.findByText(/已隐藏之前读取的消息/); await act(async () => {});
  assert.equal(view.queryByText('仅成员可见的集合说明'), null); assert.equal(view.queryByRole('textbox', { name: '给小队发消息' }), null);
  denied = false; fireEvent.click(view.getByRole('button', { name: '刷新讨论' })); await view.findByText('仅成员可见的集合说明'); await act(async () => {});
  assert.equal((view.getByRole('textbox', { name: '给小队发消息' }) as HTMLTextAreaElement).value, '保留未发送草稿');
  assert.equal((view.getByRole('button', { name: '发送消息' }) as HTMLButtonElement).disabled, false); assert.equal(reads, 3);
});

test('a revoked message write also hides prior discussion instead of leaving an active composer', async t => {
  signIn(user);
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => {
    if (options.method === 'POST') throw { status: 404 };
    return { messages: [{ id: 'private-message', outingId: outing().id, senderId: host.id, senderName: host.nickname, text: '旧的私密讨论', createdAt: now }] };
  });
  const view = render(<DiscussionHarness item={memberOuting()} />); await view.findByText('旧的私密讨论');
  fireEvent.change(view.getByRole('textbox', { name: '给小队发消息' }), { target: { value: '提交时权限已变化' } });
  fireEvent.click(view.getByRole('button', { name: '发送消息' })); await view.findByText(/已隐藏之前读取的消息/);
  assert.equal(view.queryByText('旧的私密讨论'), null); assert.equal(view.queryByRole('button', { name: '发送消息' }), null);
});

test('two successful messages use refreshed revisions and never present optimistic unsaved messages', async t => {
  signIn(user); let revision = 4; const sent: Record<string, unknown>[] = [], storedMessages: { id: string; outingId: string; senderId: string; senderName: string; text: string; createdAt: number }[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method === 'POST') {
      const payload = JSON.parse(String(options.body)); sent.push(payload);
      assert.equal(payload.revision, revision, 'a second post must use the version after the first saved message'); revision++;
      const message = { id: `message-${sent.length}`, outingId: outing().id, senderId: user.id, senderName: user.nickname, text: payload.text, createdAt: now };
      storedMessages.push(message); return { message };
    }
    return path.endsWith('/messages') ? { messages: storedMessages } : { outing: memberOuting({ revision }) };
  });
  const view = render(<DiscussionHarness item={memberOuting()} />); await view.findByText(/还没有消息/);
  const composer = view.getByRole('textbox', { name: '给小队发消息' });
  for (const text of ['第一条确认集合', '第二条补充交通']) {
    fireEvent.change(composer, { target: { value: text } }); fireEvent.click(view.getByRole('button', { name: '发送消息' }));
    await view.findByText(text); await act(async () => {});
  }
  assert.deepEqual(sent.map(row => row.revision), [4, 5]); assert.notEqual(sent[0].idempotencyKey, sent[1].idempotencyKey);
  assert.equal((composer as HTMLTextAreaElement).value, ''); assert.equal(view.queryByRole('alert'), null);
});

test('a failed message preserves the draft and retry identity until the server confirms it', async t => {
  signIn(user); const sends: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => {
    if (options.method === 'POST') { sends.push(JSON.parse(String(options.body))); throw { status: 503 }; }
    return { messages: [] };
  });
  const view = render(<DiscussionHarness item={memberOuting()} />); await view.findByText(/还没有消息/);
  const composer = view.getByRole('textbox', { name: '给小队发消息' }); fireEvent.change(composer, { target: { value: '保留这条未发送的需求' } });
  fireEvent.click(view.getByRole('button', { name: '发送消息' })); await view.findByRole('alert');
  assert.equal((composer as HTMLTextAreaElement).value, '保留这条未发送的需求'); assert.equal(view.queryByRole('listitem'), null);
  fireEvent.click(view.getByRole('button', { name: '发送消息' })); await act(async () => {});
  assert.equal(sends.length, 2); assert.equal(sends[0].idempotencyKey, sends[1].idempotencyKey);
});

test('reports submit actual evidence once and require server acknowledgement without cancelling the outing', async t => {
  signIn(user); const writes: { path: string; payload: Record<string, unknown> }[] = []; const pending = deferred<unknown>();
  t.mock.method(api, 'request', async (path: string, options: RequestInit) => { writes.push({ path, payload: JSON.parse(String(options.body)) }); return pending.promise; });
  function ReportHarness() { const session = useOutingSession(user); return <OutingReport outingId={outing().id} messageId="message-1" session={session} onClose={noop} />; }
  const view = render(<ReportHarness />);
  fireEvent.change(view.getByRole('combobox', { name: '举报原因' }), { target: { value: 'harassment' } });
  fireEvent.change(view.getByRole('textbox', { name: '补充说明（不填写敏感资料）' }), { target: { value: '请复核这条消息。' } });
  fireEvent.click(view.getByRole('button', { name: '提交举报' })); assert.equal(view.queryByRole('status'), null); assert.equal(writes.length, 1);
  await act(async () => pending.resolve({ reportId: 'report-1' }));
  assert.ok(view.getByRole('status').textContent?.includes('不会自动取消小队'));
  assert.deepEqual(writes, [{ path: `/outings/${outing().id}/reports`, payload: { reason: 'harassment', details: '请复核这条消息。', messageId: 'message-1' } }]);
});

test('guests browse real outing facts without fetching private discussion and can sign in explicitly', async t => {
  signIn(null); let logins = 0; const reads: string[] = [];
  t.mock.method(api, 'request', async (path: string) => { reads.push(path); return { outing: outing() }; });
  const view = render(<React.StrictMode>{detail(null, { setShowLogin: () => { logins++; } })}</React.StrictMode>);
  await view.findByRole('heading', { level: 1, name: initial.title });
  assert.ok(view.getByText(/包含发起人，申请不占名额/));
  assert.equal(view.queryByRole('textbox', { name: '给发起人的说明（可选）' }), null);
  fireEvent.click(view.getByRole('button', { name: '登录后继续' })); assert.equal(logins, 1);
  assert.ok(reads.every(path => path === `/outings/${outing().id}`));
});

test('an unverified signed-in user is sent to verification without an application form or automatic request', async t => {
  const unverified = { ...user, isPhoneVerified: false }; signIn(unverified);
  const calls: RequestInit[] = [];
  t.mock.method(api, 'request', async (_path: string, options: RequestInit) => { calls.push(options); return { outing: outing() }; });
  const view = render(detail(unverified));
  assert.equal((await view.findByRole('link', { name: '前往个人页验证' })).getAttribute('href'), '/me');
  assert.equal(view.queryByRole('button', { name: '申请加入' }), null); assert.ok(calls.every(options => !options.method));
});

test('requesting, host acceptance refresh and explicit withdrawal change discussion access without fake participant counts', async t => {
  signIn(user); let current = outing(); const actions: Record<string, unknown>[] = []; let privateReads = 0;
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/actions')) {
      const payload = JSON.parse(String(options.body)); actions.push(payload);
      current = payload.action === 'request' ? outing({ revision: 5, me: { userId: user.id, role: 'member', status: 'requested', confirmedVersion: 2 } }) : outing({ revision: 7, me: { userId: user.id, role: 'member', status: 'left', confirmedVersion: 2 } });
      return { outing: current };
    }
    if (path.endsWith('/messages')) { privateReads++; return { messages: [{ id: 'host-message', outingId: current.id, senderId: host.id, senderName: host.nickname, text: '仅当前成员可读的集合说明', createdAt: now }] }; }
    return { outing: current };
  });
  const view = render(detail()); await view.findByRole('button', { name: '申请加入' });
  assert.equal((view.getByRole('button', { name: '申请加入' }) as HTMLButtonElement).disabled, true);
  fireEvent.change(view.getByRole('textbox', { name: '给发起人的说明（可选）' }), { target: { value: '可以坐公共交通到场' } });
  fireEvent.click(view.getByRole('checkbox', { name: /我已年满18岁/ })); fireEvent.click(view.getByRole('button', { name: '申请加入' }));
  await view.findByText('待发起人确认'); assert.equal(privateReads, 0); assert.ok(view.getByText('1 / 3'));
  assert.equal(actions[0].action, 'request'); assert.equal(actions[0].adultConsent, true); assert.equal(actions[0].note, '可以坐公共交通到场');
  current = memberOuting({ revision: 6 }); fireEvent.click(view.getByRole('button', { name: '刷新小队' }));
  await view.findByText('仅当前成员可读的集合说明'); assert.ok(view.getByText('2 / 3'));
  fireEvent.click(view.getByRole('button', { name: '退出小队' })); assert.equal(actions.length, 1, 'leaving requires the displayed confirmation');
  fireEvent.click(view.getByRole('button', { name: '确认操作' })); await view.findByText('已退出');
  assert.equal(actions[1].action, 'withdraw'); assert.equal(view.queryByText('仅当前成员可读的集合说明'), null);
  assert.equal(view.queryByRole('textbox', { name: '给小队发消息' }), null);
});

test('a host accepts one real applicant and the acknowledged roster controls the confirmed count', async t => {
  signIn(host);
  const hostMember = { userId: host.id, nickname: host.nickname, role: 'host' as const, status: 'confirmed' as const, confirmedVersion: 2 };
  const applicant = { userId: user.id, nickname: user.nickname, role: 'member' as const, status: 'requested' as const, confirmedVersion: 2, note: '这段申请说明仅发起人可见' };
  let current = outing({ me: hostMember, members: [hostMember, applicant], requestCount: 1 }); const requests: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/messages')) return { messages: [] };
    if (path.endsWith('/actions')) { const payload = JSON.parse(String(options.body)); requests.push(payload); current = { ...current, revision: 5, confirmedCount: 2, requestCount: 0, members: [hostMember, { ...applicant, status: 'confirmed' }] }; }
    return { outing: current };
  });
  const view = render(detail(host)); await view.findByText(applicant.note);
  const card = view.getByText(applicant.note).closest('li')!;
  fireEvent.click(within(card).getByRole('button', { name: '接受', exact: true })); await view.findByText('2 / 3');
  assert.deepEqual(requests.map(row => [row.action, row.userId, row.revision]), [['accept', user.id, 4]]);
  assert.equal(view.queryByRole('button', { name: '接受', exact: true }), null); assert.ok(view.getByRole('button', { name: '移除成员' }));
});

test('changed arrangements require a fresh explicit confirmation before discussion is enabled', async t => {
  signIn(user); let current = memberOuting({ planVersion: 3 }); const actions: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/messages')) return { messages: [] };
    if (path.endsWith('/actions')) { const payload = JSON.parse(String(options.body)); actions.push(payload); assert.equal(payload.adultConsent, true); current = { ...current, revision: 5, me: { userId: user.id, role: 'member', status: 'confirmed', confirmedVersion: 3 } }; }
    return { outing: current };
  });
  const view = render(detail()); const button = await view.findByRole('button', { name: '确认新的安排' });
  assert.equal((button as HTMLButtonElement).disabled, true);
  fireEvent.click(view.getByRole('checkbox', { name: /18/ })); fireEvent.click(button);
  await view.findByRole('textbox', { name: '给小队发消息' }); assert.equal(actions.length, 1); assert.equal(actions[0].action, 'reconfirm');
});

test('StrictMode public listing completes a fresh request instead of turning its aborted first mount into a fake empty result', async t => {
  signIn(null); const signals: (AbortSignal | null | undefined)[] = [];
  t.mock.method(api, 'request', async (_path: string, options: RequestInit) => { signals.push(options.signal); return { outings: [outing()], nextCursor: null }; });
  const view = render(<React.StrictMode>{hub(null)}</React.StrictMode>);
  await view.findByRole('link', { name: initial.title });
  assert.equal(view.queryByText('还没有符合条件的小队'), null);
  assert.ok(signals.some(signal => signal?.aborted)); assert.ok(signals.some(signal => !signal?.aborted));
});

test('date and city filters reach the API and survive opening a detail and returning to the list', async t => {
  signIn(user); const filters: URLSearchParams[] = [];
  t.mock.method(api, 'request', async (path: string) => {
    const url = new URL(path, 'https://example.test');
    if (url.pathname === '/outings') { filters.push(url.searchParams); return { outings: [outing()], nextCursor: null }; }
    return { outing: outing() };
  });
  const view = render(hub()); await view.findByRole('link', { name: initial.title });
  fireEvent.change(view.getByLabelText('参加日期'), { target: { value: '2026-10-17' } });
  fireEvent.change(view.getByRole('textbox', { name: '城市（可选）' }), { target: { value: 'Fremont' } });
  fireEvent.click(view.getByRole('button', { name: '筛选小队' })); await act(async () => {});
  const link = view.getByRole('link', { name: initial.title }); const url = new URL(link.getAttribute('href')!, 'https://example.test');
  assert.equal(url.searchParams.get('date'), '2026-10-17'); assert.equal(url.searchParams.get('city'), 'Fremont');
  fireEvent.click(link); await view.findByRole('heading', { level: 1, name: initial.title });
  fireEvent.click(view.getByRole('button', { name: '返回小队' })); await view.findByRole('link', { name: initial.title });
  assert.equal((view.getByLabelText('参加日期') as HTMLInputElement).value, '2026-10-17');
  assert.equal((view.getByRole('textbox', { name: '城市（可选）' }) as HTMLInputElement).value, 'Fremont');
  assert.equal(filters.at(-1)!.get('date'), '2026-10-17'); assert.equal(filters.at(-1)!.get('city'), 'Fremont');
});

test('discovery presets replace exact dates and preserve search, city aliases, language and seats through a detail visit', async t => {
  signIn(user); const requests: URLSearchParams[] = [];
  const weekend = outing({ date: '2026-10-03', startAt: Date.parse('2026-10-03T21:00:00Z'), endAt: Date.parse('2026-10-03T23:00:00Z') });
  t.mock.method(api, 'request', async (path: string) => {
    const url = new URL(path, 'https://example.test');
    if (url.pathname === '/outings') { requests.push(url.searchParams); return { outings: [url.searchParams.has('dateFrom') ? weekend : outing()], nextCursor: null }; }
    return { outing: weekend };
  });
  const view = render(hub(user, '/together?date=2026-10-17')); await view.findByRole('link', { name: initial.title });
  fireEvent.change(view.getByRole('textbox', { name: '搜索小队' }), { target: { value: '散步 & coffee' } });
  fireEvent.change(view.getByRole('textbox', { name: '城市（可选）' }), { target: { value: '舊金山' } });
  view.getByText('更多筛选').closest('details')!.open = true;
  fireEvent.change(view.getByRole('combobox', { name: '沟通语言' }), { target: { value: 'zh' } });
  fireEvent.click(view.getByRole('checkbox', { name: '只看有空位' }));
  fireEvent.click(view.getByRole('button', { name: '本周末' })); await view.findByText('2026-10-03 — 2026-10-04');
  assert.deepEqual(Object.fromEntries(requests.at(-1)!), { q: '散步 & coffee', city: '舊金山', dateFrom: '2026-10-03', dateTo: '2026-10-04', language: 'zh', seats: 'open', sort: 'soonest' });
  assert.equal((view.getByLabelText('参加日期') as HTMLInputElement).value, '');
  const link = await view.findByRole('link', { name: initial.title }), destination = new URL(link.getAttribute('href')!, 'https://example.test');
  for (const [key, value] of requests.at(-1)!) assert.equal(destination.searchParams.get(key), value);
  fireEvent.click(link); await view.findByRole('heading', { level: 1, name: initial.title });
  fireEvent.click(view.getByRole('button', { name: '返回小队' })); await view.findByRole('link', { name: initial.title });
  assert.equal((view.getByRole('textbox', { name: '搜索小队' }) as HTMLInputElement).value, '散步 & coffee');
  assert.equal((view.getByRole('textbox', { name: '城市（可选）' }) as HTMLInputElement).value, '舊金山');
  assert.equal((view.getByRole('combobox', { name: '沟通语言' }) as HTMLSelectElement).value, 'zh');
  assert.equal((view.getByRole('checkbox', { name: '只看有空位' }) as HTMLInputElement).checked, true);
  assert.equal(view.getByRole('button', { name: '本周末' }).getAttribute('aria-pressed'), 'true');
  fireEvent.change(view.getByLabelText('参加日期'), { target: { value: '2026-10-17' } });
  fireEvent.click(view.getByRole('button', { name: '筛选小队' })); await act(async () => {});
  assert.equal(requests.at(-1)!.get('date'), '2026-10-17');
  assert.equal(requests.at(-1)!.has('dateFrom'), false); assert.equal(requests.at(-1)!.has('dateTo'), false);
  fireEvent.click(view.getByRole('button', { name: '未来7天' })); await act(async () => {});
  assert.equal(requests.at(-1)!.get('dateFrom'), '2026-09-30'); assert.equal(requests.at(-1)!.get('dateTo'), '2026-10-06'); assert.equal(requests.at(-1)!.has('date'), false);
  fireEvent.click(view.getByRole('button', { name: '今天' })); await act(async () => {});
  assert.equal(requests.at(-1)!.get('date'), '2026-09-30'); assert.equal(requests.at(-1)!.has('dateFrom'), false);
});

test('list failure shows retry rather than no outings and only guest intent to create requests login', async t => {
  signIn(null); let reads = 0, logins = 0;
  t.mock.method(api, 'request', async () => { if (++reads === 1) throw { status: 503 }; return { outings: [outing()], nextCursor: null }; });
  const view = render(hub(null, '/together', { setShowLogin: () => { logins++; } })); await view.findByRole('alert');
  assert.equal(view.queryByText('还没有符合条件的小队'), null); assert.equal(logins, 0);
  fireEvent.click(view.getByRole('button', { name: '重新读取' })); await view.findByRole('link', { name: initial.title });
  fireEvent.click(view.getByRole('button', { name: '发起小队' })); assert.equal(logins, 1);
  assert.equal(view.queryByRole('textbox', { name: '小队名称' }), null);
});

test('a verified host can start from a concrete filtered date while an unverified account must verify first', async t => {
  t.mock.method(api, 'request', async () => ({ outings: [outing()], nextCursor: null }));
  const view = render(hub(host, '/together?date=2026-10-17')); await view.findByRole('link', { name: initial.title });
  fireEvent.click(view.getByRole('button', { name: '发起小队' }));
  assert.equal((view.getByLabelText('参加日期') as HTMLInputElement).value, '2026-10-17');
  assert.equal((view.getByRole('button', { name: '发布小队' }) as HTMLButtonElement).disabled, true);
  const unverified = { ...user, isPhoneVerified: false }; signIn(unverified);
  view.rerender(hub(unverified, '/together?date=2026-10-17')); await view.findByRole('link', { name: initial.title });
  fireEvent.click(view.getByRole('button', { name: '发起小队' }));
  assert.ok(view.getByRole('heading', { name: '先完成验证，再发起小队' })); assert.equal(view.queryByRole('textbox', { name: '小队名称' }), null);
});

test('switching accounts discards a late private outing list and never shows the previous member records', async t => {
  signIn(user); const old = deferred<unknown>();
  t.mock.method(api, 'request', async () => localStorage.getItem('currentUser')?.includes('member-token') ? old.promise : { outings: [] });
  const view = render(hub(user, '/together?view=mine'));
  signIn(host); view.rerender(hub(host, '/together?view=mine')); await view.findByText('你的同行从这里开始');
  await act(async () => old.resolve({ outings: [memberOuting({ title: '旧账号的私人同行记录' })] }));
  assert.equal(view.queryByText('旧账号的私人同行记录'), null); assert.ok(view.getByText('你的同行从这里开始'));
});

test('cancelled and ended outings keep a withdrawal path so membership is not trapped after recruitment closes', async t => {
  signIn(user); let current = memberOuting(), writes = 0;
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/messages')) return { messages: [] };
    if (path.endsWith('/actions')) { assert.equal(JSON.parse(String(options.body)).action, 'withdraw'); writes++; current = { ...current, me: { userId: user.id, role: 'member', status: 'left', confirmedVersion: 2 }, confirmedCount: 1, revision: current.revision + 1 }; }
    return { outing: current };
  });
  for (const status of ['cancelled', 'completed'] as const) {
    current = memberOuting({ status, ...(status === 'completed' ? { date: '2026-09-29', startAt: Date.parse('2026-09-29T21:00:00Z'), endAt: Date.parse('2026-09-29T23:00:00Z') } : {}) });
    const view = render(detail()); await view.findByRole('button', { name: '退出小队' });
    assert.equal(view.queryByRole('button', { name: '申请加入' }), null); assert.equal(view.queryByRole('textbox', { name: '给小队发消息' }), null);
    fireEvent.click(view.getByRole('button', { name: '退出小队' })); fireEvent.click(view.getByRole('button', { name: '确认操作' })); await view.findByText('已退出');
    view.unmount();
  }
  assert.equal(writes, 2);
});

test('declined applicants are shown the real outcome rather than an application button the server will reject', async t => {
  signIn(user); const methods: (string | undefined)[] = [];
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => { methods.push(options.method); return { outing: outing({ me: { userId: user.id, role: 'member', status: 'declined', confirmedVersion: 2 } }) }; });
  const view = render(detail()); await view.findByText('申请未通过');
  assert.equal(view.queryByRole('button', { name: '申请加入' }), null); assert.equal(view.queryByRole('textbox', { name: '给小队发消息' }), null);
  assert.ok(methods.every(method => !method));
});

test('blocking a host hides discovery cards but preserves my outing record and its management link', async t => {
  signIn(user);
  t.mock.method(api, 'request', async (path: string) => path === '/outings/me' ? { outings: [memberOuting()] } : { outings: [memberOuting()], nextCursor: null });
  const view = render(hub(user, '/together?view=mine', { blockedUserIds: [host.id] }));
  const mineLink = await view.findByRole('link', { name: initial.title });
  const destination = new URL(mineLink.getAttribute('href')!, 'https://www.baylink.us');
  assert.equal(destination.searchParams.get('outing'), outing().id);
  assert.equal(destination.searchParams.get('view'), 'mine', 'the member can still open the record to withdraw');
  fireEvent.click(view.getByRole('button', { name: '浏览小队' }));
  await view.findByText('暂无可显示的小队');
  assert.equal(view.queryByRole('link', { name: initial.title }), null);
  fireEvent.click(view.getByRole('button', { name: '我的小队' }));
  await view.findByRole('link', { name: initial.title });
});

test('a full outing requires explicit waitlist consent, preserves retry identity and keeps applicants out of discussion even after a place opens', async t => {
  signIn(user); let current = outing({ capacity: 2, confirmedCount: 2 }), privateReads = 0;
  const actions: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/messages')) { privateReads++; return { messages: [] }; }
    if (path.endsWith('/actions')) {
      const payload = JSON.parse(String(options.body)); actions.push(payload);
      if (actions.length === 1) throw { status: 503 };
      current = { ...current, revision: current.revision + 1, me: { userId: user.id, role: 'member', status: payload.action === 'withdraw' ? 'left' : 'requested', confirmedVersion: 2, waitlisted: payload.action !== 'withdraw' } };
    }
    return { outing: current };
  });
  const view = render(detail()); const apply = await view.findByRole('button', { name: '申请候补' });
  assert.equal((apply as HTMLButtonElement).disabled, true); assert.equal(view.queryByRole('button', { name: '申请加入' }), null);
  assert.equal(privateReads, 0); assert.equal(actions.length, 0);
  fireEvent.click(view.getByRole('checkbox', { name: /我已年满18岁.*候补/ })); fireEvent.click(apply);
  await view.findByRole('alert'); assert.equal(view.queryByText('候补中，尚未加入'), null);
  fireEvent.click(view.getByRole('button', { name: '申请候补' }));
  await view.findByText('候补中，尚未加入');
  assert.equal(actions[0].waitlist, true); assert.equal(actions[0].adultConsent, true);
  assert.equal(actions[0].idempotencyKey, actions[1].idempotencyKey); assert.ok(view.getByText('2 / 2'));
  assert.equal(privateReads, 0); assert.equal(view.queryByRole('textbox', { name: '给小队发消息' }), null);
  current = { ...current, confirmedCount: 1, revision: current.revision + 1 };
  fireEvent.click(view.getByRole('button', { name: '刷新小队' })); await view.findByText('1 / 2');
  assert.ok(view.getByText('候补中，尚未加入')); assert.equal(privateReads, 0, 'a newly free place does not grant discussion access');
  assert.equal(actions.length, 2, 'refreshing must not automatically accept or reapply');
  fireEvent.click(view.getByRole('button', { name: '退出候补' })); assert.equal(actions.length, 2);
  fireEvent.click(view.getByRole('button', { name: '确认操作' })); await view.findByText('已退出');
  assert.equal(actions[2].action, 'withdraw'); assert.ok(view.getByText('1 / 2')); assert.equal(privateReads, 0);
});

test('a host reviews waitlisted applicants only when a seat is free and membership changes only after explicit acceptance', async t => {
  signIn(host);
  const owner = { userId: host.id, nickname: host.nickname, role: 'host' as const, status: 'confirmed' as const, confirmedVersion: 2 };
  const waiting = { userId: user.id, nickname: user.nickname, role: 'member' as const, status: 'requested' as const, confirmedVersion: 2, waitlisted: true, requestedAt: now, note: '候补申请私密说明' };
  let current = outing({ capacity: 2, confirmedCount: 2, me: owner, members: [owner, waiting], waitlistCount: 1, waitlistReviewNeeded: false });
  const actions: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/messages')) return { messages: [] };
    if (path.endsWith('/actions')) {
      const payload = JSON.parse(String(options.body)); actions.push(payload);
      current = { ...current, revision: current.revision + 1, confirmedCount: 2, members: [owner, { ...waiting, status: 'confirmed', waitlisted: false }], waitlistCount: 0, waitlistReviewNeeded: false };
    }
    return { outing: current };
  });
  const view = render(detail(host)); await view.findByText(waiting.note);
  assert.equal((within(view.getByText(waiting.note).closest('li')!).getByRole('button', { name: '接受', exact: true }) as HTMLButtonElement).disabled, true);
  current = { ...current, confirmedCount: 1, revision: current.revision + 1, waitlistReviewNeeded: true };
  fireEvent.click(view.getByRole('button', { name: '刷新小队' })); await view.findByText(/有候补申请待审核/);
  assert.equal(actions.length, 0); assert.ok(view.getByText('1 / 2'));
  fireEvent.click(within(view.getByText(waiting.note).closest('li')!).getByRole('button', { name: '接受', exact: true }));
  await view.findByText('2 / 2'); assert.equal(actions.length, 1); assert.equal(actions[0].action, 'accept'); assert.equal(actions[0].userId, user.id);
  assert.equal(view.queryByRole('button', { name: '接受', exact: true }), null);
});

test('waitlist consent cannot carry over to changed arrangements or silently become consent to an open-place application', async t => {
  signIn(user); let current = outing({ capacity: 2, confirmedCount: 2 }); const methods: (string | undefined)[] = [];
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => { methods.push(options.method); return { outing: current }; });
  const view = render(detail()); await view.findByRole('button', { name: '申请候补' });
  fireEvent.click(view.getByRole('checkbox', { name: /我已年满18岁.*候补/ }));
  assert.equal((view.getByRole('button', { name: '申请候补' }) as HTMLButtonElement).disabled, false);
  current = { ...current, revision: 5, planVersion: 3, venue: 'New public library entrance' };
  fireEvent.click(view.getByRole('button', { name: '刷新小队' })); await view.findByText('New public library entrance', { exact: false });
  assert.equal((view.getByRole('checkbox', { name: /我已年满18岁.*候补/ }) as HTMLInputElement).checked, false);
  assert.equal((view.getByRole('button', { name: '申请候补' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(view.getByRole('checkbox', { name: /我已年满18岁.*候补/ }));
  current = { ...current, revision: 6, confirmedCount: 1 };
  fireEvent.click(view.getByRole('button', { name: '刷新小队' })); const apply = await view.findByRole('button', { name: '申请加入' });
  assert.equal((apply as HTMLButtonElement).disabled, true); assert.equal((view.getByRole('checkbox', { name: /我已年满18岁/ }) as HTMLInputElement).checked, false);
  assert.ok(methods.every(method => !method), 'reviewing a change never submits either kind of application');
});

test('an empty intermediate search page retains pagination and does not claim the search is exhausted', async t => {
  signIn(null); const requests: URLSearchParams[] = [];
  t.mock.method(api, 'request', async (path: string) => {
    const query = new URL(path, 'https://example.test').searchParams; requests.push(query);
    return query.has('cursor') ? { outings: [outing()], nextCursor: null } : { outings: [], nextCursor: 'later-visible-results' };
  });
  const view = render(hub(null, '/together?q=散步&seats=open&language=zh'));
  await view.findByText('还有小队待查看');
  const results = within(view.getByRole('region', { name: '小队搜索结果' }));
  assert.equal(results.queryByText('还没有符合条件的小队'), null);
  assert.equal(results.queryByRole('button', { name: '发起小队' }), null, 'an empty scan page is not a final no-results state');
  fireEvent.click(results.getByRole('button', { name: '查看更多小队' }));
  await view.findByRole('link', { name: initial.title });
  assert.equal(requests.length, 2); assert.equal(requests[1].get('cursor'), 'later-visible-results');
  assert.equal(requests[1].get('q'), '散步'); assert.equal(requests[1].get('seats'), 'open'); assert.equal(requests[1].get('language'), 'zh');
  assert.equal(view.queryByText('还有小队待查看'), null); assert.equal(view.queryByRole('button', { name: '查看更多小队' }), null);
});

test('hosts can remove or decline blocked members without unblocking while ordinary members still hide blocked people', async t => {
  signIn(host); let blockChanges = 0;
  const owner = { userId: host.id, nickname: host.nickname, role: 'host' as const, status: 'confirmed' as const, confirmedVersion: 2 };
  const confirmed = { userId: user.id, nickname: '被屏蔽的已确认成员', role: 'member' as const, status: 'confirmed' as const, confirmedVersion: 2 };
  const waiting = { userId: 'waiting-member', nickname: '被屏蔽的候补申请人', role: 'member' as const, status: 'requested' as const, confirmedVersion: 2, waitlisted: true, requestedAt: now, note: '仅队长管理可见的候补说明' };
  let current = outing({ capacity: 3, confirmedCount: 2, me: owner, members: [owner, confirmed, waiting], waitlistCount: 1, waitlistReviewNeeded: true });
  const actions: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/messages')) throw { status: 403 };
    if (path.endsWith('/actions')) {
      const payload = JSON.parse(String(options.body)); actions.push(payload);
      current = { ...current, revision: current.revision + 1, confirmedCount: 1, members: current.members!.map(person => person.userId === payload.userId ? { ...person, status: payload.action === 'remove' ? 'removed' : 'declined', waitlisted: false } : person), ...(payload.action === 'decline' ? { waitlistCount: 0, waitlistReviewNeeded: false } : {}) };
    }
    return { outing: current };
  });
  const view = render(detail(host, { blockedUserIds: [user.id, waiting.userId], handleToggleBlockUser: () => { blockChanges++; } }));
  const memberCard = (await view.findByRole('button', { name: confirmed.nickname })).closest('li')!;
  const waitlistCard = view.getByRole('button', { name: waiting.nickname }).closest('li')!;
  assert.ok(within(memberCard).getByText('已屏蔽')); assert.ok(within(waitlistCard).getByText('已屏蔽'));
  assert.equal((within(waitlistCard).getByRole('button', { name: '接受', exact: true }) as HTMLButtonElement).disabled, true);
  fireEvent.click(within(memberCard).getByRole('button', { name: '移除成员' })); assert.equal(actions.length, 0);
  fireEvent.click(view.getByRole('button', { name: '确认操作' })); await view.findByText('已移出');
  assert.equal(actions[0].action, 'remove'); assert.equal(actions[0].userId, user.id); assert.ok(view.getByText('1 / 3'));
  fireEvent.click(within(view.getByRole('button', { name: waiting.nickname }).closest('li')!).getByRole('button', { name: '婉拒' }));
  fireEvent.click(view.getByRole('button', { name: '确认操作' })); await view.findByText('申请未通过');
  assert.equal(actions[1].action, 'decline'); assert.equal(actions[1].userId, waiting.userId); assert.equal(blockChanges, 0);
  view.unmount();
  signIn(user); current = memberOuting({ confirmedCount: 3, members: [owner, confirmed, { ...waiting, status: 'confirmed', waitlisted: false }] });
  const memberView = render(detail(user, { blockedUserIds: [waiting.userId] }));
  await memberView.findByRole('heading', { level: 1, name: initial.title });
  assert.equal(memberView.queryByRole('button', { name: waiting.nickname }), null); assert.equal(memberView.queryByText(waiting.note), null);
  assert.equal(memberView.queryByRole('button', { name: '移除成员' }), null); assert.equal(memberView.queryByRole('button', { name: '婉拒' }), null);
});

test('calendar export rechecks current confirmed membership before creating a file', async t => {
  signIn(user); let reads = 0, downloads = 0;
  t.mock.method(api, 'request', async (path: string) => path.endsWith('/messages') ? { messages: [] } : (reads++, { outing: memberOuting() }));
  t.mock.method(URL, 'createObjectURL', () => { downloads++; return 'blob:outing-calendar-test'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  t.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', () => {});
  const view = render(detail(user));
  fireEvent.click(await view.findByRole('button', { name: '将集合时间存入日历' }));
  await view.findByText(/已生成日历文件/);
  assert.equal(reads, 2); assert.equal(downloads, 1);
});

test('calendar export refuses a changed plan or membership and replaces the stale detail', async t => {
  signIn(user); let current = memberOuting(), downloads = 0;
  t.mock.method(api, 'request', async (path: string) => path.endsWith('/messages') ? { messages: [] } : { outing: current });
  t.mock.method(URL, 'createObjectURL', () => { downloads++; return 'blob:must-not-download'; });
  const view = render(detail(user));
  const button = await view.findByRole('button', { name: '将集合时间存入日历' });
  current = memberOuting({ planVersion: 3, revision: 5 });
  fireEvent.click(button);
  await view.findByText(/小队安排或你的参加状态已变化/);
  assert.equal(downloads, 0); assert.equal(view.queryByRole('button', { name: '将集合时间存入日历' }), null);
  assert.ok(view.getByText('安排有变化，请重新确认'));
});

test('a failed calendar refresh never exports a stale file and waitlisted members cannot export', async t => {
  signIn(user); let failure = false, downloads = 0;
  let current = memberOuting();
  t.mock.method(api, 'request', async (path: string) => {
    if (path.endsWith('/messages')) return { messages: [] };
    if (failure) throw { status: 503 };
    return { outing: current };
  });
  t.mock.method(URL, 'createObjectURL', () => { downloads++; return 'blob:must-not-download'; });
  const view = render(detail(user));
  const button = await view.findByRole('button', { name: '将集合时间存入日历' });
  failure = true; fireEvent.click(button);
  await view.findByRole('alert'); assert.equal(downloads, 0);
  view.unmount(); failure = false;
  current = outing({ me: { userId:user.id,role:'member',status:'requested',confirmedVersion:2,waitlisted:true },confirmedCount:3 });
  const waiting = render(detail(user)); await waiting.findByText('候补中，尚未加入');
  assert.equal(waiting.queryByRole('button', { name: '将集合时间存入日历' }), null);
});

test('a guide inspiration URL previews its cover, carries it into creation and sends only the catalog reference', async t => {
  const writes: Record<string, unknown>[] = [];
  const cover = { kind: 'guide' as const, id: coverGuide.slug };
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method === 'POST') { writes.push(JSON.parse(String(options.body))); return { outing: outing({ cover }) }; }
    if (path === `/outings/${outing().id}`) return { outing: outing({ cover }) };
    return { outings: [], nextCursor: null };
  });
  const view = render(hub(host, `/together?coverKind=guide&coverId=${coverGuide.slug}&date=${initial.date}`));
  await act(async () => {});
  const inspiration = within(view.getByRole('region', { name: '已带入的参考内容' }));
  assert.equal(inspiration.getByRole('img').getAttribute('src'), getGuideMedia(coverGuide).cover.src);
  assert.equal(inspiration.getByRole('link', { name: `参考内容 · ${coverGuide.title}` }).getAttribute('href'), `https://www.baylink.us/guides/${coverGuide.slug}`);
  assert.equal(writes.length, 0, 'following a content link never publishes an outing');
  fireEvent.click(inspiration.getByRole('button', { name: '用这张配图发起小队' }));
  const editor = within(view.getByRole('region', { name: '发起小队' }));
  assert.equal(editor.getByRole('img').getAttribute('src'), getGuideMedia(coverGuide).cover.src);
  assert.equal((editor.getByRole('textbox', { name: '公共集合地点' }) as HTMLInputElement).value, '', 'reference content must not invent a meeting place');
  assert.equal((editor.getByLabelText('参加日期') as HTMLInputElement).value, initial.date);
  for (const [name, value] of [['小队名称', initial.title], ['活动与同行说明', initial.description], ['城市', initial.city], ['公共集合地点', initial.venue], ['费用与报名说明', initial.costNote]]) {
    fireEvent.change(editor.getByRole('textbox', { name }), { target: { value } });
  }
  fireEvent.change(editor.getByLabelText('集合时间'), { target: { value: initial.startTime } });
  fireEvent.change(editor.getByLabelText('预计结束时间'), { target: { value: initial.endTime } });
  consent(view); fireEvent.click(editor.getByRole('button', { name: '发布小队' }));
  await view.findByRole('heading', { level: 1, name: initial.title });
  assert.equal(writes.length, 1); assert.deepEqual(writes[0].cover, cover);
  assert.equal(writes[0].eventId, null); assert.equal(writes[0].date, initial.date); assert.equal(writes[0].venue, initial.venue);
  assert.equal('imageUrl' in writes[0], false, 'source URLs remain catalog-owned rather than arbitrary user input');
});

test('choosing a guide cover on a linked-event draft leaves its event, date and meeting place unchanged', async t => {
  const writes: Record<string, unknown>[] = [];
  const linked = { ...initial, eventId: coverEvent.id };
  t.mock.method(api, 'request', async (_path: string, options: RequestInit) => {
    const payload = JSON.parse(String(options.body)); writes.push(payload);
    return { outing: outing({ eventId: coverEvent.id, cover: payload.cover }) };
  });
  const view = render(form({ draft: linked }));
  assert.equal(view.getByRole('img').getAttribute('src'), GUIDE_IMAGES[coverEvent.imageKey].src);
  fireEvent.click(view.getByRole('button', { name: '从攻略与资讯选图' }));
  fireEvent.change(view.getByRole('searchbox', { name: '搜索地点、攻略、活动或店名' }), { target: { value: coverGuide.title } });
  fireEvent.click(view.getByRole('button', { name: new RegExp(coverGuide.title) }));
  assert.equal(view.getByRole('img').getAttribute('src'), getGuideMedia(coverGuide).cover.src);
  assert.equal((view.getByLabelText('参加日期') as HTMLInputElement).value, initial.date);
  assert.equal((view.getByRole('textbox', { name: '公共集合地点' }) as HTMLInputElement).value, initial.venue);
  assert.equal(view.getByRole('link', { name: coverEvent.title }).getAttribute('href'), `/events/${coverEvent.id}`);
  consent(view); fireEvent.click(view.getByRole('button', { name: '发布小队' })); await act(async () => {});
  assert.equal(writes.length, 1); assert.equal(writes[0].eventId, coverEvent.id);
  assert.equal(writes[0].date, initial.date); assert.equal(writes[0].venue, initial.venue);
  assert.deepEqual(writes[0].cover, { kind: 'guide', id: coverGuide.slug });
});

test('host editing reopens a saved guide cover and persists an explicit text-card choice across another edit', async t => {
  const owner = { userId: host.id, role: 'host' as const, status: 'confirmed' as const, confirmedVersion: 2 };
  let current = outing({ me: owner, cover: { kind: 'guide', id: coverGuide.slug } });
  const writes: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/messages')) return { messages: [] };
    if (options.method === 'PATCH') {
      const payload = JSON.parse(String(options.body)); writes.push(payload);
      current = { ...current, cover: payload.cover, revision: current.revision + 1 };
    }
    return { outing: current };
  });
  const view = render(detail(host));
  fireEvent.click(await view.findByRole('button', { name: '编辑安排' }));
  assert.equal(view.getByRole('img').getAttribute('src'), getGuideMedia(coverGuide).cover.src);
  assert.equal(view.getByRole('button', { name: '从攻略与资讯选图' }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(view.getByRole('button', { name: '文字卡片' }));
  assert.equal(view.queryByRole('img'), null); assert.equal(writes.length, 0, 'cover changes remain a private unsaved draft');
  consent(view); fireEvent.click(view.getByRole('button', { name: '保存更新' }));
  await view.findByRole('button', { name: '编辑安排' });
  assert.equal(writes.length, 1); assert.deepEqual(writes[0].cover, { kind: 'card' });
  assert.equal(writes[0].revision, 4); assert.equal(writes[0].date, initial.date); assert.equal(writes[0].venue, initial.venue);
  assert.equal('planVersion' in writes[0], false, 'the server owns decisions about plan versions');
  fireEvent.click(view.getByRole('button', { name: '编辑安排' }));
  assert.equal(view.getByRole('button', { name: '文字卡片' }).getAttribute('aria-pressed'), 'true');
  assert.equal(view.queryByRole('img'), null);
});

test('old outing list rows gain designed or linked-event covers while keeping facts and detail actions intact', async t => {
  signIn(null);
  const standalone = outing({ id: 'legacy-standalone', title: '无需配图也清楚的散步小队' });
  const linked = outing({ id: 'legacy-linked', title: '沿用活动配图的小队', eventId: coverEvent.id });
  t.mock.method(api, 'request', async () => ({ outings: [standalone, linked], nextCursor: null }));
  const view = render(hub(null));
  const standaloneCard = (await view.findByRole('link', { name: standalone.title })).closest('article')!;
  const linkedCard = view.getByRole('link', { name: linked.title }).closest('article')!;
  assert.equal(within(standaloneCard).queryByRole('img'), null);
  assert.ok(within(standaloneCard).getByText('BAYLINK · TOGETHER'));
  assert.equal(within(linkedCard).getByRole('img').getAttribute('src'), GUIDE_IMAGES[coverEvent.imageKey].src);
  assert.equal(within(linkedCard).getByRole('link', { name: `参考内容 · ${coverEvent.title}` }).getAttribute('href'), `https://www.baylink.us/events/${coverEvent.id}`);
  for (const [row, card] of [[standalone, standaloneCard], [linked, linkedCard]] as const) {
    assert.equal(within(card).getByRole('link', { name: `查看小队: ${row.title}` }).getAttribute('href'), `/together?outing=${row.id}`);
    assert.equal(within(card).getByRole('link', { name: '查看安排' }).getAttribute('href'), `/together?outing=${row.id}`);
    assert.ok(within(card).getByText(`${initial.date} · ${initial.startTime}–${initial.endTime}`));
    assert.ok(within(card).getByText(`${initial.city} · ${initial.venue}`));
    assert.ok(within(card).getByText('还可接受 2 人 · 需发起人确认'));
  }
});
