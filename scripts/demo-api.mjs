// Local UI fixture only: binds loopback, uses memory, and never contacts external services.
import { createServer } from 'node:http';

const viewer = { id: 'demo-viewer', nickname: 'Maya · 周末去看海', email: 'demo@example.test', token: 'local-demo-token', role: 'user', contactType: 'email', contactValue: 'demo@example.test', isBanned: false,
  profileTheme: 'sunset', statusText: '正在收集湾区最美的日落 🌅', bio: '住在半岛的产品设计师。工作日认真做事，周末认真散步。\n喜欢咖啡、海边和没有赶路的旅行。', area: '半岛', city: 'San Mateo', interests: ['徒步', '摄影', '咖啡'], profileTags: ['设计师', '湾区生活'], socialLinks: { instagram: 'baylink_demo', linkedin: 'https://www.linkedin.com/' } };
const neighbor = { id: 'demo-neighbor', nickname: 'Alex · 山海之间', role: 'user', profileTheme: 'redwood', statusText: '这个周末想走一条新步道 🌿', area: '旧金山', city: 'San Francisco', bio: '喜欢在雾里拍照，也喜欢沿着海岸慢慢走。\n一起交换值得重访的小地方。', interests: ['摄影', '徒步', '音乐'], profileTags: ['户外爱好者'], coverImage: '/guides/editorial/coast.webp' };
const posts = Array.from({ length: 36 }, (_, index) => ({
  id: `demo-post-${index + 1}`, authorId: index % 2 ? viewer.id : neighbor.id,
  author: index % 2 ? { id: viewer.id, nickname: viewer.nickname } : neighbor,
  type: index === 35 ? 'client' : 'provider',
  title: `${index === 34 ? '北湾搬家服务' : index % 2 ? '我发布的测试信息' : '邻居的测试房源'} ${index + 1}`,
  description: '这是一条仅供本地回归测试的信息，不是真实房源或交易。请使用站内私信沟通具体时间。',
  category: index === 34 ? '搬家' : index % 3 === 0 ? '清洁' : '租屋', city: index === 34 ? '北湾' : '东湾',
  timeInfo: '', budget: index % 2 ? '面议' : '$1,200 / 月', contactInfo: null, imageUrls: [],
  likesCount: 0, hasLiked: false, commentsCount: 0, createdAt: Date.now() - index * 86400000,
  status: index === 33 ? 'closed' : 'active', confirmedAt: index === 1 ? Date.now() : null,
  contactPreference: { mode: 'manual_approve', methods: [{ type: 'email', label: '邮箱', enabled: true }] },
}));
const conversations = [{ id: 'demo-conversation', otherUser: neighbor, lastMessage: '周六上午去 Lands End 怎么样？沿海走一圈，再找家咖啡店。', unreadCount: 2, updatedAt: Date.now() },
  { id: 'demo-conversation-2', otherUser: { id: 'demo-jess', nickname: 'Jess', city: 'Palo Alto', profileTheme: 'lavender', statusText: '咖啡和书，刚刚好 ☕' }, lastMessage: '谢谢推荐，下次一起去！', unreadCount: 0, updatedAt: Date.now() - 86400000 }];
const messages = [
  { id: 'demo-message-1', conversationId: 'demo-conversation', senderId: neighbor.id, type: 'text', content: '看到你也喜欢摄影和徒步，来打个招呼 👋', createdAt: Date.now() - 86400000 },
  { id: 'demo-message-2', conversationId: 'demo-conversation', senderId: viewer.id, type: 'text', content: '你好！一直想找一条能看海的轻松路线。\n你有没有喜欢的地方？', createdAt: Date.now() - 86200000, reactions: [{ emoji: '❤️', userIds: [neighbor.id] }], reactionVersion: 1 },
  { id: 'demo-message-3', conversationId: 'demo-conversation', senderId: neighbor.id, type: 'text', content: '周六上午去 Lands End 怎么样？沿海走一圈，再找家咖啡店。', createdAt: Date.now() - 180000, replyTo: { id: 'demo-message-2', senderId: viewer.id, content: '你好！一直想找一条能看海的轻松路线。' } },
];
let revoked = false;
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://localhost:3000');
  const path = url.pathname.replace(/^\/api/, '');
  const send = (data, status = 200) => { res.writeHead(status).end(JSON.stringify(data)); };
  let body = '';
  for await (const chunk of req) body += chunk;
  let data = {};
  try { data = body ? JSON.parse(body) : {}; } catch { send({ error: 'Invalid JSON' }, 400); return; }
  if (path === '/auth/login') { revoked = false; send(viewer); return; }
  if (path === '/auth/logout') { revoked = true; send({ success: true }); return; }
  const authenticated = req.headers.authorization === `Bearer ${viewer.token}` && !revoked;
  if (/^\/(conversations|messages|contact-requests|users\/me)/.test(path) && !authenticated) { send({ error: '请先登录' }, 401); return; }
  if (path === '/posts/featured') { send({ posts: [] }); return; }
  if (path === '/ads') { send([]); return; }
  if (path === '/users/me/blocks') { send({ blocks: [] }); return; }
  if (path === '/contact-requests') { send({ requests: [] }); return; }
  if (path === '/posts' || path === '/users/me/posts') {
    const page = Number(url.searchParams.get('page') || 1), limit = Number(url.searchParams.get('limit') || 5);
    const category = url.searchParams.get('category'), city = url.searchParams.get('city'), type = url.searchParams.get('type'), keyword = url.searchParams.get('keyword');
    const filtered = posts.filter(p => path === '/users/me/posts' ? p.authorId === viewer.id : p.status !== 'closed' && (!type || p.type === type) && (!city || p.city === city) && (!keyword || p.title.includes(keyword)) && (!category || (category === '本地服务' ? ['清洁', '搬家', '维修', '翻译'].includes(p.category) : p.category === category)));
    send({ posts: filtered.slice((page - 1) * limit, page * limit), hasMore: page * limit < filtered.length, filtersApplied: true }); return;
  }
  if (/^\/users\/[^/]+\/public$/.test(path)) { const selected = path.includes(viewer.id) ? viewer : neighbor; const { email, token, contactType, contactValue, ...publicProfile } = selected; send({ ...publicProfile, postCount: 18, recentPosts: posts.filter(p => p.authorId === selected.id).slice(0, 3) }); return; }
  if (path === '/users/me' && req.method === 'PATCH') { Object.assign(viewer, data); send(viewer); return; }
  if (path === '/conversations/open-or-create') { send(conversations[0]); return; }
  if (path === '/conversations') { send(conversations); return; }
  if (/^\/conversations\/[^/]+\/read$/.test(path)) { const conversation = conversations.find(item => item.id === path.split('/')[2]); if (conversation) conversation.unreadCount = 0; send({ conversationId: conversation?.id, unreadCount: 0 }); return; }
  if (/^\/conversations\/[^/]+\/messages\/[^/]+\/reaction$/.test(path)) { const message = messages.find(item => item.id === path.split('/')[4]); if (!message) { send({ error: 'Not found' }, 404); return; } message.reactions = (message.reactions || []).map(item => ({ ...item, userIds: item.userIds.filter(id => id !== viewer.id) })).filter(item => item.userIds.length); if (data.emoji) { const group = message.reactions.find(item => item.emoji === data.emoji); if (group) group.userIds.push(viewer.id); else message.reactions.push({ emoji: data.emoji, userIds: [viewer.id] }); } message.reactionVersion = (message.reactionVersion || 0) + 1; send(message); return; }
  if (/^\/conversations\/[^/]+\/messages$/.test(path)) {
    const conversationId = path.split('/')[2];
    if (req.method === 'POST') { const target = messages.find(item => item.id === data.replyToId && item.conversationId === conversationId); const message = { ...data, id: `demo-message-${Date.now()}`, conversationId, senderId: viewer.id, createdAt: Date.now(), ...(target ? { replyTo: { id: target.id, senderId: target.senderId, content: target.content.slice(0, 240) } } : {}) }; messages.push(message); send(message); }
    else send(messages.filter(item => item.conversationId === conversationId));
    return;
  }
  if (/^\/posts\/[^/]+\/comments$/.test(path)) { send([]); return; }
  if (/^\/posts\/[^/]+\/contact/.test(path)) { send({ status: 'not_requested', methods: [], request: null }); return; }
  if (path.startsWith('/posts/')) {
    const id = path.split('/')[2];
    if (id === 'server-error') { send({ error: '本地模拟服务暂时不可用' }, 503); return; }
    const post = posts.find(p => p.id === id);
    if (!post) { send({ error: '内容不存在' }, 404); return; }
    if (req.method === 'PUT') Object.assign(post, data, { updatedAt: Date.now(), ...(data.confirmAvailability ? { confirmedAt: Date.now() } : {}) });
    send(post); return;
  }
  send({ error: 'Fixture route not configured' }, 404);
});
server.listen(3000, '127.0.0.1', () => process.stdout.write('BAYLINK local fixture: http://localhost:3000 (no external services)\n'));
