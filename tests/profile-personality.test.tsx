/** @jsxRuntime automatic */
/** @jsxImportSource @baylink/locale */
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import type { UserData, PublicUserProfile } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, FileReader: dom.window.FileReader, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
await import('../src/i18n/router');
const { ProfileIdentity, ProfileShareButton } = await import('../src/features/profile/ProfileIdentity');
const { EditProfileModal, PhoneVerificationModal } = await import('../src/features/profile/EditProfileModal');
const { UserProfileModal } = await import('../src/features/users/UserProfileModal');
const { ProfileView } = await import('../src/features/profile/ProfileView');
const { OfficialVerificationModal } = await import('../src/components/OfficialVerificationModal');
const { prepareProfileImage } = await import('../src/features/profile/profile-images');
const { commonProfileInterests, safeProfileLink, resolveProfileTheme, profileShareUrl } = await import('../src/features/profile/profile-personality');
const { api } = await import('../src/lib/api');
const { setLocale, translateText } = await import('../src/i18n/locale');
const user: UserData = { id: 'profile-test-user', email: 'private@example.test', nickname: '生活指南', role: 'user', contactType: 'wechat', contactValue: 'private_wechat', phone: '+14155550101', isBanned: false, bio: '周末出门', statusText: '我的收藏', profileTheme: 'bay', coverImage: 'https://example.test/cover.jpg', avatar: 'https://example.test/avatar.jpg', interests: ['摄影', 'Hiking'], profileTags: ['生活指南'], socialLinks: { linkedin: 'https://www.linkedin.com/in/test-neighbor/' } };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; };
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); });

test('profile helpers use real interest intersections and safe canonical links', () => {
  assert.deepEqual(commonProfileInterests(['Hiking', '摄影'], [' hiking ', '摄影', '摄影', 'Coffee']), [' hiking ', '摄影']);
  assert.deepEqual(commonProfileInterests([], ['摄影']), []);
  assert.equal(resolveProfileTheme('unexpected-css-value'), 'bay');
  assert.equal(resolveProfileTheme('sunset'), 'sunset');
  assert.equal(safeProfileLink('javascript:alert(1)'), null);
  assert.equal(safeProfileLink('https://name:secret@example.com/'), null);
  assert.equal(safeProfileLink('www.linkedin.com/in/example'), 'https://www.linkedin.com/in/example');
  assert.equal(profileShareUrl('person/path', 'en'), 'https://www.baylink.us/users/person%2Fpath?lang=en');
});

test('public cards preserve personal text across languages and never render private account contacts', async () => {
  const view = render(<ProfileIdentity profile={user} />);
  await act(async () => { await setLocale('en', false); });
  assert.equal(view.getByRole('heading').textContent, user.nickname);
  assert.equal(view.getByText(user.bio!).closest('[translate="no"]')?.textContent, user.bio);
  assert.equal(view.getByText(user.statusText!).closest('[translate="no"]')?.textContent, user.statusText);
  assert.ok(view.getByRole('link', { name: 'LinkedIn' }));
  assert.doesNotMatch(view.container.textContent!, /private@example|private_wechat|14155550101/);
  fireEvent.error(view.getByRole('img', { name: translateText('个人封面') }));
  assert.equal(view.queryByRole('img', { name: translateText('个人封面') }), null);
  assert.equal(view.container.querySelector('[data-profile-theme]')?.getAttribute('data-profile-theme'), 'bay');
});

test('editing previews theme and personal status immediately while failed save retains all changes', async t => {
  let updates = 0; let closes = 0; let payload: Partial<UserData> | undefined;
  t.mock.method(api, 'updateProfile', async (data: Partial<UserData>) => { payload = data; throw new Error('Test network failure'); });
  const view = render(<EditProfileModal user={user} onClose={() => { closes += 1; }} onUpdate={() => { updates += 1; }} showToast={() => {}} />);
  fireEvent.click(view.getByRole('button', { name: /雾紫色/ }));
  fireEvent.change(view.getByRole('textbox', { name: '此刻的生活状态' }), { target: { value: '周六一起徒步' } });
  const preview = view.getByRole('region', { name: '名片即时预览' });
  assert.equal(preview.getAttribute('data-profile-theme'), 'lavender');
  assert.equal(within(preview).getByText('周六一起徒步').getAttribute('translate'), 'no');
  assert.doesNotMatch(preview.textContent!, /private@example|private_wechat|14155550101/);
  assert.equal(view.getByRole('textbox', { name: '微信号' }).closest('[aria-label="私人账号设置"]')?.tagName, 'SECTION');
  fireEvent.click(view.getByRole('button', { name: '移除头像' }));
  fireEvent.click(view.getByRole('button', { name: '移除封面' }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存资料' })); });
  assert.ok(view.getByRole('alert'));
  assert.equal(payload?.profileTheme, 'lavender'); assert.equal(payload?.statusText, '周六一起徒步');
  assert.equal(payload?.avatar, ''); assert.equal(payload?.coverImage, '');
  assert.equal((view.getByRole('textbox', { name: '此刻的生活状态' }) as HTMLInputElement).value, '周六一起徒步');
  assert.equal(updates, 0); assert.equal(closes, 0);
});

test('profile save does not misreport server success when local storage is unavailable', async t => {
  let updated: UserData | undefined; let closes = 0;
  t.mock.method(api, 'updateProfile', async () => ({ ...user, statusText: 'Saved on server' }));
  t.mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('Storage is blocked'); });
  const view = render(<EditProfileModal user={user} onClose={() => { closes += 1; }} onUpdate={(value: UserData) => { updated = value; }} showToast={() => {}} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '保存资料' })); });
  assert.equal(updated?.statusText, 'Saved on server'); assert.equal(closes, 1); assert.equal(view.queryByRole('alert'), null);
});

test('image upload rejects oversized or unsupported files and keeps the previous cover', async () => {
  await assert.rejects(prepareProfileImage(new dom.window.File(['bad'], 'unsafe.svg', { type: 'image/svg+xml' }), 'coverImage'), /JPG/);
  const notices: string[] = [];
  const view = render(<EditProfileModal user={user} onClose={() => {}} onUpdate={() => {}} showToast={(message: string) => notices.push(message)} />);
  const huge = new dom.window.File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' });
  await act(async () => { fireEvent.change(view.getByLabelText('上传封面', { selector: 'input' }), { target: { files: [huge] } }); });
  assert.ok(notices.some(message => message.includes('10MB')));
  assert.equal(view.getByRole('img', { name: '个人封面' }).getAttribute('src'), user.coverImage);
  assert.equal((view.getByRole('button', { name: '保存资料' }) as HTMLButtonElement).disabled, false);
});

test('profile sharing respects cancellation and offers manual fallback with localized canonical URL', async () => {
  let copies = 0;
  Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { copies += 1; } } });
  const view = render(<ProfileShareButton userId={user.id} nickname={user.nickname} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '分享名片' })); });
  assert.equal(copies, 0); assert.equal(view.queryByRole('textbox'), null);
  Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('Unavailable'); } });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
  await act(async () => { await setLocale('zh-Hant', false); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: translateText('分享名片') })); });
  assert.equal((view.getByRole('textbox') as HTMLInputElement).value, `https://www.baylink.us/users/${user.id}?lang=zh-Hant`);
});

test('small PNGs skipped by the general compressor are still resized to profile bounds', async t => {
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const previousFile = Object.getOwnPropertyDescriptor(globalThis, 'File');
  let outputWidth = 0; let outputHeight = 0;
  class TestImage { naturalWidth = 4000; naturalHeight = 2000; onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()); } }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: TestImage });
  Object.defineProperty(globalThis, 'File', { configurable: true, value: dom.window.File });
  t.mock.method(dom.window.HTMLCanvasElement.prototype, 'getContext', function () { return { fillStyle: '', fillRect() {}, drawImage() {} }; });
  t.mock.method(dom.window.HTMLCanvasElement.prototype, 'toBlob', function (this: HTMLCanvasElement, callback: BlobCallback) { outputWidth = this.width; outputHeight = this.height; callback(new dom.window.Blob(['compressed'], { type: 'image/jpeg' })); });
  try {
    const result = await prepareProfileImage(new dom.window.File(['small-png'], 'wide.png', { type: 'image/png' }), 'coverImage');
    assert.equal(outputWidth, 1400); assert.equal(outputHeight, 700);
    assert.match(result, /^data:image\/jpeg;base64,/);
  } finally {
    if (previousImage) Object.defineProperty(globalThis, 'Image', previousImage); else Reflect.deleteProperty(globalThis, 'Image');
    if (previousFile) Object.defineProperty(globalThis, 'File', previousFile); else Reflect.deleteProperty(globalThis, 'File');
  }
});

test('public profile highlights common interests only for another real signed-in user', async t => {
  const profile: PublicUserProfile = { ...user, id: 'other-neighbor', interests: ['摄影', 'Gardening'], postCount: 0, recentPosts: [] };
  t.mock.method(api, 'getUserPublicProfile', async () => profile);
  const view = render(<UserProfileModal userId={profile.id} currentUser={user} onClose={() => {}} onChat={() => {}} />);
  await act(async () => {});
  const common = view.getByRole('region', { name: '你们的共同兴趣' });
  assert.equal(within(common).getByText('摄影').getAttribute('translate'), 'no');
  assert.equal(within(common).queryByText('Gardening'), null);
  assert.doesNotMatch(view.baseElement.textContent!, /private@example|private_wechat|14155550101/);
  assert.doesNotMatch(view.baseElement.textContent!, /已加入 BAYLINK|Joined BAYLINK|— days/);
  assert.ok(view.getByText('已发布 0 条本地信息'));
  view.rerender(<UserProfileModal userId={profile.id} currentUser={null} onClose={() => {}} onChat={() => {}} />);
  await act(async () => {});
  assert.equal(view.queryByRole('region', { name: '你们的共同兴趣' }), null);
});

test('a failed profile switch never leaves actions pointing at the previous person', async t => {
  const profile: PublicUserProfile = { ...user, id: 'first-neighbor', postCount: 0, recentPosts: [] };
  t.mock.method(api, 'getUserPublicProfile', async (id: string) => { if (id === profile.id) return profile; throw new Error('Unavailable'); });
  const props = { currentUser: user, onClose() {}, onChat() {}, onReportUser() {}, onToggleBlockUser() {} };
  const view = render(<UserProfileModal userId={profile.id} {...props} />);
  await act(async () => {});
  assert.ok(view.getByRole('button', { name: '发私信' }));
  view.rerender(<UserProfileModal userId="unavailable-neighbor" {...props} />);
  await act(async () => {});
  assert.ok(view.getByText('无法查看该用户资料'));
  assert.ok(!view.queryByRole('button', { name: '发私信' }));
  assert.ok(!view.queryByRole('button', { name: '举报用户' }));
});

test('a late profile save after closing cannot replace a newer signed-in account', async t => {
  const pending = deferred<Partial<UserData>>();
  const first = { ...user, token: 'old-session' };
  const second = { ...user, id: 'second-account', nickname: '新账号', token: 'new-session' };
  localStorage.setItem('currentUser', JSON.stringify(first));
  let updates = 0; let closes = 0; let notices = 0;
  t.mock.method(api, 'updateProfile', () => pending.promise);
  const view = render(<EditProfileModal user={first} onClose={() => { closes += 1; }} onUpdate={() => { updates += 1; }} showToast={() => { notices += 1; }} />);
  fireEvent.click(view.getByRole('button', { name: '保存资料' }));
  view.unmount(); localStorage.setItem('currentUser', JSON.stringify(second));
  await act(async () => { pending.resolve({ ...first, nickname: '旧账号保存结果' }); });
  assert.equal(JSON.parse(localStorage.getItem('currentUser')!).id, second.id);
  assert.equal(updates, 0); assert.equal(closes, 0); assert.equal(notices, 0);
});

test('changing the edited account discards its old form and ignores a late old save', async t => {
  const pending = deferred<Partial<UserData>>();
  const first = { ...user, token: 'first-token' };
  const second = { ...user, id: 'second-account', nickname: '新账号昵称', statusText: '新账号状态', token: 'second-token' };
  localStorage.setItem('currentUser', JSON.stringify(first));
  let updates = 0;
  t.mock.method(api, 'updateProfile', () => pending.promise);
  const props = { onClose() {}, onUpdate() { updates += 1; }, showToast() {} };
  const view = render(<EditProfileModal user={first} {...props} />);
  fireEvent.change(view.getByRole('textbox', { name: '此刻的生活状态' }), { target: { value: '旧账号未保存状态' } });
  fireEvent.click(view.getByRole('button', { name: '保存资料' }));
  localStorage.setItem('currentUser', JSON.stringify(second));
  view.rerender(<EditProfileModal user={second} {...props} />);
  await act(async () => { pending.resolve({ ...first, statusText: '旧账号保存结果' }); });
  assert.equal((view.getByRole('textbox', { name: '昵称' }) as HTMLInputElement).value, second.nickname);
  assert.equal((view.getByRole('textbox', { name: '此刻的生活状态' }) as HTMLInputElement).value, second.statusText);
  assert.equal(updates, 0);
});

test('a late phone verification cannot merge its account into a new browser session', async t => {
  const pending = deferred<{ user: UserData }>();
  const first = { ...user, token: 'old-phone-session' };
  const second = { ...user, id: 'second-account', token: 'new-phone-session' };
  localStorage.setItem('currentUser', JSON.stringify(first));
  t.mock.method(api, 'startPhoneVerification', async () => ({}));
  t.mock.method(api, 'verifyPhoneCode', () => pending.promise);
  let updates = 0; let closes = 0;
  const view = render(<PhoneVerificationModal user={first} onClose={() => { closes += 1; }} onVerified={() => { updates += 1; }} showToast={() => {}} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '发送验证码' })); });
  fireEvent.change(view.getByPlaceholderText('6位验证码'), { target: { value: '123456' } });
  fireEvent.click(view.getByRole('button', { name: '完成验证' }));
  localStorage.setItem('currentUser', JSON.stringify(second));
  await act(async () => { pending.resolve({ user: { ...first, isPhoneVerified: true } }); });
  assert.equal(JSON.parse(localStorage.getItem('currentUser')!).id, second.id);
  assert.equal(updates, 0); assert.equal(closes, 0);
});

test('a late official verification cannot restore the previous account after switching users', async t => {
  const pending = deferred<{ user: UserData }>();
  const first = { ...user, token: 'first-verification-token' };
  const second = { ...user, id: 'second-account', nickname: '第二个账号', token: 'second-verification-token' };
  localStorage.setItem('currentUser', JSON.stringify(first));
  t.mock.method(api, 'submitOfficialVerification', () => pending.promise);
  let updates = 0; let notices = 0;
  const props = { onLogout() {}, onLogin() {}, onOpenPost() {}, onUpdateUser() { updates += 1; }, showToast() { notices += 1; }, onOpenBlockedUsers() {} };
  const view = render(<MemoryRouter><ProfileView user={first} {...props} /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: '申请认证' }));
  fireEvent.change(view.getByPlaceholderText('介绍你的身份、服务范围、资质或社区角色…'), { target: { value: '本地服务提供者' } });
  fireEvent.click(view.getByRole('button', { name: '提交申请' }));
  localStorage.setItem('currentUser', JSON.stringify(second));
  view.rerender(<MemoryRouter><ProfileView user={second} {...props} /></MemoryRouter>);
  await act(async () => { pending.resolve({ user: { ...first, officialVerification: { status: 'pending' } } }); });
  assert.equal(JSON.parse(localStorage.getItem('currentUser')!).id, second.id);
  assert.equal(updates, 0); assert.equal(notices, 0);
  assert.ok(!view.queryByRole('dialog', { name: '申请官方认证' }));
});

test('closing and reopening official verification starts a new form and ignores the old submission', async () => {
  const pending = deferred<{ user: UserData }>();
  let successes = 0; let closes = 0; let notices = 0;
  const props = { onClose() { closes += 1; }, onSubmit: () => pending.promise, onSuccess() { successes += 1; }, showToast() { notices += 1; } };
  const view = render(<OfficialVerificationModal isOpen {...props} />);
  fireEvent.change(view.getByPlaceholderText('介绍你的身份、服务范围、资质或社区角色…'), { target: { value: '旧表单认证说明' } });
  fireEvent.click(view.getByRole('button', { name: '提交申请' }));
  view.rerender(<OfficialVerificationModal isOpen={false} {...props} />);
  view.rerender(<OfficialVerificationModal isOpen {...props} />);
  const description = view.getByPlaceholderText('介绍你的身份、服务范围、资质或社区角色…') as HTMLTextAreaElement;
  assert.equal(description.value, '');
  fireEvent.change(description, { target: { value: '新表单保留' } });
  await act(async () => { pending.resolve({ user }); });
  assert.equal(description.value, '新表单保留');
  assert.equal(successes, 0); assert.equal(closes, 0); assert.equal(notices, 0);
});

test('successful phone verification updates the active profile even when storage writes fail', async t => {
  const first = { ...user, token: 'current-verification-token' };
  localStorage.setItem('currentUser', JSON.stringify(first));
  t.mock.method(api, 'startPhoneVerification', async () => ({}));
  t.mock.method(api, 'verifyPhoneCode', async () => ({ user: { ...first, isPhoneVerified: true } }));
  t.mock.method(dom.window.Storage.prototype, 'setItem', () => { throw new Error('Storage is blocked'); });
  let updated: UserData | undefined; let closes = 0;
  const notices: string[] = [];
  const view = render(<PhoneVerificationModal user={first} onClose={() => { closes += 1; }} onVerified={value => { updated = value; }} showToast={message => notices.push(message)} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '发送验证码' })); });
  fireEvent.change(view.getByRole('textbox', { name: '6位验证码' }), { target: { value: '123456' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '完成验证' })); });
  assert.equal(updated?.isPhoneVerified, true);
  assert.equal(closes, 1); assert.ok(notices.includes('手机号验证已完成'));
});
