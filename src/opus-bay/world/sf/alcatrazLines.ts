import type { Bilingual } from '../../core/types';

/**
 * Wave 8 · lane A · BAYBAY's fixed lines for the Alcatraz ferry and the island (zh + en, no templates: lane X voices
 * them by their exact text, data/sf/voiceW8.ts). Light but respectful: a national park, a federal prison 1934–63, the
 * 1969–71 occupation by Indians of All Tribes (NPS sources only). PURE data.
 *
 * Facts (read 2026-09-30):
 * - The walk from the dock to the cellhouse: about 1⁄4 mile and 130 ft up, "roughly equivalent to climbing a 13 story
 *   building" — https://www.nps.gov/alca/planyourvisit/accessibility.htm
 * - The penitentiary 1934–1963; a national park today — https://www.nps.gov/alca/index.htm
 * - The occupation: Indians of All Tribes arrived on 20 November 1969 and held the island for almost 19 months, until
 *   11 June 1971, to call attention to Native Americans' rights — https://www.nps.gov/places/19-indian-occupation.htm,
 *   https://www.nps.gov/goga/learn/historyculture/alcatraz-occupation.htm
 *
 *   board      BAYBAY on boarding the Alcatraz boat (game/transit.ts lineTick)
 *   ashore     stepping off at the island's dock (game/transit.ts leaveLineRide)
 *   backAt33   stepping off back at Pier 33
 *   stair      at the foot of the stairway, the first time (world/sf/alcatrazFerry.ts island watcher)
 *   arrive     the island's arrival moment at the cellhouse front (game/arrival.ts via data/sf/attractions ISLAND_LANDINGS)
 *   occupation a while after the arrival, on the plateau, once a visit
 *   wayBack    on the island without the ferry (gliding in): how to get back
 */
export const ALCA_LINES = {
  board: { zh: '开往恶魔岛！往西看是金门大桥，回头看是海湾大桥。', en: 'Off to Alcatraz! The Golden Gate is to the west, the Bay Bridge back east.' },
  ashore: { zh: '上岛啦。这里以前是联邦监狱，现在是国家公园，我们轻声走、慢慢看。', en: 'We’re on the island. It was a federal prison; now it’s a national park. Let’s walk quietly and take our time.' },
  backAt33: { zh: '回到 33 号码头啦。恶魔岛，去过咯！', en: 'Back at Pier 33. Alcatraz: been there!' },
  stair: { zh: '监狱楼在坡顶上。真的岛上，从码头走上去差不多等于爬 13 层楼！', en: 'The cellhouse is up the hill. On the real island, the walk up from the dock is like climbing 13 storeys!' },
  arrive: { zh: '这就是恶魔岛的监狱楼。1934 到 1963 年，这里是联邦监狱。', en: 'This is Alcatraz’s cellhouse. From 1934 to 1963 it was a federal prison.' },
  occupation: { zh: '1969 年，“所有部落的印第安人”来到岛上，守了将近 19 个月，为原住民的权利发声。', en: 'In 1969, Indians of All Tribes came to the island and held it for almost 19 months, speaking up for Native rights.' },
  wayBack: { zh: '想回城里？去岛上的码头叫船，小渡轮随时来接我们。', en: 'Ready to head back? Call the boat at the island’s dock: the little ferry always comes for us.' },
} as const satisfies Record<string, Bilingual>;
