import { SF_EXTRA_DISCOVERIES } from './sf-extra-discoveries';
import type { DiscoveryChallenge } from './SfDiscoveryChallenge';

export type SfStoryText = { zh: string; en: string };
export type SfEncounterChoice = { id: string; label: SfStoryText; memory: SfStoryText };
export type SfExplorationStop = {
  id: string;
  name: SfStoryText;
  stamp: SfStoryText;
  symbol: string;
  color: string;
  prompt: SfStoryText;
  choices: readonly SfEncounterChoice[];
  challenge?: DiscoveryChallenge;
};
const text = (zh: string, en: string): SfStoryText => ({ zh, en });
const choice = (id: string, zh: string, en: string, memoryZh: string, memoryEn: string): SfEncounterChoice => ({ id, label: text(zh, en), memory: text(memoryZh, memoryEn) });

/** Authored, fictional moments in the miniature world, never evidence of a real visit. */
export const SF_EXPLORATION_STOPS: readonly SfExplorationStop[] = [
  ...SF_EXTRA_DISCOVERIES,
  { id: 'park', name: text('金门公园', 'Golden Gate Park'), stamp: text('公园慢时光', 'A slower afternoon'), symbol: '✿', color: '#6e8e59', prompt: text('BAYBAY 带来一块野餐布。给这次公园探险选一个开场吧。', 'BAYBAY brought a picnic blanket. How should this park adventure begin?'), choices: [choice('picnic', '铺开野餐布', 'Spread the blanket', '树影落在野餐布上。今天的冒险，从慢下来开始。', 'Leaf shadows fall across the blanket. Today’s adventure begins by slowing down.'), choice('sketch', '画一张公园速写', 'Sketch the park', 'BAYBAY 把温室、树和你的小小脚印画进了旅行本。', 'BAYBAY draws the conservatory, the trees and your tiny footprints in the journal.')] },
  { id: 'japanese-tea-garden', name: text('日本茶园', 'Japanese Tea Garden'), stamp: text('一园静谧', 'A quiet garden'), symbol: '❀', color: '#bd7864', prompt: text('走进这座迷你茶园，BAYBAY 请你帮旅行本留下一种心情。', 'Inside the miniature tea garden, BAYBAY wants a feeling to remember.'), choices: [choice('bridge', '在小桥旁停一会儿', 'Pause by the bridge', '水面把小桥倒映成另一座安静的花园。BAYBAY 也放轻了脚步。', 'The bridge reflects into another quiet garden. Even BAYBAY takes smaller steps.'), choice('tea', '想象一杯暖茶', 'Imagine a warm cup of tea', '一杯想象中的暖茶，和一段没有赶路的午后。', 'An imaginary warm cup of tea, and an afternoon with nowhere to rush.')] },
  { id: 'academy', name: text('加州科学馆', 'California Academy of Sciences'), stamp: text('小小科学家', 'Little explorer'), symbol: '✦', color: '#608e87', prompt: text('BAYBAY 的想象实验室开门了。今天想先探索哪里？', 'BAYBAY’s imaginary science lab is open. Where will you explore first?'), choices: [choice('ocean', '想象深海探险', 'Imagine a deep-sea dive', '你和 BAYBAY 坐进想象中的潜水艇，把一束蓝光装进明信片。', 'You and BAYBAY take an imaginary submarine ride and save a little blue light on a postcard.'), choice('stars', '写一封给星星的信', 'Write a letter to the stars', 'BAYBAY 在信封上画了一颗星：愿好奇心带我们去更远的地方。', 'BAYBAY draws a star on the envelope: may curiosity take us somewhere new.')] },
  { id: 'de-young', name: text('笛洋美术馆', 'de Young'), stamp: text('城市调色盘', 'City palette'), symbol: '◇', color: '#a78160', prompt: text('给 BAYBAY 的旧金山明信片选一种主色调。', 'Choose a color story for BAYBAY’s San Francisco postcard.'), choices: [choice('copper', '暖铜色与树影', 'Warm copper and leaf shadows', '铜色建筑和绿色树影，被你拼成了一张小小的城市画。', 'Copper architecture and green leaf shadows become your little city picture.'), choice('sky', '天空蓝与薄雾', 'Sky blue and soft fog', '你留下一大片天空，BAYBAY 在角落画了一个小小的自己。', 'You leave plenty of room for the sky. BAYBAY draws a tiny self-portrait in the corner.')] },
  { id: 'ferry', name: text('渡轮大厦', 'Ferry Building'), stamp: text('海湾出发站', 'Hello, waterfront'), symbol: '◷', color: '#9a8464', prompt: text('钟楼下的 BAYBAY 正在写旅行本的第一句话。你来选吧。', 'Under the clock tower, BAYBAY needs the first line of a waterfront journal.'), choices: [choice('breeze', '跟着海风出发', 'Follow the bay breeze', '今天没有赶船，我们跟着海风，慢慢走向码头。', 'No ferry to catch today. We follow the bay breeze slowly toward the piers.'), choice('hello', '向海湾说声你好', 'Say hello to the bay', 'BAYBAY 挥了挥小爪子。海面送回来一闪一闪的回答。', 'BAYBAY waves a little paw. The bay answers with a shimmer.')] },
  { id: 'pier', name: text('39 号码头', 'PIER 39'), stamp: text('海狮观察员', 'Sea lion observer'), symbol: '≈', color: '#7b9b9a', prompt: text('迷你码头传来热闹的声音。用什么方式记录这次海狮相遇？', 'The miniature dock sounds lively. How will you remember meeting the sea lions?'), choices: [choice('listen', '安静听一会儿', 'Listen quietly', 'BAYBAY 数着一声声叫声，最后自己也忍不住哼起了码头小调。', 'BAYBAY counts the calls, then hums a little dockside tune.'), choice('draw', '画一张海狮明信片', 'Sketch a sea lion postcard', '一团圆滚滚的海狮，加上一点点海风，就是今天最可爱的明信片。', 'A round sea lion and a little sea breeze make today’s cutest postcard.')] },
  { id: 'skystar', name: text('天星摩天轮', 'SkyStar Wheel'), stamp: text('转一圈的愿望', 'A wish above the bay'), symbol: '☼', color: '#b79855', prompt: text('迷你摩天轮慢慢转动。给这片海湾许一个小愿望。', 'The miniature wheel turns slowly. Make a little wish for this bay.'), choices: [choice('friends', '下次和朋友一起', 'Come back with a friend', 'BAYBAY 留了一个座位：下一次，把喜欢这里的人也带来。', 'BAYBAY saves a seat: next time, bring someone who will love this place too.'), choice('sunset', '收集一场日落', 'Collect a sunset', '你把一小片金色天空，夹进旅行本最温暖的一页。', 'You tuck a patch of golden sky into the warmest page of the journal.')] },
  { id: 'lands-end', name: text('天涯海角', 'Lands End'), stamp: text('风的来信', 'A letter from the wind'), symbol: '⌁', color: '#819783', prompt: text('海岸边的 BAYBAY 找到一张空白明信片。写给谁呢？', 'By the coast, BAYBAY finds a blank postcard. Who is it for?'), choices: [choice('future', '写给未来的自己', 'Write to your future self', '记得偶尔走到城市边缘，让海风帮忙把思绪吹整齐。', 'Remember to visit the edge of the city sometimes. Let the sea breeze untangle your thoughts.'), choice('friend', '写给远方的朋友', 'Write to a faraway friend', '这里有海、有风，还有一只想带你逛旧金山的小海獭。', 'There is an ocean, a breeze, and a little otter who wants to show you San Francisco.')] },
  { id: 'ocean-beach', name: text('海洋海滩', 'Ocean Beach'), stamp: text('沙滩脚印', 'Footprints by the ocean'), symbol: '≋', color: '#b39c72', prompt: text('BAYBAY 想在迷你沙滩留下一个小作品。一起动手吧。', 'BAYBAY wants to make something on the miniature beach. Join in.'), choices: [choice('castle', '堆一座迷你沙堡', 'Build a tiny sandcastle', '歪歪的小塔，宽宽的城门。BAYBAY 宣布：这就是今天的沙滩王国。', 'Crooked little towers, a generous front gate. BAYBAY declares it today’s sand kingdom.'), choice('heart', '画一颗大大的心', 'Draw a big heart', '海风经过，沙滩上的心把这趟小旅行悄悄留住。', 'The breeze passes. A heart in the sand quietly keeps this little journey.')] },
  { id: 'baker-beach', name: text('贝克海滩', 'Baker Beach'), stamp: text('桥与海的合影', 'Bridge and sea'), symbol: '⌒', color: '#bc8c6e', prompt: text('给 BAYBAY 的海岸合影选一个构图。', 'Pick a composition for BAYBAY’s coastal portrait.'), choices: [choice('bridge', '把大桥留在远方', 'Keep the bridge in the distance', 'BAYBAY 很小，大桥很远，海和天空刚好装满整张照片。', 'A tiny BAYBAY, a distant bridge, and just enough sea and sky to fill the picture.'), choice('footprints', '让脚印带路', 'Let the footprints lead', '一串小脚印从画面边缘走来，把你带回这个有风的下午。', 'A trail of tiny footprints leads into the picture and back to this breezy afternoon.')] },
  { id: 'bridge', name: text('金门大桥', 'Golden Gate Bridge'), stamp: text('金门终点章', 'A golden finish'), symbol: 'Π', color: '#bc7764', prompt: text('来到红色大桥前，给这段旅程选一个结尾。', 'At the red bridge, choose the ending to this little journey.'), choices: [choice('wave', '朝海湾挥挥手', 'Wave to the bay', 'BAYBAY 挥手告别，又回头看了一眼：下次，还想再来。', 'BAYBAY waves goodbye, then looks back once more: let’s come here again.'), choice('next', '约定下一次冒险', 'Plan the next adventure', '旅行本合上了，但地图上还有许多值得慢慢发现的地方。', 'The journal closes, but there are still so many places waiting on the map.')] },
  { id: 'chinatown', name: text('唐人街', 'Chinatown'), stamp: text('街角的问候', 'A neighborhood hello'), symbol: '❖', color: '#ac725a', prompt: text('街角导览员 Momo 请你帮忙，为今天的小镇选一句问候。', 'Momo, the neighborhood guide, asks you to choose today’s greeting.'), choices: [choice('welcome', '欢迎来我们的小镇', 'Welcome to our little town', '一句欢迎，让陌生的街道也开始像熟悉的邻里。', 'A simple welcome makes an unfamiliar street feel a little more like a neighborhood.'), choice('wander', '一起慢慢逛吧', 'Let’s wander together', 'BAYBAY 跟上你的脚步，把下一个街角留给好奇心。', 'BAYBAY follows your footsteps, leaving the next corner to curiosity.')] },
];

export const SF_EXPLORATION_STOP_BY_ID: Readonly<Record<string, SfExplorationStop>> = Object.assign(Object.create(null) as Record<string, SfExplorationStop>, Object.fromEntries(SF_EXPLORATION_STOPS.map(stop => [stop.id, stop])));
export type SfExplorationRoute = { id: string; title: SfStoryText; description: SfStoryText; duration: SfStoryText; color: string; stopIds: readonly string[] };
export const SF_EXPLORATION_ROUTES: readonly SfExplorationRoute[] = [
  { id: 'city-curiosity', title: text('城市里的小实验', 'Little city experiments'), description: text('点亮光线、拼出天际线，再登上想象中的云端花园。', 'Mix light, build a skyline and visit an imaginary garden above the streets.'), duration: text('游戏约 4–6 分钟', 'About 4–6 min in the game'), color: '#648d8d', stopIds: ['exploratorium', 'city-hall', 'salesforce', 'transamerica'] },
  { id: 'campus-curiosity', title: text('带着问题逛校园', 'A pocketful of campus questions'), description: text('纸飞机、校园暗号与街区小贝壳。', 'A paper plane, a campus code and a little neighborhood shell.'), duration: text('游戏约 4–5 分钟', 'About 4–5 min in the game'), color: '#9981a3', stopIds: ['ucsf-parnassus', 'sf-state', 'stonestown'] },
  { id: 'park-day', title: text('公园里的好奇心', 'A curious park afternoon'), description: text('小桥、科学与艺术，一次慢慢发现的公园旅行。', 'A garden bridge, a little science and a little art.'), duration: text('游戏约 3–4 分钟', 'About 3–4 min in the game'), color: '#688466', stopIds: ['park', 'japanese-tea-garden', 'de-young', 'academy'] },
  { id: 'waterfront-day', title: text('沿着海湾遇见你', 'Hello along the waterfront'), description: text('从钟楼走向海狮码头，把愿望留给摩天轮。', 'From the clock tower to sea lions and a wish at the wheel.'), duration: text('游戏约 2–3 分钟', 'About 2–3 min in the game'), color: '#609195', stopIds: ['ferry', 'pier', 'skystar'] },
  { id: 'coastal-day', title: text('海风收集计划', 'Collect a little sea breeze'), description: text('沙滩、海岸与大桥，每一站都留下一张回忆。', 'Beaches, coastal views and a bridge, one memory at a time.'), duration: text('游戏约 3–4 分钟', 'About 3–4 min in the game'), color: '#b58c65', stopIds: ['ocean-beach', 'lands-end', 'baker-beach', 'bridge'] },
];

export type SfSystemResident = { id: string; name: string; landmarkId: string; role: SfStoryText; greeting: SfStoryText; recommendationIds: readonly string[]; symbol: string; color: string };
export const SF_RESIDENTS: readonly SfSystemResident[] = [
  { id: 'fern', name: 'Fern', landmarkId: 'japanese-tea-garden', role: text('公园小向导', 'Park guide'), greeting: text('先到茶园放慢脚步，再去看看艺术和科学。每一站，我都给你留了一张旅行章。', 'Slow down in the tea garden, then make room for art and science. A little journal stamp is waiting at every stop.'), recommendationIds: ['japanese-tea-garden', 'de-young', 'academy'], symbol: '✿', color: '#789164' },
  { id: 'kai', name: 'Kai', landmarkId: 'pier', role: text('海湾观察员', 'Bay watcher'), greeting: text('来听听迷你海狮的热闹，再去摩天轮前许个愿。想走远一点，就去西边看看海。', 'Meet the miniature sea lions, then make a wish by the wheel. For a longer adventure, head west to the ocean.'), recommendationIds: ['pier', 'skystar', 'ocean-beach'], symbol: '≈', color: '#6a969b' },
  { id: 'momo', name: 'Momo', landmarkId: 'chinatown', role: text('街角导览员', 'Neighborhood guide'), greeting: text('从一句你好认识这座小镇。我的散步清单里，有唐人街、海湾钟楼，还有公园里的安静角落。', 'Meet the town with a simple hello. My little list includes Chinatown, the waterfront clock tower and a quiet garden corner.'), recommendationIds: ['chinatown', 'ferry', 'japanese-tea-garden'], symbol: '❖', color: '#b78367' },
];

export type SfExplorationStamp = { collectedAt: string; choiceId: string };
export type SfExplorationProgress = { version: 1; stamps: Record<string, SfExplorationStamp>; activeRouteId: string | null };
export const emptySfExploration = (): SfExplorationProgress => ({ version: 1, stamps: {}, activeRouteId: null });
export const sfExplorationStorageKey = (ownerId?: string) => `baylink.mini-sf.journal.v1:${ownerId ? `user:${encodeURIComponent(ownerId)}` : 'guest'}`;

/** Read only known IDs and well-formed memories; old or corrupt saves cannot award stamps. */
export function parseSfExploration(raw: string | null): SfExplorationProgress {
  if (!raw || raw.length > 50_000) return emptySfExploration();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return emptySfExploration();
    const data = value as Record<string, unknown>;
    const progress = emptySfExploration();
    if (typeof data.activeRouteId === 'string' && SF_EXPLORATION_ROUTES.some(route => route.id === data.activeRouteId)) progress.activeRouteId = data.activeRouteId;
    if (!data.stamps || typeof data.stamps !== 'object' || Array.isArray(data.stamps)) return progress;
    const stamps = data.stamps as Record<string, unknown>;
    for (const stop of SF_EXPLORATION_STOPS) {
      const entry = stamps[stop.id];
      if (!entry || typeof entry !== 'object') continue;
      const stamp = entry as Record<string, unknown>;
      if (typeof stamp.collectedAt !== 'string' || stamp.collectedAt.length > 40 || !Number.isFinite(Date.parse(stamp.collectedAt))) continue;
      if (typeof stamp.choiceId !== 'string' || !stop.choices.some(item => item.id === stamp.choiceId)) continue;
      progress.stamps[stop.id] = { collectedAt: stamp.collectedAt, choiceId: stamp.choiceId };
    }
    return progress;
  } catch { return emptySfExploration(); }
}

export function sfRouteProgress(progress: SfExplorationProgress, route: SfExplorationRoute) {
  const completed = route.stopIds.filter(id => Boolean(progress.stamps[id])).length;
  return { completed, total: route.stopIds.length, nextStopId: route.stopIds.find(id => !progress.stamps[id]) ?? null };
}

export function collectSfExplorationStamp(progress: SfExplorationProgress, landmarkId: string, currentNearId: string | null, choiceId?: string, now = new Date()): SfExplorationProgress {
  const stop = SF_EXPLORATION_STOP_BY_ID[landmarkId];
  if (landmarkId !== currentNearId || !stop || progress.stamps[landmarkId]) return progress;
  const chosen = choiceId ?? stop.choices[0]?.id;
  if (!stop.choices.some(item => item.id === chosen) || !Number.isFinite(now.getTime())) return progress;
  return { ...progress, stamps: { ...progress.stamps, [landmarkId]: { collectedAt: now.toISOString(), choiceId: chosen! } } };
}
