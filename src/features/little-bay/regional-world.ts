export type RegionalId = 'peninsula' | 'south-bay' | 'east-bay';
export type RegionalCoordinate = readonly [number, number];
export type RegionalKind = 'garden' | 'town' | 'lagoon' | 'aviation' | 'courthouse' | 'estate' | 'campus' | 'wetland' | 'beach' | 'temple' | 'station' | 'tech' | 'pagoda' | 'egypt' | 'mansion' | 'observatory' | 'forest' | 'museum' | 'ship' | 'farm' | 'peak';
export type RegionalPlace = {
  id: string; title: string; titleEn: string; city: string; coordinate: RegionalCoordinate;
  kind: RegionalKind; description: string; descriptionEn: string; sourceUrl: string;
  guideSlug?: string; plannerPlaceId?: string; imageKey?: string; travelTo?: string[];
};
export type RegionalWorld = {
  id: RegionalId; title: string; titleEn: string; subtitle: string; subtitleEn: string;
  center: RegionalCoordinate; startId: string; accent: string; places: RegionalPlace[];
  land: RegionalCoordinate[];
  roads: { name: string; path: RegionalCoordinate[]; rail?: boolean }[];
  hills: { coordinate: RegionalCoordinate; radius: number; height: number }[];
};

/** Venue reference coordinates; exaggerated models and simplified coasts are for play, not navigation. */
export const REGIONAL_WORLDS: Record<RegionalId, RegionalWorld> = {
  peninsula: {
    id: 'peninsula', title: '中半岛 · 水岸与花园', titleEn: 'Peninsula · Water & gardens', subtitle: '沿着小城与海岸，慢慢发现生活。', subtitleEn: 'Small towns, quiet gardens and room to wander.',
    center: [-122.28, 37.53], startId: 'san-mateo-garden', accent: '#84986d',
    land: [[-122.53,37.69],[-122.36,37.69],[-122.31,37.606],[-122.25,37.56],[-122.19,37.51],[-122.075,37.48],[-122.06,37.37],[-122.3,37.35],[-122.435,37.41],[-122.465,37.49],[-122.50,37.59]],
    roads: [
      {name:'El Camino Real',path:[[-122.37,37.64],[-122.326,37.57],[-122.29,37.535],[-122.23,37.487],[-122.16,37.43]]},
      {name:'CA 92 · coast connector',path:[[-122.43,37.465],[-122.37,37.49],[-122.32,37.53],[-122.27,37.555]]},
      {name:'US 101',path:[[-122.35,37.635],[-122.295,37.57],[-122.252,37.513],[-122.18,37.485],[-122.10,37.43]]},
      {name:'Caltrain · simplified corridor',rail:true,path:[[-122.347,37.58],[-122.31,37.568],[-122.274,37.508],[-122.232,37.485],[-122.165,37.429]]},
    ],
    hills:[{coordinate:[-122.39,37.57],radius:15,height:2.8},{coordinate:[-122.31,37.40],radius:18,height:3.5}],
    places:[
      {id:'san-mateo-garden',title:'San Mateo 日本庭园',titleEn:'San Mateo Japanese Garden',city:'San Mateo',coordinate:[-122.3191,37.5628],kind:'garden',description:'Central Park 里的庭园、池塘和树荫。',descriptionEn:'A garden, pond and shady paths inside Central Park.',sourceUrl:'https://cityofsanmateo.org/3319/Central-Park-Japanese-Garden',guideSlug:'san-mateo-japanese-garden-october-guide-2026',imageKey:'autumn-sanmateo'},
      {id:'burlingame',title:'Burlingame Avenue',titleEn:'Burlingame Avenue',city:'Burlingame',coordinate:[-122.3465,37.5795],kind:'town',description:'沿着街边店铺与树荫，认识半岛小城。',descriptionEn:'Explore a Peninsula downtown of shops and tree-lined streets.',sourceUrl:'https://www.burlingame.org/',imageKey:'burlingame',guideSlug:'peninsula-living-guide'},
      {id:'foster-city',title:'Foster City 水岸公园',titleEn:'Leo J. Ryan Park',city:'Foster City',coordinate:[-122.2678,37.5588],kind:'lagoon',description:'Leo J. Ryan Park 的潟湖水岸与草地。',descriptionEn:'Lagoon views and lawns at Leo J. Ryan Park.',sourceUrl:'https://www.fostercity.org/Facilities/Facility/Details/Leo-J-Ryan-Park-25'},
      {id:'hiller',title:'Hiller 航空博物馆',titleEn:'Hiller Aviation Museum',city:'San Carlos',coordinate:[-122.2526,37.5118],kind:'aviation',description:'在 San Carlos Airport 旁发现航空故事。',descriptionEn:'Discover aviation beside San Carlos Airport.',sourceUrl:'https://www.hiller.org/visit/general-information/'},
      {id:'redwood-square',title:'Redwood City 法院广场',titleEn:'Courthouse Square',city:'Redwood City',coordinate:[-122.2297,37.4863],kind:'courthouse',description:'老法院圆顶与市中心广场，适合接着逛街。',descriptionEn:'A historic courthouse dome and downtown gathering place.',sourceUrl:'https://historysmc.org/san-mateo-county-history-museum/'},
      {id:'filoli',title:'Filoli 庄园',titleEn:'Filoli House & Garden',city:'Woodside',coordinate:[-122.3105,37.4699],kind:'estate',description:'砖红庄园、花园与山脚风景。',descriptionEn:'A country estate, formal gardens and foothill scenery.',sourceUrl:'https://filoli.org/visit/',guideSlug:'filoli-house-garden-day-trip',plannerPlaceId:'filoli',imageKey:'region-filoli-house'},
      {id:'stanford',title:'Stanford · 校园与艺术',titleEn:'Stanford · Campus & art',city:'Stanford',coordinate:[-122.1697,37.4275],kind:'campus',description:'红瓦拱廊、校园庭院与 Cantor 艺术馆攻略。',descriptionEn:'Red-tile arcades, campus courtyards and the Cantor art guide.',sourceUrl:'https://museum.stanford.edu/visit',guideSlug:'stanford-cantor-campus-art-walk',plannerPlaceId:'stanford',imageKey:'region-stanford-quad'},
      {id:'baylands',title:'Palo Alto Baylands',titleEn:'Palo Alto Baylands',city:'Palo Alto',coordinate:[-122.1071,37.4591],kind:'wetland',description:'走近海湾边的湿地与候鸟栖息地。',descriptionEn:'Explore the bay-edge marshes and bird habitat.',sourceUrl:'https://www.paloalto.gov/Departments/Community-Services/Parks-Open-Space-Golf-Division/Neighborhood-Parks/Baylands-Nature-Preserve',guideSlug:'palo-alto-baylands-family-walk-guide',plannerPlaceId:'baylands',imageKey:'baylands-marsh'},
      {id:'half-moon-bay',title:'Half Moon Bay · 海滩',titleEn:'Half Moon Bay · Francis Beach',city:'Half Moon Bay',coordinate:[-122.445,37.4655],kind:'beach',description:'沿着 Francis Beach 沙岸感受太平洋海风。',descriptionEn:'Pacific air and a sandy shoreline at Francis Beach.',sourceUrl:'https://www.parks.ca.gov/?page_id=531',guideSlug:'half-moon-bay-coastal-half-day-guide',plannerPlaceId:'half-moon-bay',imageKey:'coast'},
      {id:'coyote-point',title:'Coyote Point',titleEn:'Coyote Point',city:'San Mateo',coordinate:[-122.3161,37.5865],kind:'wetland',description:'海湾岸边的公园与 CuriOdyssey 科学探索。',descriptionEn:'Bayfront parkland and science discovery at CuriOdyssey.',sourceUrl:'https://www.smcgov.org/parks/coyote-point-recreation-area'},
      {id:'pulgas-temple',title:'Pulgas Water Temple',titleEn:'Pulgas Water Temple',city:'Woodside',coordinate:[-122.3167,37.4838],kind:'temple',description:'水利纪念建筑与倒影池，出发先查开放公告。',descriptionEn:'A water-system monument and reflecting pool; check official access before visiting.',sourceUrl:'https://www.sfpuc.gov/learning/come-visit/pulgas-water-temple'},
      {id:'san-mateo-station',title:'San Mateo · 旅行车站',titleEn:'San Mateo · Travel station',city:'San Mateo',coordinate:[-122.3238,37.5682],kind:'station',description:'在游戏车站切换到旧金山、南湾或东湾。',descriptionEn:'Switch game regions for San Francisco, South Bay or East Bay.',sourceUrl:'https://www.caltrain.com/station/sanmateo',travelTo:['sf','south-bay','east-bay']},
    ],
  },
  'south-bay': {
    id:'south-bay',title:'南湾 · 科技与花园',titleEn:'South Bay · Ideas & gardens',subtitle:'从科技灵感，到山脚的一片安静。',subtitleEn:'From hands-on ideas to quiet foothill gardens.',center:[-121.94,37.335],startId:'tech',accent:'#bc946d',
    land:[[-122.17,37.47],[-122.07,37.46],[-122.02,37.44],[-121.98,37.45],[-121.945,37.48],[-121.60,37.46],[-121.59,37.17],[-122.15,37.17]],
    roads:[
      {name:'El Camino Real',path:[[-122.12,37.41],[-122.07,37.39],[-122.03,37.37],[-121.96,37.35],[-121.90,37.335]]},
      {name:'Stevens Creek Blvd',path:[[-122.08,37.323],[-122.01,37.323],[-121.95,37.323],[-121.91,37.325]]},
      {name:'CA 130 · Mount Hamilton',path:[[-121.89,37.337],[-121.81,37.345],[-121.74,37.32],[-121.70,37.36],[-121.6429,37.3414]]},
      {name:'Caltrain · simplified corridor',rail:true,path:[[-122.12,37.41],[-122.03,37.378],[-121.94,37.353],[-121.902,37.329]]},
    ],
    hills:[{coordinate:[-122.06,37.215],radius:16,height:4},{coordinate:[-121.64,37.34],radius:22,height:7}],
    places:[
      {id:'tech',title:'The Tech Interactive',titleEn:'The Tech Interactive',city:'San Jose',coordinate:[-121.8906,37.3315],kind:'tech',description:'San Jose 市中心的动手科学与技术探索。',descriptionEn:'Hands-on science and technology in downtown San Jose.',sourceUrl:'https://www.thetech.org/visit/',guideSlug:'san-jose-tech-japantown-day-trip',plannerPlaceId:'san-jose',imageKey:'region-tech'},
      {id:'sj-japantown',title:'San Jose 日本城',titleEn:'San Jose Japantown',city:'San Jose',coordinate:[-121.8957,37.3487],kind:'pagoda',description:'Jackson Street 周边的社区、商店与文化故事。',descriptionEn:'Community, shops and cultural stories around Jackson Street.',sourceUrl:'https://www.japantownsanjose.org/',guideSlug:'san-jose-tech-japantown-day-trip',imageKey:'region-japantown'},
      {id:'rosicrucian',title:'Rosicrucian 埃及博物馆',titleEn:'Rosicrucian Egyptian Museum',city:'San Jose',coordinate:[-121.9235,37.3333],kind:'egypt',description:'古埃及馆藏与独特的博物馆园区。',descriptionEn:'Ancient Egyptian collections and a distinctive museum park.',sourceUrl:'https://www.egyptianmuseum.org/plan-your-visit'},
      {id:'winchester',title:'Winchester Mystery House',titleEn:'Winchester Mystery House',city:'San Jose',coordinate:[-121.9504,37.3184],kind:'mansion',description:'充满层叠屋顶与建筑故事的历史宅邸。',descriptionEn:'An unusual historic house of layered roofs and architectural stories.',sourceUrl:'https://winchestermysteryhouse.com/'},
      {id:'hakone',title:'Hakone 日本庭园',titleEn:'Hakone Estate & Gardens',city:'Saratoga',coordinate:[-122.0322,37.2521],kind:'garden',description:'Saratoga 山脚的日式庭园与传统建筑。',descriptionEn:'Japanese gardens and traditional buildings in the Saratoga foothills.',sourceUrl:'https://www.hakone.com/',guideSlug:'hakone-gardens-saratoga-half-day',plannerPlaceId:'hakone',imageKey:'region-hakone'},
      {id:'apple-visitor',title:'Apple Park 访客中心',titleEn:'Apple Park Visitor Center',city:'Cupertino',coordinate:[-122.009,37.3328],kind:'tech',description:'面向公众的访客中心；不代表办公园区开放。',descriptionEn:'The public visitor center; the office campus is not a public attraction.',sourceUrl:'https://www.apple.com/retail/appleparkvisitorcenter/'},
      {id:'computer-history',title:'Computer History Museum',titleEn:'Computer History Museum',city:'Mountain View',coordinate:[-122.0776,37.4143],kind:'tech',description:'沿着计算机的历史，发现今天的创意从何而来。',descriptionEn:'Discover the history behind today’s computing ideas.',sourceUrl:'https://computerhistory.org/visit/'},
      {id:'google-visitor',title:'Google Visitor Experience',titleEn:'Google Visitor Experience',city:'Mountain View',coordinate:[-122.0807,37.4228],kind:'tech',description:'公共访客空间、艺术与社区活动入口。',descriptionEn:'Public visitor spaces, art and community programming.',sourceUrl:'https://visit.withgoogle.com/plan-your-visit/'},
      {id:'shoreline',title:'Shoreline · 湖畔',titleEn:'Shoreline at Mountain View',city:'Mountain View',coordinate:[-122.0888,37.4336],kind:'lagoon',description:'湖边步道、开阔绿地与海湾边的慢时光。',descriptionEn:'Lakeside paths, open space and a slower bayfront outing.',sourceUrl:'https://www.mountainview.gov/our-city/departments/community-services/shoreline-at-mountain-view'},
      {id:'alviso',title:'Alviso Marina',titleEn:'Alviso Marina County Park',city:'San Jose',coordinate:[-121.9784,37.4268],kind:'wetland',description:'南湾湿地与码头遗迹，适合认识海湾生态。',descriptionEn:'South Bay wetlands and waterfront history.',sourceUrl:'https://parks.santaclaracounty.gov/locations/alviso-marina-county-park',guideSlug:'alviso-marina-october-birdwatching-guide-2026',imageKey:'autumn-alviso'},
      {id:'lick',title:'Lick 天文台',titleEn:'Lick Observatory',city:'Mount Hamilton',coordinate:[-121.6429,37.3414],kind:'observatory',description:'Mount Hamilton 山顶的天文台。现实自驾需另查山路和参观安排。',descriptionEn:'An observatory on Mount Hamilton. Check mountain-road access and visiting arrangements separately.',sourceUrl:'https://www.lickobservatory.org/public-visitor-information/'},
      {id:'diridon',title:'Diridon · 旅行车站',titleEn:'Diridon · Travel station',city:'San Jose',coordinate:[-121.9024,37.3297],kind:'station',description:'游戏旅行车站，连接半岛、旧金山与东湾。',descriptionEn:'A game travel station connecting the Peninsula, San Francisco and East Bay.',sourceUrl:'https://www.caltrain.com/station/sjdiridon',travelTo:['peninsula','sf','east-bay']},
    ],
  },
  'east-bay': {
    id:'east-bay',title:'东湾 · 湖光与山林',titleEn:'East Bay · Lakes & redwoods',subtitle:'大学钟声、海边码头，和山里的红杉。',subtitleEn:'Campus bells, waterfront piers and redwood trails.',center:[-122.12,37.73],startId:'berkeley',accent:'#698e83',
    land:[[-122.34,37.945],[-122.345,37.875],[-122.325,37.81],[-122.325,37.77],[-122.27,37.73],[-122.19,37.67],[-122.145,37.58],[-122.05,37.48],[-121.82,37.48],[-121.81,37.94]],
    roads:[
      {name:'Broadway',path:[[-122.276,37.795],[-122.265,37.815],[-122.25,37.845]]},
      {name:'I 880 · simplified corridor',path:[[-122.28,37.80],[-122.23,37.76],[-122.14,37.66],[-122.03,37.56]]},
      {name:'University Ave',path:[[-122.31,37.87],[-122.28,37.87],[-122.259,37.872]]},
      {name:'Skyline Blvd',path:[[-122.245,37.9],[-122.215,37.855],[-122.18,37.818],[-122.15,37.79]]},
    ],
    hills:[{coordinate:[-122.205,37.90],radius:17,height:4},{coordinate:[-122.14,37.805],radius:15,height:5},{coordinate:[-121.886,37.513],radius:18,height:6}],
    places:[
      {id:'berkeley',title:'UC Berkeley · 校园',titleEn:'UC Berkeley · Campus',city:'Berkeley',coordinate:[-122.2585,37.872],kind:'campus',description:'钟楼、草坪和大学校园里的文化散步。',descriptionEn:'A campus walk among the Campanile, lawns and cultural landmarks.',sourceUrl:'https://visit.berkeley.edu/',guideSlug:'berkeley-campus-botanical-garden-half-day',plannerPlaceId:'berkeley',imageKey:'region-berkeley-campus'},
      {id:'berkeley-garden',title:'UC Botanical Garden',titleEn:'UC Botanical Garden',city:'Berkeley',coordinate:[-122.2386,37.8751],kind:'garden',description:'Berkeley 山坡上的植物收藏与园路。',descriptionEn:'Plant collections and garden paths in the Berkeley hills.',sourceUrl:'https://botanicalgarden.berkeley.edu/visit/plan-your-visit/',guideSlug:'berkeley-campus-botanical-garden-half-day',imageKey:'region-berkeley-garden'},
      {id:'tilden',title:'Tilden · Little Farm',titleEn:'Tilden · Little Farm',city:'Berkeley',coordinate:[-122.2448,37.9097],kind:'farm',description:'山林公园里的农场与自然探索。',descriptionEn:'Farm and nature discovery in a wooded regional park.',sourceUrl:'https://www.ebparks.org/parks/tilden',guideSlug:'east-bay-tilden-october-family-guide-2026',imageKey:'community-tilden-little-farm'},
      {id:'lake-merritt',title:'Lake Merritt',titleEn:'Lake Merritt',city:'Oakland',coordinate:[-122.2576,37.8058],kind:'lagoon',description:'城市中心的湖光、步道与鸟类保护区。',descriptionEn:'Lakeside paths and a bird sanctuary in the heart of Oakland.',sourceUrl:'https://www.oaklandca.gov/Community/Parks-Facilities/Parks/Lakeside-Park',guideSlug:'oakland-lake-merritt-omca-half-day',plannerPlaceId:'lake-merritt',imageKey:'region-lake-merritt'},
      {id:'omca',title:'Oakland Museum of California',titleEn:'Oakland Museum of California',city:'Oakland',coordinate:[-122.2641,37.7987],kind:'museum',description:'在艺术、历史与自然故事之间认识加州。',descriptionEn:'Explore California through art, history and natural science.',sourceUrl:'https://museumca.org/visit/',guideSlug:'oakland-lake-merritt-omca-half-day',imageKey:'region-omca'},
      {id:'jack-london',title:'Jack London Square · 渡轮',titleEn:'Jack London Square · Ferry',city:'Oakland',coordinate:[-122.2797,37.7947],kind:'station',description:'Oakland 水岸与渡轮门户；游戏可在这里切换区域。',descriptionEn:'Oakland’s waterfront and ferry gateway; change game regions here.',sourceUrl:'https://www.sfbayferry.com/routes-schedules/oakland-alameda/',travelTo:['sf','peninsula','south-bay']},
      {id:'alameda-beach',title:'Alameda · Crown Beach',titleEn:'Alameda · Crown Beach',city:'Alameda',coordinate:[-122.2706,37.7622],kind:'beach',description:'Robert W. Crown Memorial State Beach 的海湾沙岸。',descriptionEn:'The sandy bay shoreline of Robert W. Crown Memorial State Beach.',sourceUrl:'https://www.ebparks.org/parks/crown-beach'},
      {id:'hornet',title:'USS Hornet 博物馆',titleEn:'USS Hornet Museum',city:'Alameda',coordinate:[-122.3024,37.7727],kind:'ship',description:'Alameda 水岸上的航空母舰博物馆。',descriptionEn:'An aircraft carrier museum on the Alameda waterfront.',sourceUrl:'https://uss-hornet.org/visit-hornet/'},
      {id:'chabot',title:'Chabot 太空科学中心',titleEn:'Chabot Space & Science Center',city:'Oakland',coordinate:[-122.1813,37.8186],kind:'observatory',description:'在 Oakland 山林间发现天文与太空科学。',descriptionEn:'Astronomy and space science among the Oakland hills.',sourceUrl:'https://chabotspace.org/visit/plan-your-visit/'},
      {id:'redwood',title:'Reinhardt Redwood · 红杉林',titleEn:'Reinhardt Redwood Regional Park',city:'Oakland',coordinate:[-122.15,37.802],kind:'forest',description:'放慢脚步，走进东湾的红杉林。',descriptionEn:'Slow down for the East Bay’s redwood forest.',sourceUrl:'https://www.ebparks.org/parks/reinhardt-redwood',guideSlug:'reinhardt-redwood-first-walk-guide',plannerPlaceId:'redwood',imageKey:'redwoods'},
      {id:'ardenwood',title:'Ardenwood 历史农场',titleEn:'Ardenwood Historic Farm',city:'Fremont',coordinate:[-122.0538,37.5564],kind:'farm',description:'农场、历史宅邸与乡间小路。',descriptionEn:'Farm life, a historic house and country paths.',sourceUrl:'https://www.ebparks.org/parks/ardenwood',guideSlug:'fremont-ardenwood-october-farm-guide-2026',imageKey:'autumn-ardenwood'},
      {id:'mission-peak',title:'Mission Peak',titleEn:'Mission Peak',city:'Fremont',coordinate:[-121.8805,37.5126],kind:'peak',description:'Fremont 山脊与广阔湾景。现实登山需做好体力与补水准备。',descriptionEn:'Fremont ridgelines and wide bay views. Prepare fitness, water and conditions for a real hike.',sourceUrl:'https://www.ebparks.org/parks/mission-peak'},
    ],
  },
};

export function projectRegional(world: RegionalWorld, coordinate: RegionalCoordinate): [number, number] {
  return [(coordinate[0] - world.center[0]) * 350, (world.center[1] - coordinate[1]) * 440];
}
export function regionalContains(world: RegionalWorld, x: number, z: number) {
  const point = [x / 350 + world.center[0], world.center[1] - z / 440];
  let inside = false;
  for (let i = 0, j = world.land.length - 1; i < world.land.length; j = i++) {
    const a = world.land[i], b = world.land[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function regionalHeight(world: RegionalWorld, x: number, z: number) {
  return .3 + world.hills.reduce((height, hill) => { const p = projectRegional(world, hill.coordinate); return height + hill.height * Math.exp(-((x-p[0])**2+(z-p[1])**2)/(hill.radius**2)); }, 0);
}
export function regionalArrival(world: RegionalWorld, x: number, z: number) {
  return world.places.map(place => {const p = projectRegional(world, place.coordinate); return {place, distance: Math.hypot(x-p[0],z-p[1])};}).filter(item => item.distance < 3.8).sort((a,b)=>a.distance-b.distance)[0]?.place;
}
/** Spawn beside an attraction, not inside its scaled building. */
export function regionalSpawn(world: RegionalWorld, placeId: string) {
  const place = world.places.find(p=>p.id===placeId) || world.places[0];
  const [x,z] = projectRegional(world,place.coordinate);
  for (const [dx,dz] of [[0,4.6],[4.6,0],[0,-4.6],[-4.6,0]]) if (regionalContains(world,x+dx,z+dz)) return {x:x+dx,z:z+dz};
  return {x,z};
}
