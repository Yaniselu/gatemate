export type PoiKind =
  | 'coffee' | 'food' | 'bar' | 'shop' | 'dutyfree' | 'pharmacy' | 'medical' | 'toilets' | 'family' | 'money'
  | 'charging' | 'lounge' | 'prayer' | 'info' | 'transport' | 'parking' | 'services' | 'hotel';

export interface PoiMeta {
  label: string;
  icon: string;
  color: string;
  glyph: string;
}

export const POI_META: Record<PoiKind, PoiMeta> = {
  coffee: { label: 'Coffee', icon: 'cafe-outline', color: '#b7791f', glyph: '☕' },
  food: { label: 'Food', icon: 'restaurant-outline', color: '#f97316', glyph: '🍴' },
  bar: { label: 'Bars', icon: 'wine-outline', color: '#8b5cf6', glyph: '🍷' },
  shop: { label: 'Shops', icon: 'bag-handle-outline', color: '#ec4899', glyph: '🛍' },
  dutyfree: { label: 'Duty free', icon: 'pricetags-outline', color: '#db2777', glyph: '🏷' },
  pharmacy: { label: 'Pharmacy', icon: 'medkit-outline', color: '#10b981', glyph: '✚' },
  medical: { label: 'Medical', icon: 'pulse-outline', color: '#ef4444', glyph: '⛑' },
  toilets: { label: 'Toilets', icon: 'water-outline', color: '#0ea5e9', glyph: 'WC' },
  family: { label: 'Family', icon: 'happy-outline', color: '#f59e0b', glyph: '👶' },
  money: { label: 'Money', icon: 'cash-outline', color: '#16a34a', glyph: '€' },
  charging: { label: 'Charging', icon: 'battery-charging-outline', color: '#22c55e', glyph: '⚡' },
  lounge: { label: 'Lounges', icon: 'diamond-outline', color: '#0d9488', glyph: '★' },
  prayer: { label: 'Prayer', icon: 'moon-outline', color: '#6366f1', glyph: '☾' },
  info: { label: 'Info', icon: 'information-circle-outline', color: '#0284c7', glyph: 'i' },
  transport: { label: 'Transport', icon: 'bus-outline', color: '#2563eb', glyph: '🚆' },
  parking: { label: 'Parking', icon: 'car-outline', color: '#64748b', glyph: 'P' },
  services: { label: 'Services', icon: 'briefcase-outline', color: '#475569', glyph: '•' },
  hotel: { label: 'Hotels', icon: 'bed-outline', color: '#a16207', glyph: '🛏' },
};

export const POI_ORDER: PoiKind[] = [
  'coffee', 'food', 'bar', 'shop', 'dutyfree', 'lounge', 'toilets', 'pharmacy', 'medical', 'money', 'charging', 'family',
  'info', 'prayer', 'services', 'transport', 'parking', 'hotel',
];

const AMENITY: Record<string, PoiKind> = {
  cafe: 'coffee', restaurant: 'food', fast_food: 'food', food_court: 'food', ice_cream: 'food', bar: 'bar', pub: 'bar', biergarten: 'bar',
  pharmacy: 'pharmacy', clinic: 'medical', doctors: 'medical', first_aid: 'medical', hospital: 'medical', dentist: 'medical',
  toilets: 'toilets', shower: 'toilets', baby_changing: 'family', childcare: 'family', kindergarten: 'family',
  atm: 'money', bureau_de_change: 'money', bank: 'money', money_transfer: 'money', payment_terminal: 'money',
  device_charging_station: 'charging', lounge: 'lounge', place_of_worship: 'prayer', prayer_room: 'prayer',
  information: 'info', taxi: 'transport', bus_station: 'transport', car_rental: 'transport', car_sharing: 'transport', ferry_terminal: 'transport',
  parking: 'parking', motorcycle_parking: 'parking', charging_station: 'parking',
  luggage_locker: 'services', left_luggage: 'services', post_office: 'services', lost_property: 'services', smoking_area: 'services',
  drinking_water: 'services', water_point: 'services', police: 'services', internet_cafe: 'services', telephone: 'services',
  townhall: 'services', customs: 'services', conference_centre: 'services', coworking_space: 'services',
};

export const AMENITY_RE = Object.keys(AMENITY).join('|');

export function classify(t: Record<string, string>): PoiKind | null {
  const name = (t['name'] ?? '').toLowerCase();
  if (t['amenity'] === 'lounge' || t['aeroway'] === 'lounge' || /\blounge\b/.test(name) && !t['shop']) return 'lounge';
  if (t['amenity'] === 'cafe' || t['cuisine']?.includes('coffee')) return 'coffee';
  if (t['amenity'] && AMENITY[t['amenity']]) return AMENITY[t['amenity']];
  if (t['shop'] === 'duty_free' || t['duty_free'] === 'yes') return 'dutyfree';
  if (t['shop'] === 'chemist') return 'pharmacy';
  if (t['shop'] === 'coffee') return 'coffee';
  if (t['shop'] === 'bakery' || t['shop'] === 'pastry' || t['shop'] === 'confectionery') return 'food';
  if (t['shop']) return 'shop';
  if (t['emergency'] === 'defibrillator') return 'medical';
  if (t['tourism'] === 'information') return 'info';
  if (t['tourism'] === 'hotel') return 'hotel';
  if (t['leisure'] === 'playground') return 'family';
  if (t['public_transport'] === 'station' || t['railway'] === 'station' || t['railway'] === 'halt' || t['highway'] === 'bus_stop') return 'transport';
  return null;
}

export function fallbackName(kind: PoiKind, t: Record<string, string>): string {
  const a = t['amenity'];
  if (a === 'atm') return 'ATM';
  if (a === 'bureau_de_change') return 'Currency exchange';
  if (a === 'baby_changing') return 'Baby changing';
  if (a === 'luggage_locker' || a === 'left_luggage') return 'Left luggage';
  if (a === 'smoking_area') return 'Smoking area';
  if (a === 'drinking_water' || a === 'water_point') return 'Drinking water';
  if (a === 'post_office') return 'Post office';
  if (a === 'lost_property') return 'Lost & found';
  if (a === 'police') return 'Police';
  if (a === 'taxi') return 'Taxi rank';
  if (a === 'car_rental') return 'Car rental';
  if (a === 'charging_station') return 'EV charging';
  if (a === 'first_aid') return 'First aid';
  if (t['emergency'] === 'defibrillator') return 'Defibrillator (AED)';
  if (a === 'shower') return 'Showers';
  if (t['railway'] === 'station' || t['public_transport'] === 'station') return 'Station';
  if (t['highway'] === 'bus_stop') return 'Bus stop';
  if (t['shop'] && t['shop'] !== 'yes') return cap(t['shop'].replace(/_/g, ' '));
  return { coffee: 'Café', food: 'Restaurant', bar: 'Bar', shop: 'Shop', dutyfree: 'Duty free', pharmacy: 'Pharmacy', medical: 'Medical', toilets: 'Toilets', family: 'Family room', money: 'Money', charging: 'Phone charging', lounge: 'Lounge', prayer: 'Prayer room', info: 'Information', transport: 'Transport', parking: 'Parking', services: 'Service', hotel: 'Hotel' }[kind];
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
