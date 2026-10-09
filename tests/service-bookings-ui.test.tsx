import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { PostData, UserData } from '../src/lib/types';
import type { ServiceAvailability, ServiceBooking } from '../src/lib/service-bookings';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { ServiceBookingPanel } = await import('../src/features/bookings/ServiceBookingPanel');
const { ServiceBookingsDashboard } = await import('../src/features/bookings/ServiceBookingsDashboard');
const { MyWeekBookings } = await import('../src/features/bookings/MyWeekBookings');
const { BookingReceipt } = await import('../src/features/bookings/booking-shared');
const { bookingDisplayStatus, parseAvailability, parseBooking, serviceBookings } = await import('../src/lib/service-bookings');
const { setLocale } = await import('../src/i18n/locale');
const { api } = await import('../src/lib/api');
const now = Date.parse('2026-09-30T18:00:00Z');
const customer = { id: 'customer', token: 'customer-token', nickname: '邻居', email: 'c@example.test', city: 'Fremont', role: 'user', contactType: 'email', contactValue: 'c@example.test', isBanned: false } as UserData;
const provider = { ...customer, id: 'provider', token: 'provider-token', nickname: '清洁服务', isPhoneVerified: true };
const post = { id: 'cleaning', authorId: provider.id, author: { nickname: provider.nickname }, type: 'provider', title: '家庭清洁', category: '清洁', city: 'Fremont', description: '专业清洁', status: 'active' } as PostData;
const availability: ServiceAvailability = { eligible: true, enabled: true, mode: 'request', timezone: 'America/Los_Angeles', providerVerified: true, minNoticeMinutes: 120, bufferMinutes: 30, slots: [
  { id: 'open', date: '2026-10-17', startTime: '09:00', endTime: '12:00', startAt: Date.parse('2026-10-17T16:00:00Z'), endAt: Date.parse('2026-10-17T19:00:00Z'), available: true },
  { id: 'occupied', date: '2026-10-17', startTime: '14:00', endTime: '15:00', startAt: Date.parse('2026-10-17T21:00:00Z'), endAt: Date.parse('2026-10-17T22:00:00Z'), available: false },
] };
const booking: ServiceBooking = { id: 'booking-1', postId: post.id, providerId: provider.id, customerId: customer.id, providerName: provider.nickname, customerName: customer.nickname, postTitle: post.title, date: availability.slots[0].date, startTime: '09:00', endTime: '12:00', startAt: availability.slots[0].startAt, endAt: availability.slots[0].endAt, timezone: 'America/Los_Angeles', status: 'pending', note: '两室公寓', createdAt: now, updatedAt: now, expiresAt: now + 24 * 60 * 60_000, bufferMinutes: 30, conversationId: 'conversation-1' };
const notifications = { inApp: 'sent' as const, sms: 'disabled' as const };
const noop = () => {};
const signIn = (user: UserData | null) => user ? localStorage.setItem('currentUser', JSON.stringify(user)) : localStorage.removeItem('currentUser');
const panel = (user: UserData | null = customer, extras = {}) => <MemoryRouter><ServiceBookingPanel post={post} currentUser={user} onLoginNeeded={noop} showToast={noop} {...extras} /></MemoryRouter>;
const dashboard = (user: UserData | null = customer, extras = {}) => <MemoryRouter><ServiceBookingsDashboard user={user} onLoginNeeded={noop} showToast={noop} {...extras} /></MemoryRouter>;
beforeEach(async t => { t.mock.method(Date, 'now', () => now); localStorage.clear(); signIn(customer); await setLocale('zh-Hans'); });
afterEach(() => cleanup());
after(() => { styles.deregister(); dom.window.close(); });
const choose = async (view: ReturnType<typeof render>) => {
  fireEvent.change(await view.findByRole('combobox', { name: '可约日期' }), { target: { value: '2026-10-17' } });
  fireEvent.click(view.getByRole('button', { name: '09:00–12:00' }));
};

test('reschedule proposals show old and proposed times and only the other participant can accept', async t => {
  const proposal = { id: 'proposal-one', slotId: 'new-time', proposedBy: provider.id, status: 'pending', date: '2026-10-18', startTime: '09:00', endTime: '12:00', startAt: Date.parse('2026-10-18T16:00:00Z'), endAt: Date.parse('2026-10-18T19:00:00Z'), createdAt: now, expiresAt: now + 86400_000 };
  const current = { ...booking, status: 'confirmed', reschedule: proposal };
  const requests: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/reschedule')) { requests.push(JSON.parse(String(options.body))); return { booking: { ...current, date: proposal.date, startAt: proposal.startAt, endAt: proposal.endAt, reschedule: { ...proposal, status: 'accepted', resolvedAt: now } }, notifications }; }
    return { asCustomer: [current], asProvider: [], sms: { enabled: false, configured: false, eligible: false } };
  });
  const view = render(dashboard()); await view.findByText('对方提出改期，等你回应');
  assert.ok(view.getByText('当前已确认')); assert.ok(view.getByText('提议改为')); assert.ok(view.getByText(/在此之前保留原预约/));
  assert.equal(view.queryByRole('button', { name: '撤回改期提议' }), null);
  fireEvent.click(view.getByRole('button', { name: '同意改到这个时间' }));
  await act(async () => {});
  assert.equal(requests.length, 1); assert.equal(requests[0].action, 'accept'); assert.equal(requests[0].proposalId, proposal.id);
  assert.equal(view.queryByText('对方提出改期，等你回应'), null);
});

test('selecting an available replacement sends an explicit proposal without claiming a new confirmed booking', async t => {
  const current = { ...booking, status: 'confirmed' as const };
  const next = { ...availability.slots[0], id: 'new-time', date: '2026-10-18', startAt: Date.parse('2026-10-18T16:00:00Z'), endAt: Date.parse('2026-10-18T19:00:00Z') };
  let requests = 0;
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/reschedule-options')) return { bookingId: booking.id, slots: [next, availability.slots[1]] };
    if (path.endsWith('/reschedule')) { requests++; const body = JSON.parse(String(options.body)); assert.equal(body.action, 'propose'); assert.equal(body.slotId, next.id); return { booking: { ...current, reschedule: { ...next, slotId: next.id, id: 'proposal-new', proposedBy: customer.id, status: 'pending', createdAt: now, expiresAt: now + 86400_000 } }, notifications }; }
    return { asCustomer: [current], asProvider: [], sms: { enabled: false, configured: false, eligible: false } };
  });
  const view = render(dashboard()); fireEvent.click(await view.findByRole('button', { name: '协商改期' }));
  const select = await view.findByRole('combobox', { name: '提议的新时间' });
  assert.equal(view.queryByRole('option', { name: /14:00/ }), null);
  assert.equal((view.getByRole('button', { name: '发送改期提议' }) as HTMLButtonElement).disabled, true);
  fireEvent.change(select, { target: { value: next.id } }); fireEvent.click(view.getByRole('button', { name: '发送改期提议' }));
  await view.findByText('已提出改期，等对方回应'); assert.equal(requests, 1);
  assert.equal(view.queryByRole('button', { name: '同意改到这个时间' }), null); assert.ok(view.getByRole('button', { name: '撤回改期提议' }));
});

test('My Week shows private booking tasks without notes or addresses and explains incomplete conflict checks', async t => {
  const received = { ...booking, providerId: customer.id, customerId: provider.id, note: 'secret 123 home address', expiresAt: now + 86400_000 };
  t.mock.method(api, 'request', async (path: string) => {
    if (path === '/outings/me') throw { status: 503 };
    return { asCustomer: [], asProvider: [received], sms: { enabled: false, configured: false, eligible: false } };
  });
  const view = render(<MemoryRouter><MyWeekBookings user={customer} onLoginNeeded={noop} plans={[]} plansReady /></MemoryRouter>);
  await view.findByText('有 1 份安排等你回应');
  assert.ok(view.getByText('等你回应')); assert.ok(view.getByRole('link', { name: '查看并回应' }));
  assert.equal(view.queryByText(/secret 123/), null); assert.ok(view.getByText(/冲突检查尚不完整/));
});

test('My Week ignores late responses after an account switch and makes booking read errors retryable', async t => {
  let resolveOld: ((value: unknown) => void) | undefined;
  t.mock.method(api, 'request', async (path: string) => {
    if (path === '/outings/me') return { outings: [] };
    if (JSON.parse(localStorage.getItem('currentUser')!).id === customer.id) return new Promise(resolve => { resolveOld = resolve; });
    throw { status: 503 };
  });
  const draw = (user: UserData) => <MemoryRouter><MyWeekBookings user={user} onLoginNeeded={noop} plans={[]} plansReady /></MemoryRouter>;
  const view = render(draw(customer)); await act(async () => {});
  signIn(provider); view.rerender(draw(provider)); await view.findByRole('alert');
  await act(async () => resolveOld?.({ asCustomer: [booking], asProvider: [], sms: { enabled: false, configured: false, eligible: false } }));
  assert.equal(view.queryByText(booking.postTitle), null); assert.ok(view.getByRole('button', { name: '刷新预约' }));
  assert.equal(view.queryByText('这周暂无服务预约，也没有待确认申请。'), null);
});

test('StrictMode loads customer availability, hides occupied times, and clearly submits a request without claiming confirmation', async t => {
  const sent: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/book')) { sent.push(JSON.parse(String(options.body))); return { booking, notifications }; }
    return availability;
  });
  const view = render(<React.StrictMode>{panel()}</React.StrictMode>);
  await choose(view);
  assert.equal(view.queryByRole('button', { name: '14:00–15:00' }), null);
  assert.ok(view.getByText(/这里不收取线上付款/));
  assert.ok(view.getByText(/面积、房间数/));
  fireEvent.change(view.getByRole('textbox', { name: '需求备注（选填）' }), { target: { value: '两室，提供清洁用品' } });
  fireEvent.click(view.getByRole('button', { name: '提交预约申请' }));
  await view.findByText('申请已提交，等对方确认后才算预约成功。');
  assert.equal(sent.length, 1); assert.equal(sent[0].slotId, 'open');
  assert.equal(sent[0].note, 'City: Fremont\n两室，提供清洁用品'); assert.ok(sent[0].idempotencyKey);
  assert.equal(view.queryByText('预约已确认'), null);
  assert.equal(view.getByRole('link', { name: '查看我的预约' }).getAttribute('href'), '/me/bookings');
});

test('network retry keeps the same idempotency key and note, while a changed request gets a new key', async t => {
  const requests: { idempotencyKey: string; note: string }[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (!path.endsWith('/book')) return availability;
    requests.push(JSON.parse(String(options.body))); throw { status: 503 };
  });
  const view = render(panel()); await choose(view);
  fireEvent.click(view.getByRole('button', { name: '提交预约申请' })); await view.findByRole('alert');
  fireEvent.click(view.getByRole('button', { name: '提交预约申请' })); await act(async () => {});
  assert.equal(requests.length, 2); assert.equal(requests[0].idempotencyKey, requests[1].idempotencyKey);
  fireEvent.change(view.getByRole('textbox', { name: '需求备注（选填）' }), { target: { value: '改为深度清洁' } });
  fireEvent.click(view.getByRole('button', { name: '提交预约申请' })); await act(async () => {});
  assert.notEqual(requests[2].idempotencyKey, requests[1].idempotencyKey);
});

test('instant booking uses explicit confirmation copy and SMS acceptance never claims delivery', async t => {
  t.mock.method(api, 'request', async (path: string) => path.endsWith('/book') ? { booking: { ...booking, status: 'confirmed' }, notifications: { inApp: 'sent', sms: 'sent' } } : { ...availability, mode: 'instant' });
  const view = render(panel()); await choose(view);
  assert.ok(view.getByText('提交后立即确认这个完整时段，请先核对日期和时间。'));
  fireEvent.click(view.getByRole('button', { name: '确认预约这个时段' }));
  await view.findByText('预约已确认'); assert.ok(view.getByText(/短信已提交给短信服务商，尚不代表手机已收到/));
});

test('guests can sign in before choosing a time and are not invited to enter a private draft that will be discarded', async t => {
  signIn(null); let logins = 0, messages = 0;
  t.mock.method(api, 'request', async () => availability);
  const view = render(panel(null, { onLoginNeeded: () => logins++, onRequestTime: () => messages++ }));
  const button = await view.findByRole('button', { name: '登录后预约' });
  assert.equal((button as HTMLButtonElement).disabled, false); fireEvent.click(button); assert.equal(logins, 1);
  assert.ok(view.getByRole('textbox', { name: '需求备注（选填）' }).closest('fieldset')?.disabled);
  fireEvent.click(view.getByRole('button', { name: '商量其他时间' })); assert.equal(messages, 1);
});

test('the combined city and note limit prevents a request over 500 characters without silently trimming it', async t => {
  let posts = 0;
  t.mock.method(api, 'request', async (path: string) => { if (path.endsWith('/book')) posts++; return availability; });
  const view = render(panel()); await choose(view);
  const note = view.getByRole('textbox', { name: '需求备注（选填）' }) as HTMLTextAreaElement;
  assert.equal(note.maxLength, 486);
  fireEvent.change(note, { target: { value: '需'.repeat(487) } });
  assert.ok(view.getByRole('alert').textContent?.includes('501/500'));
  assert.equal(note.value.length, 487); assert.ok((view.getByRole('button', { name: '提交预约申请' }) as HTMLButtonElement).disabled);
  assert.equal(posts, 0);
});

test('provider bulk scheduling requires explicit publication, handles unavailable slot cleanup, and saves notice and buffer settings', async t => {
  signIn(provider); const writes: { path: string; body: Record<string, unknown> }[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => { if (options.method) writes.push({ path, body: options.body ? JSON.parse(String(options.body)) : {} }); return availability; });
  const view = render(panel(provider));
  const settings = await view.findByText('预约规则（可选）'); settings.closest('details')!.open = true;
  await view.findByRole('checkbox', { name: '开放这个服务的预约' });
  assert.equal(view.getByRole('link', { name: '管理收到的预约与通知' }).getAttribute('href'), '/me/bookings?view=received');
  fireEvent.change(view.getByLabelText('最短提前时间'), { target: { value: '1440' } });
  fireEvent.change(view.getByLabelText('预约间缓冲'), { target: { value: '60' } });
  fireEvent.click(view.getByRole('button', { name: '保存预约设置' })); await view.findByText('预约设置已保存。');
  assert.equal(writes[0].body.minNoticeMinutes, 1440); assert.equal(writes[0].body.bufferMinutes, 60);
  fireEvent.change(view.getByLabelText('日期'), { target: { value: '2026-10-18' } });
  fireEvent.click(view.getByRole('button', { name: '加入待发布清单' }));
  fireEvent.change(view.getByLabelText('日期'), { target: { value: '2026-10-19' } });
  fireEvent.click(view.getByRole('button', { name: '加入待发布清单' }));
  assert.equal(writes.length, 1, 'drafting has no API side effect');
  fireEvent.click(view.getByRole('button', { name: '发布这些时段' })); await act(async () => {});
  assert.equal((writes[1].body.slots as unknown[]).length, 2); assert.ok(writes[1].body.idempotencyKey);
  assert.equal(view.queryByRole('button', { name: '发布这些时段' }), null);
  fireEvent.click(view.getByRole('checkbox', { name: '显示已占用或不可约时段' }));
  const remove = view.getByRole('button', { name: '移除已发布时段 2026-10-17 14:00' }) as HTMLButtonElement;
  assert.equal(remove.disabled, false); fireEvent.click(remove); await act(async () => {});
  assert.ok(writes[2].path.endsWith('/slots/occupied'));
});

test('schedule text is previewed and applied to the provider draft without publishing automatically', async t => {
  signIn(provider); let mutations = 0;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => { if (options.method) mutations++; return availability; });
  const view = render(panel(provider)); await view.findByText('批量添加可约时间');
  const details = view.getByText('快速生成排期草稿').closest('details')!; details.open = true;
  fireEvent.change(view.getByLabelText('输入排期'), { target: { value: '2026-10-20 09:00-12:00' } });
  fireEvent.click(view.getByRole('button', { name: '预览具体日期' }));
  fireEvent.click(view.getByRole('button', { name: '加入待发布时段' }));
  assert.equal(mutations, 0); assert.ok(view.getByText('2026-10-20 · 09:00–12:00'));
  assert.ok(view.getByRole('button', { name: '发布这些时段' }));
});

test('provider inbox uses actual lifecycle actions, separate SMS consent and stored conversation links', async t => {
  signIn(provider); const actions: string[] = [], sms: boolean[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/actions')) { const payload = JSON.parse(String(options.body)); actions.push(payload.action); return { booking: { ...booking, status: 'confirmed' }, notifications }; }
    if (path.endsWith('/sms-settings')) { const enabled = JSON.parse(String(options.body)).enabled; sms.push(enabled); return { sms: { enabled, eligible: true, configured: true } }; }
    return { asCustomer: [], asProvider: [booking], sms: { enabled: false, eligible: true, configured: true } };
  });
  const view = render(dashboard(provider)); await view.findByRole('article', { name: '家庭清洁' });
  fireEvent.click(view.getByRole('button', { name: /我收到的/ }));
  const consent = view.getByRole('checkbox', { name: /同意接收预约相关短信/ }) as HTMLInputElement;
  assert.equal(consent.checked, false); assert.ok(view.getByText(/默认关闭，与登录验证码授权分开/));
  fireEvent.click(consent); await act(async () => {}); assert.deepEqual(sms, [true]); assert.equal(consent.checked, true);
  fireEvent.click(view.getByRole('button', { name: '接受预约' })); await view.findByText('预约已确认');
  assert.deepEqual(actions, ['confirm']); assert.equal(view.queryByRole('button', { name: '接受预约' }), null);
  assert.equal(view.queryByRole('button', { name: '标记已完成' }), null, 'future bookings cannot be completed');
  assert.equal(view.getByRole('link', { name: '站内消息' }).getAttribute('href'), '/messages/conversation-1');
});

test('customer cancellation asks once, pending deadlines expire truthfully, and old confirmed bookings stay uncompleted', async t => {
  let mutations = 0;
  const expired = { ...booking, id: 'expired', postTitle: '到期申请', expiresAt: now - 1 };
  const ended = { ...booking, id: 'ended', postTitle: '过去的确认预约', status: 'confirmed', date: '2026-09-30', startTime: '09:00', endTime: '10:00', startAt: now - 7200_000, endAt: now - 3600_000 };
  t.mock.method(api, 'request', async (path: string) => { if (path.endsWith('/actions')) { mutations++; return { booking: { ...booking, status: 'cancelled' }, notifications }; } return { asCustomer: [booking, expired, ended], asProvider: [], sms: { enabled: false, eligible: false, configured: false } }; });
  const view = render(dashboard()); await view.findByText('申请已到期');
  assert.equal(view.container.querySelector('main'), null, 'the dashboard fits within the app main landmark');
  assert.ok(view.getByText(/服务者需在/), 'the deadline assigns the next action to the provider, not the customer');
  const expiredCard = view.getByRole('article', { name: '到期申请' }); assert.equal(within(expiredCard).queryByRole('button', { name: '取消预约' }), null);
  assert.ok(within(view.getByRole('article', { name: '过去的确认预约' })).getByText('预约已确认'));
  const current = within(view.getByRole('article', { name: '家庭清洁' }));
  fireEvent.click(current.getByRole('button', { name: '取消预约' })); assert.equal(mutations, 0);
  fireEvent.click(current.getByRole('button', { name: '确定取消' })); await view.findByText('已取消'); assert.equal(mutations, 1);
});

test('the provider management link opens received bookings directly and tab URLs retain unrelated parameters', async t => {
  signIn(provider);
  t.mock.method(api, 'request', async () => ({ asCustomer: [], asProvider: [booking], sms: { enabled: false, eligible: true, configured: false } }));
  const { useLocation } = await import('react-router-dom');
  function CurrentRoute() { return <output data-testid="booking-route">{useLocation().search}</output>; }
  const view = render(<MemoryRouter initialEntries={['/me/bookings?view=received&lang=zh-Hant']}><ServiceBookingsDashboard user={provider} onLoginNeeded={noop} showToast={noop} /><CurrentRoute /></MemoryRouter>);
  await view.findByRole('article', { name: '家庭清洁' });
  assert.equal(view.getByRole('button', { name: /我收到的/ }).getAttribute('aria-pressed'), 'true');
  assert.equal(view.queryByText('还没有预约'), null);
  fireEvent.click(view.getByRole('button', { name: /我预约的/ }));
  const mineParams = new URLSearchParams(view.getByTestId('booking-route').textContent!);
  assert.equal(mineParams.get('view'), 'mine'); assert.equal(mineParams.get('lang'), 'zh-Hant');
  fireEvent.click(view.getByRole('button', { name: /我收到的/ }));
  assert.match(view.getByTestId('booking-route').textContent!, /view=received/);
  assert.match(view.getByTestId('booking-route').textContent!, /lang=zh-Hant/);
});

test('a provider-only notification visit opens received bookings once and explicit mine survives refresh and a fresh visit', async t => {
  signIn(provider); let reads = 0;
  t.mock.method(api, 'request', async () => { reads++; return { asCustomer: [], asProvider: [booking], sms: { enabled: false, eligible: true, configured: false } }; });
  const { useLocation } = await import('react-router-dom');
  function CurrentRoute() { return <output data-testid="notification-route">{useLocation().search}</output>; }
  const view = render(<MemoryRouter initialEntries={['/me/bookings?lang=zh-Hant']}><ServiceBookingsDashboard user={provider} onLoginNeeded={noop} showToast={noop} /><CurrentRoute /></MemoryRouter>);
  await view.findByRole('article', { name: '家庭清洁' });
  assert.equal(view.getByRole('button', { name: /我收到的/ }).getAttribute('aria-pressed'), 'true');
  assert.equal(view.queryByText('还没有预约'), null);
  fireEvent.click(view.getByRole('button', { name: /我预约的/ }));
  const savedQuery = view.getByTestId('notification-route').textContent!;
  assert.equal(new URLSearchParams(savedQuery).get('view'), 'mine');
  fireEvent.click(view.getByRole('button', { name: '刷新预约记录' })); await act(async () => {});
  assert.equal(reads, 2); assert.equal(view.getByRole('button', { name: /我预约的/ }).getAttribute('aria-pressed'), 'true');
  assert.ok(view.getByText('还没有预约')); view.unmount();
  const revisited = render(<MemoryRouter initialEntries={['/me/bookings' + savedQuery]}><ServiceBookingsDashboard user={provider} onLoginNeeded={noop} showToast={noop} /></MemoryRouter>);
  await revisited.findByText('还没有预约');
  assert.equal(revisited.getByRole('button', { name: /我预约的/ }).getAttribute('aria-pressed'), 'true');
});

test('a booking notice link (#booking-<id>, no view) opens the tab that holds that booking for a member with both roles', async t => {
  signIn(provider);
  const mine = { ...booking, id: 'booking-mine', providerId: 'someone-else', customerId: provider.id, postTitle: '周末上门理发' };
  t.mock.method(api, 'request', async () => ({ asCustomer: [mine], asProvider: [booking], sms: { enabled: false, eligible: true, configured: false } }));
  const received = render(<MemoryRouter initialEntries={['/me/bookings#booking-booking-1']}><ServiceBookingsDashboard user={provider} onLoginNeeded={noop} showToast={noop} /></MemoryRouter>);
  await received.findByRole('article', { name: '家庭清洁' });
  assert.equal(received.getByRole('button', { name: /我收到的/ }).getAttribute('aria-pressed'), 'true');
  received.unmount();
  const own = render(<MemoryRouter initialEntries={['/me/bookings#booking-booking-mine']}><ServiceBookingsDashboard user={provider} onLoginNeeded={noop} showToast={noop} /></MemoryRouter>);
  await own.findByRole('article', { name: '周末上门理发' });
  assert.equal(own.getByRole('button', { name: /我预约的/ }).getAttribute('aria-pressed'), 'true');
  own.unmount();
  const chosen = render(<MemoryRouter initialEntries={['/me/bookings?view=mine#booking-booking-1']}><ServiceBookingsDashboard user={provider} onLoginNeeded={noop} showToast={noop} /></MemoryRouter>);
  await chosen.findByRole('article', { name: '周末上门理发' });
  assert.equal(chosen.getByRole('button', { name: /我预约的/ }).getAttribute('aria-pressed'), 'true');
});

test('SMS activation is unavailable when configuration or verified eligibility is missing, without false success', async t => {
  signIn(provider); let mutations = 0;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => { if (options.method) mutations++; return { asCustomer: [], asProvider: [], sms: { enabled: false, eligible: false, configured: false } }; });
  const view = render(dashboard(provider)); await view.findByText('还没有预约'); fireEvent.click(view.getByRole('button', { name: /我收到的/ }));
  const checkbox = view.getByRole('checkbox', { name: /同意接收预约相关短信/ }) as HTMLInputElement;
  assert.equal(checkbox.checked, false); assert.equal(checkbox.disabled, true); assert.equal(mutations, 0);
  assert.ok(view.getByText('当前环境未启用预约短信。预约和站内消息仍可使用。'));
  assert.ok(view.getByRole('link', { name: '前往个人主页验证' }));
});

test('account changes discard a late booking result, note and toast, even when the old transport ignores abort', async t => {
  let resolveOld!: (value: unknown) => void; const toasts: string[] = [];
  t.mock.method(api, 'request', async (path: string) => path.endsWith('/book') ? new Promise(resolve => { resolveOld = resolve; }) : availability);
  const view = render(panel(customer, { showToast: (message: string) => toasts.push(message) })); await choose(view);
  fireEvent.change(view.getByRole('textbox', { name: '需求备注（选填）' }), { target: { value: '私密旧账号需求' } });
  fireEvent.click(view.getByRole('button', { name: '提交预约申请' }));
  const second = { ...customer, id: 'customer-two', token: 'new-token', city: '' }; signIn(second);
  view.rerender(panel(second, { showToast: (message: string) => toasts.push(message) })); await view.findByRole('combobox', { name: '可约日期' });
  await act(async () => resolveOld({ booking, notifications }));
  assert.equal((view.getByRole('textbox', { name: '需求备注（选填）' }) as HTMLTextAreaElement).value, '');
  assert.equal(view.queryByText('申请已提交，等对方确认后才算预约成功。'), null); assert.deepEqual(toasts, []);
});

test('receipt body matches every terminal status, and malformed data is never treated as a confirmed empty response', async t => {
  const tCopy = (zh: string) => zh;
  for (const [status, expected] of [['cancelled', '这笔预约已取消'], ['declined', '这次申请未获接受'], ['expired', '这次申请已到期'], ['completed', '这笔预约已标记完成']] as const) {
    const view = render(<MemoryRouter><BookingReceipt booking={{ ...booking, status }} notifications={notifications} t={tCopy} now={now} /></MemoryRouter>);
    assert.ok(view.getByText(new RegExp(expected))); assert.equal(view.queryByText(/时段已确认/), null); view.unmount();
  }
  assert.equal(bookingDisplayStatus({ ...booking, expiresAt: now - 1 }, now), 'expired');
  assert.throws(() => parseAvailability({ ...availability, slots: [{ ...availability.slots[0], startAt: 'not-a-time' }] }));
  assert.throws(() => parseBooking({ ...booking, status: 'success' }));
  t.mock.method(api, 'request', async () => ({ booking: { ...booking, postId: 'another-post' }, notifications }));
  await assert.rejects(serviceBookings.book(post.id, 'open', '', 'key'));
});

test('booking forms render their own English and Traditional Chinese labels without changing the request contract', async t => {
  t.mock.method(api, 'request', async () => availability);
  await setLocale('en'); const view = render(panel()); await view.findByRole('combobox', { name: 'Available date' });
  assert.ok(view.getByText('No online payments are collected here. Agree on price, location and service details in messages.'));
  await act(async () => { await setLocale('zh-Hant'); });
  await view.findByRole('combobox', { name: '可約日期' }); assert.ok(view.getByRole('button', { name: '提交預約申請' }));
});

test('a first provider saves times before opening and recovers an opening failure without duplicating slots', async t => {
  signIn(provider); let stored = { ...availability, enabled: false, slots: [] as ServiceAvailability['slots'] }, slotWrites = 0, settingWrites = 0;
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/slots') && options.method === 'POST') { slotWrites++; stored = { ...stored, slots: [{ ...availability.slots[0], available: false, reason: '服务者尚未开放预约。' }] }; }
    if (path.endsWith('/settings')) { settingWrites++; if (settingWrites === 1) throw { status: 503 }; stored = { ...stored, ...JSON.parse(String(options.body)), slots: [availability.slots[0]] }; }
    return stored;
  });
  const view = render(panel(provider)); await view.findByText('预约尚未开放');
  assert.equal(view.getByText('预约规则（可选）').closest('details')!.open, false);
  fireEvent.change(view.getByLabelText('日期'), { target: { value: '2026-10-17' } });
  fireEvent.change(view.getByLabelText('结束时间'), { target: { value: '12:00' } });
  fireEvent.click(view.getByRole('button', { name: '加入待发布清单' })); fireEvent.click(view.getByRole('button', { name: '保存这些时段' }));
  await view.findByText('时段已保存，预约尚未开放。');
  assert.ok(view.getByText('尚未开放给顾客')); assert.equal(view.queryByText('还没有保存时段。先添加日期和时间。'), null);
  fireEvent.click(view.getByRole('button', { name: '开放这些时段' })); await view.findByRole('alert');
  assert.ok(view.getByText('时段已保存，预约尚未开放。')); assert.equal(slotWrites, 1);
  fireEvent.click(view.getByRole('button', { name: '开放这些时段' })); await view.findByText('正在接受预约');
  assert.equal(slotWrites, 1); assert.equal(settingWrites, 2);
  assert.equal(view.queryByRole('button', { name: '开放这些时段' }), null);
});

test('a slot conflict offers readable refresh and retains customer needs while requiring a new time choice', async t => {
  let read = 0;
  t.mock.method(api, 'request', async (path: string) => {
    if (path.endsWith('/book')) throw { status: 409 };
    return ++read === 1 ? availability : { ...availability, slots: [{ ...availability.slots[0], available: false }, { ...availability.slots[1], available: true }] };
  });
  const view = render(panel()); await choose(view);
  assert.ok(view.getByText('2026-10-17 · 09:00–12:00'));
  assert.ok(view.getByText('这次预约覆盖完整起止时间，不是在这个窗口内任选到达时间。'));
  fireEvent.change(view.getByRole('textbox', { name: '需求备注（选填）' }), { target: { value: '需要清洁厨房' } });
  fireEvent.click(view.getByRole('button', { name: '提交预约申请' })); await view.findByRole('alert');
  fireEvent.click(view.getByRole('button', { name: '重新读取时段' }));
  await view.findByText('刚才选择的时段已不可约，请重新选择。你填写的需求仍然保留。');
  assert.equal(view.queryByRole('button', { name: '09:00–12:00' }), null);
  assert.equal((view.getByRole('textbox', { name: '需求备注（选填）' }) as HTMLTextAreaElement).value, '需要清洁厨房');
  assert.ok((view.getByRole('button', { name: '提交预约申请' }) as HTMLButtonElement).disabled);
  fireEvent.click(view.getByRole('button', { name: '14:00–15:00' }));
  assert.equal((view.getByRole('button', { name: '提交预约申请' }) as HTMLButtonElement).disabled, false);
});

test('failed notifications retain the saved request and offer its actual conversation instead of implying booking failure', async t => {
  let writes = 0;
  t.mock.method(api, 'request', async (path: string) => { if (path.endsWith('/book')) { writes++; return { booking, notifications: { inApp: 'failed', sms: 'failed' } }; } return availability; });
  const view = render(panel()); await choose(view); fireEvent.click(view.getByRole('button', { name: '提交预约申请' }));
  await view.findByText('申请已提交，等对方确认后才算预约成功。');
  assert.ok(view.getByText(/预约状态已保存，但站内通知未发送成功。无需重复预约/));
  assert.ok(view.getByText(/短信未发送成功，预约状态仍已保存/));
  assert.equal(view.getByRole('link', { name: '进入站内消息' }).getAttribute('href'), '/messages/conversation-1');
  assert.equal(view.queryByRole('button', { name: '提交预约申请' }), null); assert.equal(writes, 1);
});

test('first-load failure has a visible retry and does not pretend the provider has no times', async t => {
  let reads = 0;
  t.mock.method(api, 'request', async () => { if (++reads === 1) throw { status: 503 }; return availability; });
  const view = render(panel()); await view.findByRole('alert');
  assert.equal(view.queryByText('暂时没有可约时段。可以稍后刷新，或向服务者询问其他时间。'), null);
  fireEvent.click(view.getByRole('button', { name: '重新读取时段' }));
  await view.findByRole('combobox', { name: '可约日期' }); assert.equal(view.queryByRole('alert'), null);
});

test('quick pause and open change only saved availability while preserving unsaved confirmation rules', async t => {
  signIn(provider); let stored = availability; const writes: Record<string, unknown>[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (path.endsWith('/settings')) { const payload = JSON.parse(String(options.body)); writes.push(payload); stored = { ...stored, ...payload }; }
    return stored;
  });
  const view = render(panel(provider)); const rules = await view.findByText('预约规则（可选）'); rules.closest('details')!.open = true;
  fireEvent.change(view.getByLabelText('确认方式'), { target: { value: 'instant' } });
  fireEvent.change(view.getByLabelText('最短提前时间'), { target: { value: '1440' } });
  fireEvent.click(view.getByRole('button', { name: '暂停新预约' })); await view.findByText('预约尚未开放');
  assert.deepEqual(writes[0], { enabled: false, mode: 'request', minNoticeMinutes: 120, bufferMinutes: 30 });
  assert.equal((view.getByLabelText('确认方式') as HTMLSelectElement).value, 'instant');
  assert.equal((view.getByLabelText('最短提前时间') as HTMLSelectElement).value, '1440');
  assert.ok(view.getByText('规则已修改，还未保存'));
  fireEvent.click(view.getByRole('button', { name: '开放预约' })); await view.findByText('正在接受预约');
  assert.deepEqual(writes[1], { enabled: true, mode: 'request', minNoticeMinutes: 120, bufferMinutes: 30 });
  fireEvent.click(view.getByRole('button', { name: '保存预约设置' })); await view.findByText('预约设置已保存。');
  assert.deepEqual(writes[2], { enabled: true, mode: 'instant', minNoticeMinutes: 1440, bufferMinutes: 30 });
});

test('reopened booking records show notification failures on the affected card and refresh removes resolved warnings', async t => {
  let recovered = false;
  t.mock.method(api, 'request', async () => ({ asCustomer: [{ ...booking, notifications: recovered ? notifications : { inApp: 'failed', sms: 'unknown' } }, { ...booking, id: 'healthy', postTitle: '已通知的另一预约', notifications }], asProvider: [], sms: { enabled: false, eligible: false, configured: false } }));
  const view = render(dashboard());
  const card = within(await view.findByRole('article', { name: '家庭清洁' }));
  assert.ok(card.getByText(/预约状态已保存，但站内通知未发送成功/));
  assert.ok(card.getByText(/短信发送结果尚未确认/));
  assert.equal(card.getByRole('link', { name: '进入站内消息' }).getAttribute('href'), '/messages/conversation-1');
  assert.equal(within(view.getByRole('article', { name: '已通知的另一预约' })).queryByText(/通知未发送成功/), null);
  recovered = true; fireEvent.click(view.getByRole('button', { name: '刷新预约记录' })); await act(async () => {});
  assert.equal(view.queryByText(/通知未发送成功/), null); assert.ok(card.getByText('待服务者确认'));
});

test('booking responses reject another participant before showing their receipt or a success toast', async t => {
  const toasts: string[] = [];
  t.mock.method(api, 'request', async (path: string) => path.endsWith('/book') ? { booking: { ...booking, customerId: 'another-customer', note: 'private details' }, notifications } : availability);
  const view = render(panel(customer, { showToast: (message: string) => toasts.push(message) })); await choose(view);
  fireEvent.click(view.getByRole('button', { name: '提交预约申请' })); await view.findByRole('alert');
  assert.equal(view.queryByText('private details'), null); assert.equal(view.queryByRole('link', { name: '查看我的预约' }), null); assert.deepEqual(toasts, []);
});

test('booking timestamps agree with displayed Bay Area time in summer and winter and invalid ranges fail closed', () => {
  assert.equal(parseAvailability(availability).slots[0].startTime, '09:00');
  const winter = { ...availability.slots[0], date: '2026-12-17', startAt: Date.parse('2026-12-17T17:00:00Z'), endAt: Date.parse('2026-12-17T20:00:00Z') };
  assert.equal(parseAvailability({ ...availability, slots: [winter] }).slots[0].date, '2026-12-17');
  assert.equal(parseBooking({ ...booking, ...winter, status: 'confirmed' }).startTime, '09:00');
  for (const patch of [{ endAt: Infinity }, { startAt: availability.slots[0].startAt + 3600_000 }, { date: '2026-10-18' }, { endAt: 8.64e15 + 1 }]) {
    assert.throws(() => parseAvailability({ ...availability, slots: [{ ...availability.slots[0], ...patch }] }));
    assert.throws(() => parseBooking({ ...booking, ...patch }));
  }
  assert.throws(() => parseBooking({ ...booking, expiresAt: 8.64e15 + 1 }));
  assert.throws(() => parseBooking({ ...booking, notifications: { inApp: 'delivered', sms: 'sent' } }));
});
