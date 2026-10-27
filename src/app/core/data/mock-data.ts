import {
  Airport,
  AirportInfo,
  ChatMessage,
  ChatThread,
  Flight,
  FlightAlert,
  Traveller,
  TravelStats,
  Trip,
} from '../models';

// Demo content for the front-end-first phase. Times are relative to "now" so the
// countdowns, boarding alerts and statuses always look alive.

export const AIRPORTS: Record<string, Airport> = {
  OTP: { code: 'OTP', city: 'Bucharest', name: 'Henri Coandă International', country: 'Romania', timezone: 'Europe/Bucharest' },
  BCN: { code: 'BCN', city: 'Barcelona', name: 'Josep Tarradellas El Prat', country: 'Spain', timezone: 'Europe/Madrid' },
  LIS: { code: 'LIS', city: 'Lisbon', name: 'Humberto Delgado', country: 'Portugal', timezone: 'Europe/Lisbon' },
  CDG: { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'France', timezone: 'Europe/Paris' },
  JFK: { code: 'JFK', city: 'New York', name: 'John F. Kennedy International', country: 'United States', timezone: 'America/New_York' },
  DXB: { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'United Arab Emirates', timezone: 'Asia/Dubai' },
  CLJ: { code: 'CLJ', city: 'Cluj-Napoca', name: 'Avram Iancu International', country: 'Romania', timezone: 'Europe/Bucharest' },
  FCO: { code: 'FCO', city: 'Rome', name: 'Leonardo da Vinci–Fiumicino', country: 'Italy', timezone: 'Europe/Rome' },
  ATH: { code: 'ATH', city: 'Athens', name: 'Eleftherios Venizelos', country: 'Greece', timezone: 'Europe/Athens' },
};

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

export const TRAVELLERS: Traveller[] = [
  { id: 'me', name: 'You', initials: 'ME', color: '#0FB5C3' },
  { id: 'u-ana', name: 'Ana Popescu', initials: 'AP', color: '#8B7CF6' },
  { id: 'u-mihai', name: 'Mihai Ionescu', initials: 'MI', color: '#FF8A5B' },
  { id: 'u-ioana', name: 'Ioana Radu', initials: 'IR', color: '#2FD18A' },
  { id: 'u-vlad', name: 'Vlad Stan', initials: 'VS', color: '#5EC8FF' },
];

function flight(partial: Partial<Flight> & Pick<Flight, 'id' | 'from' | 'to' | 'departure' | 'durationMinutes'>): Flight {
  const dep = new Date(partial.departure).getTime();
  return {
    airline: 'Skyways',
    airlineCode: 'SK',
    number: 'SK 1234',
    arrival: new Date(dep + partial.durationMinutes * MIN).toISOString(),
    boardingTime: new Date(dep - 40 * MIN).toISOString(),
    cabin: 'Economy',
    bookingRef: 'GT7Q2M',
    passengerName: 'Alex Morgan',
    status: 'on-time',
    distanceKm: 0,
    ...partial,
  };
}

export function createMockTrips(passengerName: string): Trip[] {
  const barcelona: Trip = {
    id: 'trip-bcn',
    title: 'Barcelona with friends',
    destination: AIRPORTS['BCN'],
    coverGradient: 'linear-gradient(135deg, #22C7D3 0%, #5EC8FF 55%, #FFB36B 100%)',
    emoji: '🏖️',
    startDate: iso(2 * 60 * MIN + 35 * MIN),
    endDate: iso(7 * DAY),
    chatId: 'chat-bcn',
    travellers: TRAVELLERS.slice(0, 4),
    flights: [
      flight({
        id: 'fl-out',
        airline: 'Aerolinia',
        airlineCode: 'AE',
        number: 'AE 415',
        from: AIRPORTS['OTP'],
        to: AIRPORTS['BCN'],
        departure: iso(2 * 60 * MIN + 35 * MIN),
        durationMinutes: 195,
        gate: 'B12',
        terminal: 'T1',
        seat: '14C',
        passengerName,
        status: 'on-time',
        distanceKm: 1972,
        aircraft: 'Airbus A320neo',
      }),
      flight({
        id: 'fl-back',
        airline: 'Aerolinia',
        airlineCode: 'AE',
        number: 'AE 416',
        from: AIRPORTS['BCN'],
        to: AIRPORTS['OTP'],
        departure: iso(7 * DAY + 3 * 60 * MIN),
        durationMinutes: 185,
        terminal: 'T1',
        seat: '9A',
        passengerName,
        status: 'scheduled',
        distanceKm: 1972,
        aircraft: 'Airbus A320neo',
      }),
    ],
    checklist: [
      { id: 'c1', label: 'Passport or ID card', done: true, category: 'documents' },
      { id: 'c2', label: 'Online check-in', done: true, category: 'tasks' },
      { id: 'c3', label: 'Boarding pass added to Gatemate', done: true, category: 'documents' },
      { id: 'c4', label: 'Power bank (cabin bag only)', done: false, category: 'packing' },
      { id: 'c5', label: 'Liquids under 100 ml in a clear bag', done: false, category: 'packing' },
      { id: 'c6', label: 'Travel insurance', done: false, category: 'documents' },
      { id: 'c7', label: 'EU plug adapter — not needed in Spain', done: true, category: 'packing' },
    ],
    expenses: [
      { id: 'e1', label: 'Apartment Gràcia', amount: 840, currency: 'EUR', paidBy: 'u-ana', splitWith: ['me', 'u-ana', 'u-mihai', 'u-ioana'], createdAt: iso(-10 * DAY) },
      { id: 'e2', label: 'Sagrada Família tickets', amount: 136, currency: 'EUR', paidBy: 'me', splitWith: ['me', 'u-ana', 'u-mihai', 'u-ioana'], createdAt: iso(-4 * DAY) },
      { id: 'e3', label: 'Airport transfer', amount: 48, currency: 'EUR', paidBy: 'u-mihai', splitWith: ['me', 'u-ana', 'u-mihai', 'u-ioana'], createdAt: iso(-1 * DAY) },
    ],
  };

  const lisbon: Trip = {
    id: 'trip-lis',
    title: 'Lisbon long weekend',
    destination: AIRPORTS['LIS'],
    coverGradient: 'linear-gradient(135deg, #FFB36B 0%, #FF6B8B 60%, #8B7CF6 100%)',
    emoji: '🚋',
    startDate: iso(34 * DAY),
    endDate: iso(38 * DAY),
    travellers: [TRAVELLERS[0], TRAVELLERS[4]],
    flights: [
      flight({
        id: 'fl-lis',
        airline: 'Atlantica',
        airlineCode: 'AT',
        number: 'AT 1872',
        from: AIRPORTS['OTP'],
        to: AIRPORTS['LIS'],
        departure: iso(34 * DAY + 6 * 60 * MIN),
        durationMinutes: 290,
        terminal: 'T1',
        passengerName,
        status: 'scheduled',
        distanceKm: 2981,
        aircraft: 'Airbus A321',
        bookingRef: 'LX8P0D',
      }),
    ],
    checklist: [
      { id: 'l1', label: 'Passport or ID card', done: false, category: 'documents' },
      { id: 'l2', label: 'Book a tram 28 tour', done: false, category: 'tasks' },
    ],
    expenses: [],
  };

  const paris: Trip = {
    id: 'trip-cdg',
    title: 'Paris city break',
    destination: AIRPORTS['CDG'],
    coverGradient: 'linear-gradient(135deg, #5EC8FF 0%, #8B7CF6 100%)',
    emoji: '🥐',
    startDate: iso(-62 * DAY),
    endDate: iso(-58 * DAY),
    travellers: [TRAVELLERS[0], TRAVELLERS[1]],
    flights: [
      flight({
        id: 'fl-cdg',
        airline: 'Aerolinia',
        airlineCode: 'AE',
        number: 'AE 381',
        from: AIRPORTS['OTP'],
        to: AIRPORTS['CDG'],
        departure: iso(-62 * DAY),
        durationMinutes: 205,
        seat: '21F',
        passengerName,
        status: 'landed',
        distanceKm: 1867,
      }),
    ],
    checklist: [],
    expenses: [],
  };

  const athens: Trip = {
    id: 'trip-ath',
    title: 'Athens & islands',
    destination: AIRPORTS['ATH'],
    coverGradient: 'linear-gradient(135deg, #2FD18A 0%, #22C7D3 100%)',
    emoji: '🏛️',
    startDate: iso(-140 * DAY),
    endDate: iso(-130 * DAY),
    travellers: [TRAVELLERS[0], TRAVELLERS[2], TRAVELLERS[3]],
    flights: [
      flight({
        id: 'fl-ath',
        airline: 'Hellas Air',
        airlineCode: 'HA',
        number: 'HA 902',
        from: AIRPORTS['OTP'],
        to: AIRPORTS['ATH'],
        departure: iso(-140 * DAY),
        durationMinutes: 95,
        seat: '3A',
        passengerName,
        status: 'landed',
        distanceKm: 750,
      }),
    ],
    checklist: [],
    expenses: [],
  };

  return [barcelona, lisbon, paris, athens];
}

export function createMockAlerts(): FlightAlert[] {
  return [
    { id: 'a1', kind: 'gate', title: 'Gate assigned · B12', body: 'AE 415 to Barcelona departs from gate B12, Terminal 1. About 9 min walk from security.', createdAt: iso(-12 * MIN), read: false, flightId: 'fl-out' },
    { id: 'a2', kind: 'checkin', title: 'You are checked in', body: 'Seat 14C confirmed. Your boarding pass is saved offline.', createdAt: iso(-3 * 60 * MIN), read: false, flightId: 'fl-out' },
    { id: 'a3', kind: 'chat', title: 'Ana in Barcelona with friends', body: 'Who brings the speaker? 🔊', createdAt: iso(-40 * MIN), read: true },
    { id: 'a4', kind: 'info', title: 'Security is moving fast', body: 'Current wait at OTP Terminal 1 is about 8 minutes.', createdAt: iso(-90 * MIN), read: true },
  ];
}

export function createMockThreads(): ChatThread[] {
  const now = Date.now();
  return [
    {
      id: 'chat-bcn',
      title: 'Barcelona with friends',
      subtitle: '4 travellers · AE 415',
      emoji: '🏖️',
      gradient: 'linear-gradient(135deg, #22C7D3, #FFB36B)',
      members: TRAVELLERS.slice(0, 4),
      unread: 3,
      isPublic: false,
      muted: false,
      lastMessage: msg('m-last', 'chat-bcn', 'u-ana', 'Who brings the speaker? 🔊', now - 40 * MIN),
    },
    {
      id: 'chat-lounge-ae415',
      title: 'AE 415 Flight Lounge',
      subtitle: 'Public · moderated · 23 passengers',
      emoji: '✈️',
      gradient: 'linear-gradient(135deg, #5EC8FF, #8B7CF6)',
      members: TRAVELLERS,
      unread: 0,
      isPublic: true,
      muted: true,
      lastMessage: msg('m-l1', 'chat-lounge-ae415', 'u-vlad', 'Security in T1 took me 10 minutes', now - 25 * MIN),
    },
    {
      id: 'chat-lis',
      title: 'Lisbon long weekend',
      subtitle: '2 travellers',
      emoji: '🚋',
      gradient: 'linear-gradient(135deg, #FFB36B, #FF6B8B)',
      members: [TRAVELLERS[0], TRAVELLERS[4]],
      unread: 0,
      isPublic: false,
      muted: false,
      lastMessage: msg('m-lis', 'chat-lis', 'me', 'Booked the flights! 🎉', now - 3 * DAY),
    },
  ];
}

export function createMockMessages(threadId: string): ChatMessage[] {
  const now = Date.now();
  if (threadId === 'chat-bcn') {
    return [
      msg('b1', threadId, 'u-mihai', 'Morning everyone! Taxi booked for 05:30 ☕', now - 5 * 60 * MIN),
      msg('b2', threadId, 'me', 'Perfect, I will be ready', now - 4.8 * 60 * MIN),
      msg('b3', threadId, 'u-ioana', 'Check-in is done for all of us, seats 14A–14D', now - 3 * 60 * MIN),
      msg('b4', threadId, 'u-ana', 'You are the best 🙌', now - 2.9 * 60 * MIN),
      msg('b5', threadId, 'u-mihai', 'Gate is B12 btw', now - 50 * MIN),
      msg('b6', threadId, 'u-ana', 'Who brings the speaker? 🔊', now - 40 * MIN),
    ];
  }
  if (threadId === 'chat-lounge-ae415') {
    return [
      msg('l0', threadId, 'u-ioana', 'Anyone know if the café near B12 is open?', now - 35 * MIN),
      msg('l1', threadId, 'u-vlad', 'Security in T1 took me 10 minutes', now - 25 * MIN),
    ];
  }
  return [msg('lis1', threadId, 'me', 'Booked the flights! 🎉', now - 3 * DAY)];
}

function msg(id: string, threadId: string, authorId: string, text: string, at: number): ChatMessage {
  const author = TRAVELLERS.find((t) => t.id === authorId);
  return { id, threadId, authorId, authorName: author?.name ?? 'Traveller', text, createdAt: new Date(at).toISOString(), status: 'sent' };
}

export const MOCK_REPLIES = [
  'Haha yes 😄',
  'On my way to the gate 🚶',
  'Sounds good!',
  'Can someone grab me a coffee? ☕',
  'See you at B12 ✈️',
  'Already through security 🙌',
];

export function createMockAirportInfo(code: string): AirportInfo {
  const airport = AIRPORTS[code] ?? AIRPORTS['OTP'];
  return {
    airport,
    wifiName: `${airport.code}-Free-WiFi`,
    walkToGateMinutes: 9,
    lanes: [
      { id: 's1', name: 'Security · Terminal 1', waitMinutes: 8, trend: 'down' },
      { id: 's2', name: 'Fast Track', waitMinutes: 2, trend: 'flat' },
      { id: 's3', name: 'Passport control · Non-Schengen', waitMinutes: 17, trend: 'up' },
    ],
    pois: [
      { id: 'p1', name: 'Runway Coffee Bar', category: 'food', terminal: 'T1', near: 'Gate B10', walkMinutes: 3, open: true, rating: 4.6 },
      { id: 'p2', name: 'Business Lounge', category: 'lounge', terminal: 'T1', near: 'Gate B3', walkMinutes: 6, open: true, rating: 4.4 },
      { id: 'p3', name: 'Charging station', category: 'charging', terminal: 'T1', near: 'Gate B12', walkMinutes: 1, open: true },
      { id: 'p4', name: 'Airport Pharmacy', category: 'pharmacy', terminal: 'T1', near: 'Departures hall', walkMinutes: 7, open: true },
      { id: 'p5', name: 'Duty Free', category: 'shopping', terminal: 'T1', near: 'After security', walkMinutes: 2, open: true, rating: 4.1 },
      { id: 'p6', name: 'Restrooms & baby care', category: 'family', terminal: 'T1', near: 'Gate B11', walkMinutes: 1, open: true },
      { id: 'p7', name: 'Pasta Volo', category: 'food', terminal: 'T1', near: 'Gate B5', walkMinutes: 5, open: false, rating: 4.3 },
    ],
  };
}

export function createMockStats(): TravelStats {
  return {
    flights: 27,
    distanceKm: 48210,
    countries: 14,
    hoursInAir: 71,
    badges: [
      { id: 'b1', title: 'First Flight', icon: 'airplane', earned: true, description: 'Added your first boarding pass' },
      { id: 'b2', title: 'Early Bird', icon: 'sunny', earned: true, description: 'Flew before 7 AM' },
      { id: 'b3', title: 'Squad Goals', icon: 'people', earned: true, description: 'Planned a trip with 3+ friends' },
      { id: 'b4', title: 'Globetrotter', icon: 'earth', earned: false, description: 'Visit 20 countries' },
      { id: 'b5', title: 'Night Owl', icon: 'moon', earned: false, description: 'Take a red-eye flight' },
      { id: 'b6', title: 'Long Haul', icon: 'planet', earned: false, description: 'Fly more than 8 hours' },
    ],
  };
}
