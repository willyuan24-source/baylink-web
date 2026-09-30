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
const { OutingsHub } = await import('../src/features/outings/OutingsHub');
const { OutingDiscussion, OutingReport } = await import('../src/features/outings/OutingDiscussion');
const { useOutingSession, outingSessionKey } = await import('../src/features/outings/outing-session');
const { outings } = await import('../src/lib/outings');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const now = Date.parse('2026-09-30T18:00:00Z');
const user = { id: 'member', token: 'member-token', nickname: 'Neighbour', email: 'member@example.test', city: 'Fremont', role: 'user', contactType: 'email', contactValue: 'member@example.test', isBanned: false, isPhoneVerified: true } as UserData;
const host = { ...user, id: 'host', token: 'host-token', nickname: 'Host' };
const initial: OutingDraft = { title: '周六公园散步', description: '仅用于隔离测试的虚构小队。', eventId: null, date: '2026-10-17', startTime: '14:00', endTime: '16:00', city: 'Fremont', venue: 'Public park entrance', capacity: 3, costNote: '交通餐饮各自支付，门票待核实。', transport: 'transit', language: 'any' };
const outing = (patch: Partial<Outing> = {}): Outing => ({ ...initial, id: 'outing-fixture', startAt: Date.parse('2026-10-17T21:00:00Z'), endAt: Date.parse('2026-10-17T23:00:00Z'), timezone: 'America/Los_Angeles', status: 'open', revision: 4, planVersion: 2, host: { id: host.id, nickname: host.nickname, verified: true }, confirmedCount: 1, me: null, createdAt: now, updatedAt: now, ...patch });
const signIn = (account: UserData | null) => account ? localStorage.setItem('currentUser', JSON.stringify(account)) : localStorage.removeItem('currentUser');
const noop = () => {};
function FormHarness({ account = host, existing, onSaved = noop }: { account?: UserData; existing?: Outing; onSaved?: (result: OutingResult) => void }) {
  const session = useOutingSession(account);
  return <OutingForm initial={initial} outing={existing} session={session} onSaved={onSaved} onCancel={noop} />;
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
const hub = (account: UserData | null = user, path = '/together', extras: Partial<AppContextValue> = {}) => <MemoryRouter initialEntries={[path]}><OutingsHub app={appFor(account, extras)} /></MemoryRouter>;
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const consent = (view: ReturnType<typeof render>) => {
  fireEvent.click(view.getByRole('checkbox', { name: /我已年满 18 岁/ }));
  fireEvent.click(view.getByRole('checkbox', { name: /我已自行核对集合地点/ }));
};
beforeEach(async t => { t.mock.timers.enable({ apis: ['Date'], now }); localStorage.clear(); signIn(host); await setLocale('zh-Hans'); });
afterEach(() => cleanup());
after(() => { styles.deregister(); dom.window.close(); });

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
