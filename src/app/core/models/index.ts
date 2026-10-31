export type AuthProvider = 'password' | 'apple' | 'google';

export type SeatPreference = 'window' | 'aisle' | 'no-preference';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string;
  provider: AuthProvider;
  homeAirport?: string;
  legalFirstName?: string;
  legalLastName?: string;
  phone?: string;
  seatPreference?: SeatPreference;
  bio?: string;
  createdAt: string;
  pro?: boolean;
  proUntil?: string;
  emailVerified?: boolean;
  lang?: string;
  identityVerified?: boolean;
  identityCountry?: string;
  identityExpiry?: string;
  country?: string;
}

export type Relation = 'partner' | 'child' | 'parent' | 'sibling' | 'relative' | 'friend';

export interface Companion {
  id: string;
  firstName: string;
  lastName: string;
  relation: Relation;
  verified: boolean;
  docCountry?: string;
  docExpiry?: string;
}

export interface Passenger {
  companionId: string;
  name: string;
  seat?: string;
  relation?: Relation;
  verified: boolean;
  barcode?: string;
}

export type ProfilePatch = Partial<Pick<User, 'name' | 'homeAirport' | 'legalFirstName' | 'legalLastName' | 'phone' | 'seatPreference' | 'bio' | 'avatarUrl' | 'lang'>>;

export interface Session {
  user: User;
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
}

export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
  timezone: string;
  imageUrl?: string;
}

export type FlightStatus = 'scheduled' | 'on-time' | 'boarding' | 'delayed' | 'departed' | 'landed' | 'cancelled';

export interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  number: string;
  from: Airport;
  to: Airport;
  departure: string;
  arrival: string;
  boardingTime: string;
  gate?: string;
  terminal?: string;
  seat?: string;
  cabin: 'Economy' | 'Premium' | 'Business' | 'First';
  bookingRef: string;
  passengerName: string;
  status: FlightStatus;
  delayMinutes?: number;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  passengers?: Passenger[];
  ownerFlying?: boolean;
  barcode?: string;
  baggageBelt?: string;
  durationMinutes: number;
  distanceKm: number;
  aircraft?: string;
  aircraftReg?: string;
  fareName?: string;
  baggage?: BaggageAllowance;
  verification?: FlightVerification;
}

export interface BagItem {
  label: string;
  dimensionsCm: [number, number, number];
  maxKg?: number;
  count: number;
  included: boolean;
}

export interface BaggageAllowance {
  personalItem: BagItem;
  cabinBag: BagItem | null;
  checked: BagItem[];
  notes: string[];
  source: 'airline' | 'boarding-pass' | 'manual';
}

export type VerificationStatus = 'verified' | 'pending' | 'mismatch' | 'unverified';
export type VerificationMethod = 'airline' | 'boarding-pass' | 'email' | 'manual';

export interface FlightVerification {
  status: VerificationStatus;
  method: VerificationMethod;
  checkedAt: string;
  checks: { label: string; ok: boolean }[];
}

export interface Trip {
  id: string;
  title: string;
  destination: Airport;
  coverGradient: string;
  emoji: string;
  startDate: string;
  endDate: string;
  flights: Flight[];
  travellers: Traveller[];
  checklist: ChecklistItem[];
  expenses: Expense[];
  chatId?: string;
}

export interface Traveller {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  category: 'documents' | 'packing' | 'tasks';
}

export interface Expense {
  id: string;
  label: string;
  amount: number;
  currency: string;
  paidBy: string;
  splitWith: string[];
  createdAt: string;
}

export type AlertKind = 'boarding' | 'gate' | 'delay' | 'checkin' | 'baggage' | 'chat' | 'info' | 'leave' | 'documents' | 'weather' | 'bags' | 'checklist';

export interface FlightAlert {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  flightId?: string;
  tripId?: string;
  scheduledFor?: string;
  source?: 'server' | 'device';
}

export interface ChatThread {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
  members: Traveller[];
  lastMessage?: ChatMessage;
  unread: number;
  isPublic: boolean;
  muted: boolean;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  status: 'sending' | 'sent' | 'failed';
  flagged?: boolean;
}

export type PoiCategory = 'food' | 'lounge' | 'charging' | 'pharmacy' | 'shopping' | 'restroom' | 'wifi' | 'family';

export interface TravelStats {
  flights: number;
  distanceKm: number;
  countries: number;
  hoursInAir: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  title: string;
  icon: string;
  earned: boolean;
  description: string;
}

export interface NotificationPrefs {
  boarding: boolean;
  gateChanges: boolean;
  delays: boolean;
  checkIn: boolean;
  baggage: boolean;
  chat: boolean;
  tips: boolean;
  liveActivity: boolean;
}
