export type UtilityContact = {
  name: string;
  url: string;
  phone?: string;
  email?: string;
  note?: string;
  availabilityUrl?: string;
  movingUrl?: string;
};

export type UtilityCity = {
  city: string;
  county: string;
  water: UtilityContact[];
  electric: UtilityContact[];
  waste: UtilityContact[];
  municipalUrl: string;
  notes?: string;
  verifiedAt: string;
};

export const BROADBAND_MAP_URL = 'https://www.broadbandmap.ca.gov/';

export const UTILITY_CITY_ALIASES: Record<string, string[]> = {
  'San Francisco': ['旧金山', '三藩市'], 'San Jose': ['圣何塞', '圣荷西'],
  Oakland: ['奥克兰', '屋仑'], Berkeley: ['伯克利', '柏克莱'], Fremont: ['弗里蒙特', '菲利蒙'],
  Sunnyvale: ['桑尼维尔', '森尼维尔'], Cupertino: ['库比蒂诺', '库柏蒂诺'],
  'Santa Clara': ['圣克拉拉', '圣塔克拉拉'], 'Palo Alto': ['帕洛阿尔托', '帕罗奥图'],
  'Mountain View': ['山景城'], 'San Mateo': ['圣马特奥', '圣马刁'],
  'Redwood City': ['红木城'], Millbrae: ['密尔布瑞', '密尔布雷'],
  Burlingame: ['伯灵格姆'], 'South San Francisco': ['南旧金山'], 'Daly City': ['戴利城'],
  Alameda: ['阿拉米达'], Hayward: ['海沃德'], 'Union City': ['联合城'],
  Newark: ['纽瓦克'], Pleasanton: ['普莱森顿'], Dublin: ['都柏林'],
  Livermore: ['利弗莫尔'], Milpitas: ['米尔皮塔斯', '苗必达'],
  'San Leandro': ['圣利安卓'], Richmond: ['里士满'], Concord: ['康科德'],
  'Walnut Creek': ['核桃溪'], Danville: ['丹维尔'], 'San Ramon': ['圣拉蒙'],
  'San Rafael': ['圣拉斐尔'], Novato: ['诺瓦托'], Sausalito: ['索萨利托'],
  'Santa Rosa': ['圣罗莎'], Petaluma: ['佩塔卢马'], Sonoma: ['索诺玛'], Napa: ['纳帕'],
  Vallejo: ['瓦列霍'], Fairfield: ['费尔菲尔德'], Vacaville: ['瓦卡维尔'],
};
