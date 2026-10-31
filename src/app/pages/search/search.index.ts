export interface SearchEntry {
  title: string;
  sub: string;
  icon: string;
  color: string;
  route: string;
  params?: Record<string, string>;
  keys: string;
}

export const FEATURES: SearchEntry[] = [
  { title: 'Add a flight', sub: 'Boarding pass, booking, e-mail or by hand', icon: 'add-circle-outline', color: '#0EA5E9', route: '/add-flight', keys: 'add flight ticket booking import scan boarding pass email adauga zbor bilet rezervare scaneaza import' },
  { title: 'My trips', sub: 'Upcoming and past trips', icon: 'airplane-outline', color: '#0FB5C3', route: '/tabs/trips', keys: 'trips flights travel calatorii zboruri excursii' },
  { title: 'Boarding pass', sub: 'Offline pass, seat and QR code', icon: 'qr-code-outline', color: '#6366F1', route: '/tabs/trips', keys: 'boarding pass qr code ticket seat bilet imbarcare cod loc' },
  { title: 'Lost & Found', sub: 'Lost luggage, damaged bags, items left behind', icon: 'search-outline', color: '#F59E0B', route: '/lost-found', keys: 'lost found luggage bag baggage delayed damaged missing forgot left phone pir claim pierdut bagaj intarziat deteriorat uitat obiecte gasite reclamatie valiza' },
  { title: 'Lost or delayed luggage', sub: 'What to do at the airport, deadlines, claim letter', icon: 'bag-handle-outline', color: '#F59E0B', route: '/lost-found', params: { kind: 'delayed' }, keys: 'lost luggage delayed bag suitcase pir worldtracer bagaj pierdut intarziat valiza' },
  { title: 'Damaged bag', sub: 'Report within 7 days', icon: 'construct-outline', color: '#EF4444', route: '/lost-found', params: { kind: 'damaged' }, keys: 'damaged broken bag wheel missing items bagaj deteriorat stricat roata' },
  { title: 'Left something on the plane', sub: 'Phone, headphones, jacket', icon: 'airplane-outline', color: '#6366F1', route: '/lost-found', params: { kind: 'plane' }, keys: 'forgot left plane phone headphones jacket uitat avion telefon casti geaca' },
  { title: 'Airport map', sub: 'Gates, shops, toilets, floors', icon: 'map-outline', color: '#10B981', route: '/airport-map', keys: 'airport map gate terminal shops toilets food coffee floor harta aeroport poarta magazine toaleta cafea etaj' },
  { title: 'Airport', sub: 'Your airport at a glance', icon: 'business-outline', color: '#10B981', route: '/tabs/airport', keys: 'airport info terminal aeroport' },
  { title: 'Airport rules', sub: 'Liquids, power banks, security, passports', icon: 'reader-outline', color: '#3B82F6', route: '/airport-rules', keys: 'rules security liquids power bank battery knife lighter medicine passport reguli securitate lichide baterie cutit bricheta medicamente' },
  { title: 'Passenger rights', sub: 'EU261 compensation and claim letter', icon: 'scale-outline', color: '#FFB020', route: '/rights', keys: 'rights eu261 compensation delay cancelled cancellation refund money drepturi despagubire intarziere anulat rambursare bani' },
  { title: 'Velo AI', sub: 'Ask anything about your trip', icon: 'sparkles-outline', color: '#8B5CF6', route: '/assistant', keys: 'velo ai assistant chat ask help asistent intreaba ajutor' },
  { title: 'Alerts', sub: 'Gate changes, delays, reminders', icon: 'notifications-outline', color: '#EF4444', route: '/alerts', keys: 'alerts notifications gate change delay reminders alerte notificari poarta intarziere' },
  { title: 'Chat', sub: 'Trip groups and flight lounges', icon: 'chatbubbles-outline', color: '#0FB5C3', route: '/tabs/chat', keys: 'chat messages group friends mesaje grup prieteni' },
  { title: 'Currency converter', sub: 'Live exchange rates', icon: 'cash-outline', color: '#16A34A', route: '/tools', params: { open: 'money' }, keys: 'currency exchange rate money euro lei convert valuta curs schimb bani' },
  { title: 'Time & jet lag', sub: 'Time difference and tips', icon: 'time-outline', color: '#0EA5E9', route: '/tools', params: { open: 'time' }, keys: 'time zone jet lag difference ora fus orar' },
  { title: 'Cabin bag rules', sub: 'Size and weight by airline', icon: 'bag-check-outline', color: '#8B5CF6', route: '/tools', params: { open: 'cabin' }, keys: 'cabin bag size weight hand luggage ryanair wizz bagaj cabina mana dimensiuni greutate' },
  { title: 'Distance', sub: 'Between any two airports', icon: 'swap-horizontal-outline', color: '#14B8A6', route: '/tools', params: { open: 'distance' }, keys: 'distance km miles distanta' },
  { title: 'World map', sub: 'Countries you’ve visited', icon: 'globe-outline', color: '#8B5CF6', route: '/world', keys: 'world map countries visited harta lumii tari vizitate' },
  { title: 'Passport & stats', sub: 'Flights, distance, countries', icon: 'stats-chart-outline', color: '#EC4899', route: '/passport', keys: 'passport stats statistics flights kilometres countries pasaport statistici' },
  { title: 'Achievements', sub: 'Badges and levels', icon: 'trophy-outline', color: '#F59E0B', route: '/achievements', keys: 'achievements badges level trophies realizari insigne nivel' },
  { title: 'In-flight games', sub: 'Offline games, breathing, stretches', icon: 'game-controller-outline', color: '#6366F1', route: '/inflight', keys: 'games play offline bored breathe stretch 2048 quiz jocuri respiratie' },
  { title: 'Family', sub: 'Put your family on any ticket', icon: 'people-outline', color: '#EC4899', route: '/family', keys: 'family children kids partner companions passengers familie copii partener pasageri' },
  { title: 'Identity', sub: 'Verify your name with your passport', icon: 'shield-checkmark-outline', color: '#16A34A', route: '/identity', keys: 'identity verify passport id card name real security identitate verifica pasaport buletin nume' },
  { title: 'Edit profile', sub: 'Name, photo, home airport', icon: 'person-outline', color: '#0FB5C3', route: '/profile/edit', keys: 'profile edit name photo avatar home airport profil editeaza poza' },
  { title: 'Notifications', sub: 'Choose what to be told about', icon: 'notifications-outline', color: '#0EA5E9', route: '/settings/notifications', keys: 'notifications settings push reminders notificari setari' },
  { title: 'Security & privacy', sub: 'Face ID, app lock, sessions, data', icon: 'lock-closed-outline', color: '#334155', route: '/settings/security', keys: 'security privacy face id lock pin password data export delete account securitate confidentialitate parola sterge cont' },
  { title: 'Accessibility', sub: 'Text size, motion, contrast', icon: 'accessibility-outline', color: '#0EA5E9', route: '/settings/accessibility', keys: 'accessibility text size motion contrast accesibilitate marime text' },
  { title: 'Appearance', sub: 'Light, dark or like your phone', icon: 'contrast-outline', color: '#334155', route: '/settings/accessibility', keys: 'dark mode light theme appearance tema intunecata luminoasa aspect' },
  { title: 'Gatemate Pro', sub: 'Unlimited trips and more', icon: 'diamond-outline', color: '#8B5CF6', route: '/pro', keys: 'pro premium subscription upgrade abonament' },
  { title: 'Feedback', sub: 'Tell us what to improve', icon: 'chatbox-ellipses-outline', color: '#14B8A6', route: '/feedback', keys: 'feedback bug report idea suggestion parere problema sugestie' },
  { title: 'Privacy policy', sub: 'How your data is used', icon: 'document-text-outline', color: '#64748B', route: '/legal/privacy', keys: 'privacy policy gdpr data confidentialitate date' },
];

export const POPULAR = ['Lost luggage', 'Power bank', 'Liquids', 'Currency', 'Airport map', 'Delay compensation'];

export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function score(query: string, title: string, rest: string): number {
  const words = fold(query).split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return 0;
  const t = fold(title), r = fold(rest);
  let total = 0;
  for (const w of words) {
    if (t.startsWith(w)) total += 6;
    else if (new RegExp(`\\b${w}`).test(t)) total += 4;
    else if (new RegExp(`\\b${w}`).test(r)) total += 2;
    else if (w.length >= 4 && (t + ' ' + r).includes(w)) total += 1;
    else return 0;
  }
  return total;
}
