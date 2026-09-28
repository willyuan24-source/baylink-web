# BAYBAY — voice sheet (Opus Bay)

Owner: content. Read this before writing or editing any line in `data/script.ts`, `data/pois.ts` barks or `data/postcards.ts`.

## Who BAYBAY is

BAYBAY is BAYLINK's cream-white sea otter: a local who has walked the Embarcadero a thousand times and still gets excited about it.
BAYBAY meets newcomers at the ferry, walks them along the water and hands them over to BAYLINK when they are ready to plan a real outing.

- **Warm and curious.** Asks, notices, points things out. Treats the player as a new friend, never as a customer.
- **Loves** the waterfront, sourdough, the sea lions at PIER 39, a good bench with a bay view, the fog.
- **Gently funny.** Small jokes, never at the player's expense. The fog is called "Karl" like locals do ("Karl 今天请假了"). Sea-lion puns are allowed once per scene.
- **Honest.** BAYBAY says "出发前查官网确认" instead of pretending to know today's hours. Wildlife is never guaranteed ("看缘分").
- **Never salesy.** No "must buy", no "best deal", no brand praise. Paid things are named as options, free things first.
- **Local, not a tour-bus mic.** Specific over generic: "周四晚上 After Dark 只限 18+", not "a great place for everyone".

## Line rules

1. One bubble = one idea. Chinese ≤ 45 characters (hard limit, tested). English ≤ ~110 characters.
2. Every stop teaches exactly **one real, specific, useful fact**, and every fact in a line has a source in `pois.ts` / `postcards.ts` (`sourceUrl`, `verifiedAt`). No invented numbers.
3. Hours/prices: always hedged ("约", "多数时候", "出发前查官网"). Never promise an event or a light show.
4. Real people are never impersonated. NPCs (vendor, fisher, streetcar operator, tourist family, jogger) are clearly fictional characters with first names only, and they never state facts that are not sourced.
5. No controller-specific hints in dialogue ("按 E"): the HUD shows the right key or button. Say "走过去看看", not "press E".
6. Chinese is written in Simplified Chinese; Traditional is derived automatically. Avoid regional slang that does not convert well.
7. English is natural, not a word-for-word translation. Same facts, same warmth, same length budget.
8. BAYLINK is mentioned only when it genuinely helps: credited tips ("BAYLINK 攻略说…") and the final handoff ("把想去的地方带去 BAYLINK 安排吧").

## Moods (`Mood` in core/types.ts)

| mood | use |
|---|---|
| `wave` | hello, goodbye, calling the player over |
| `happy` | default warm line |
| `excited` | discoveries, sea lions, postcards |
| `point` | "look at that" — landmark introductions |
| `thinking` | questions, honest caveats ("这个我也得查一下") |
| `proud` | tour milestones, recap |

## Sample lines

- 嗨！欢迎来到湾区～我是 BAYBAY。第一次来吗？ / Hi! Welcome to the Bay — I'm BAYBAY. First time here?
- Karl 今天好像请假了，天这么蓝，走起！ / Looks like Karl the Fog took the day off. Let's go!
- 海狮不收门票，但也不保证准时上班——看缘分。 / The sea lions are free, but they don't keep office hours.
- 票价我记不住最新的，出发前一定查官网哦。 / I can never remember the latest prices — check the official site before you go.

---

# City mode (whole San Francisco, wave 3)

Owner: lane G2. The lines live in `data/sf/lines.ts` (BAYBAY's event and neighbourhood lines, the frozen `BARK_SCRIPT`),
`data/script.ts` (city nodes: `*.city`, the transit hooks, the crews) and `data/sf/cityPois.ts` / `postcards.ts` (cards).

## BAYBAY in the city

Same otter, bigger backyard. In the city BAYBAY is less a tour guide than a travel buddy: she greets each neighbourhood
the first time you walk in, cheers the first time you do something new (bike, toy car, pelican, cable car, ferry,
F-line, a steep hill, a crest hop) and says "哎呀" when you really crash. She never explains controls in a line (the HUD
does), never reads a sign aloud, and never talks just to fill silence.

- **Short and physical.** A reaction is a feeling first ("呼…这坡好陡！"), one small fact at most after it.
- **Neighbourhoods are people's homes.** Greetings are warm and specific ("你好，北滩！这里是旧金山的「小意大利」。"), never
  a ranking, never "the dangerous part of town". No neighbourhood is described by crime, rent or who lives there.
- **Karl the Fog** stays a friend ("Karl 最爱来这儿"), in the Sunset and at the Gate.

## Transit crews and residents (fictional)

- **Gripman (叮当车司机)**: brisk, proud of the bell, safety first ("抓紧扶杆！"). Talks about the grip and the bell, never
  about fares (they change; the card links the official page). Lines: `npc.gripman`, `cablecar.station`.
- **Deckhand (渡轮水手)**: breezy, sea-minded, points at gulls and the rail. Lines: `npc.deckhand`, `ferry.station`.
- **Residents** (`data/sf/residents.ts`, words in `data/sf/dialogue.ts`): first names only, no business names, no real
  people; each introduces themself with one sourced fact about their corner, asks one small favour, and thanks you with
  a second fact. They never state a fact that is not in `RESIDENT_SOURCES` with its URL and date.

  | who | where | voice | favour |
  |---|---|---|---|
  | 叮当车司机 Ray | Powell & Market turntable | the crews' brisk gripman, bell-proud, "叮叮" | take a real ride (a few stops: lane F counts 150 u) |
  | 面包师 Rosa | by Washington Square, North Beach | warm, a little bossy about warm bread ("趁热") | take a loaf to Ray |
  | 画壁画的 Luz | Balmy Alley | bright, talks in colours and walls | find the mural postcard in Clarion Alley |
  | 园丁 Hank | Conservatory of Flowers | slow, patient ("花儿慢慢长") | check the tulip garden by the windmill |
  | 巡护员 Dana | Crissy Field | outdoorsy, practical ("抓好帽子") | walk the bridge deck to the south tower |
  | 唱片店老板 Marcus | Haight & Ashbury | laid-back, music first, calls the fog Karl | look from Twin Peaks for Karl |

  Rules: a resident never asks for money, a purchase or a real shop visit; "带我去" is always offered in the reminder; a
  favour finishes the moment you do it (BAYBAY: "完成啦！回去告诉 X 吧～"), and the thanks can be heard any time after.
  Tulips: say when they bloom (usually March), never that they are in bloom now. No time-of-day greetings ("早呀 /
  Morning"): a chat can happen at any hour of the Bay's clock, night included.
  A place favour (the tulips, the lookout, the bridge deck) counts when you get there on foot, by bike or in the toy
  car; flying there (飞过去 or the pelican) and standing still does not — step out and back in.
  BAYBAY in a resident's chat: she steps beside them and listens (no lines of her own inside it). From the call menu,
  "附近有什么？" names one neighbour within about a minute whose favour you have not taken yet ("Rosa 就在附近，好像想找人
  帮个忙！") and offers "去找 …" — a hint, never a nag: once you said yes, the favour leads the "next goal" instead.

## Event and neighbourhood lines (`data/sf/lines.ts`, scheduled by `game/baybayLines.ts`)

1. **The recorded phrase comes first.** A spoken line's bubble STARTS with its `BARK_SCRIPT` phrase (zh and en, tested);
   the rest of the bubble is text only. The phrase is ≤ 2 s spoken (≈ 9 zh syllables / 6 en words); the whole bubble
   keeps the ≤ 45 zh rule.
2. **`BARK_SCRIPT` is frozen.** A recorded id never changes its words: new wording = a new id and a new recording
   (lane H2b). Ids: `first-*` (once per save), reactions (`bump-hard`, `stairs`, `pant`, `crest-again`, `glide-again`,
   `glide-land`, `glide-no-landing`), transit (`cable-bell`, `turntable-push`), `zone-<far.zones id>` greetings and the
   template opener `zone-new` ("新街区！这里是{name}～").
3. **When BAYBAY speaks:** 60 s per key at least (crest repeats every 3 min, glide every 2 min), ≥ 8 s between two of
   these lines, never over a bubble on screen (anyone's) nor within 1 s of one; silent in dialogue, cinematics, fast
   travel, photo mode, postcard rewards, open panels and the "I'm a local" quiet minute. A reaction that cannot be said
   within 3 s is dropped (stale); a first waits up to 12 s; a greeting waits while you stay in that neighbourhood.
   While you glide, greetings are held and only the neighbourhood you land in is greeted. Hard bumps only.
4. **Once per save** (`opus-bay:lines:v1`): the firsts and every greeting. Settings → reset clears it (G1 request).
5. **Facts in lines** carry a source and the date checked (`LineSource` in `data/sf/lines.ts`), like the cards.
6. The pass-by landmark bark (brain) waits for a bubble on screen in city mode, so a greeting is never cut short.

## zh glossary (matched to the HUD's neighbourhood labels, far.zones)

| en | zh (say this) | not | note |
|---|---|---|---|
| Twin Peaks | 双峰 | 双子峰 | HUD 双峰 |
| Chinatown | 唐人街 | 中国城 | |
| cable car | 叮当车 | 缆车 | in dialogue, bubbles, goals and cards; "缆车" only in technical text (the cable system) |
| Presidio | 要塞公园 | Presidio (in zh) | HUD 要塞公园 |
| Marina | 马里纳区 | 码头区 | HUD 马里纳区 (码头区 is the Embarcadero piers in speech) |
| Castro | 卡斯特罗 | 卡斯楚（区） | HUD 卡斯特罗 |
| Mission | 教会区 | 米慎区 | Mission Dolores = 多洛雷斯传教站 |
| Haight-Ashbury | 海特街 (spoken) | | HUD 海特-阿什伯里; the recorded greeting says 海特街 |
| Financial District | 金融区 | | HUD 金融区 · 南滩 |
| Sunset | 日落区 | | HUD 日落区 · 帕克赛德 |
| North Beach · Nob Hill · Russian Hill | 北滩 · 诺布山 · 俄罗斯山 | | |
| Hayes Valley · Japantown · SoMa | 海斯谷 · 日本城 · 南市场 (SoMa) | | |
| Potrero Hill · Mission Bay · Outer Richmond | 波特雷罗山 · 米慎湾 · 外列治文 | | |
| Golden Gate Park · Lincoln Park | 金门公园 · 林肯公园 | | |
| Lombard St (crooked block) | 九曲花街 | | |
| Painted Ladies | 彩绘女士 | | at 阿拉莫广场 (Alamo Square) |
| Legion of Honor · Chase Center · Sutro Baths | 荣勋宫美术馆 · 大通中心 · 苏特罗浴场 | | |
| streetcar (F-line) | 老电车 / F 线电车 | | |
| Karl the Fog | Karl | | always the name, never "大雾" alone |

### Wave 4 additions (lane C: the new places, the lines, the Grand Tour)

English stays primary on the real signs (station names on the Metro strip, "Van Ness" in English); the gloss below is
what BAYBAY says and what the cards print. SFMTA's own Chinese station list could not be found on sfmta.com (checked
2026-09-27, zh-hant site): the local forms 卡斯楚 / 雲尼斯 differ from our 卡斯特罗站 / "Van Ness 站", which stay (plan R11).

| en | zh (say this) | not | note |
|---|---|---|---|
| Stonestown Galleria | 石镇购物中心 · 石镇 | | alias 石头城 (search only) |
| San Francisco State University | 旧金山州立大学 · 州立大学 · 州大 | | the student centre has no name in 2026: never name the building |
| University of San Francisco | 旧金山大学 | 旧金山州立大学 | USF, Lone Mountain |
| UCSF Parnassus · UCSF Mission Bay | 加州大学旧金山分校 · 帕纳萨斯 / 米慎湾校区 | | short UCSF |
| City College of San Francisco | 旧金山城市学院 | | the Rivera mural is in storage until ≈ 2028 |
| Blue Heron Lake | 蓝鹭湖（原斯托湖） | 斯托湖 alone | renamed 18 Jan 2024 |
| de Young Museum | 迪扬博物馆 | | |
| Clement St | 克莱门街 | 企李街 | 企李街 is Clay St (Chinatown) |
| Grant Ave · Irving St | 都板街 · 尔文街 | | |
| Bay Bridge · Treasure Island | 海湾大桥 · 金银岛 | | |
| Marina Green | 码头绿地 | 码头区 (as an alias) | the lawn's own name (decided in the wave-4 verify, R2-O1 closed: it stays 码头绿地); 码头区 is the Embarcadero piers, never a name for it; the frozen loop tip says 海滨草地 as a description |
| Lands End | 天涯海角 | 海角 alone | the attractions, cards, stations and the recorded tour lines; the landmark zone labels read 林肯公园 · 天涯海角 / 天涯海角 · 海洋海滩北端 (cityPois ZH_TEXT_NAMES) |
| Coit Tower · Filbert Steps | 科伊特塔 · 菲尔伯特台阶 | Coit Tower (in zh) | the city goal, the map and route R1; the district's frozen texts keep theirs |
| Lakeshore · Visitacion Valley · Ingleside | 湖岸区 · 维西塔西翁谷 · 英格尔赛德 | 湖滨区 · 访谷 (as a zone) · 英格塞德 | the HUD labels (far.zones); 访谷 lives on only inside the greenway's name (访谷绿道) |
| Ocean Beach · Dolores Park · Sutro Baths · Crissy Field | 海洋海滩 · 多洛雷斯公园 · 苏特罗浴场 · 克里西场 | the English names inside zh sentences | card text uses the zh names (C7); names of people, brands and streets without a game name stay English |
| Chinatown (OSM) · SoMa West · Presidio Heights | 唐人街 · 西南市场 · 要塞高地 | 中国城 · 西索玛 / 索玛区 · 普雷西迪奥高地 | place-card titles via ZH_GLOSSARY; the map's own names are lane P's PLACE_NAME_FIXES |
| Pier 33 Alcatraz Landing · Pier 14 | 恶魔岛渡轮码头 · 33 号码头 · 14 号码头 | | where the island trips end (lane P's ARRIVAL_PLACES) |
| Corona Heights | 科罗娜高地 | | the panorama is at the summit |
| the sightseeing bus / loop | 观光巴士 / 观光环线 | 旅游巴士 | coral 观光 roundel |
| N Judah · M Ocean View | N 线 · M 线 | | Muni Metro = 地铁 in speech |
| Embarcadero · Montgomery · Powell · Civic Center stations | 内河码头站 · 蒙哥马利站 · 鲍威尔站 · 市政中心站 | | Van Ness stays "Van Ness 站" |
| Church · Castro · Forest Hill · West Portal stations | 教堂街站 · 卡斯特罗站 · 森林山站 · 西门站 | 卡斯楚站 | |
| Holloway (the M stop at SF State) | Holloway | | no Chinese name |
| Sunset Tunnel · Twin Peaks Tunnel | 日落隧道 · 双峰隧道 | | |
| the Grand Tour | 环游旧金山 · 一日游 | | "继续一日游 · 第 3 章" when resumed |
