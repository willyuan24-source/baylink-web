export type ShoppingPlace = {
  id: string;
  name: string;
  city: string;
  region: 'San Francisco' | 'Peninsula' | 'South Bay' | 'East Bay' | 'North Bay';
  kind: 'outlet' | 'mall' | 'lifestyle' | 'district';
  address: string;
  description: string;
  bestFor: string;
  plan: string;
  transport: string;
  caution: string;
  url: string;
  directoryUrl: string;
  visitUrl: string;
  verifiedAt: string;
};

export const SHOPPING_REGIONS = { 'San Francisco': '旧金山', Peninsula: '半岛', 'South Bay': '南湾', 'East Bay': '东湾', 'North Bay': '北湾' };
export const SHOPPING_KINDS = { outlet: 'Outlet／奥特莱斯', mall: 'Shopping Mall／商场', lifestyle: '露天购物中心', district: '购物街区' };
