import { inject, Injectable } from '@angular/core';
import { AirportDbService, haversineKm } from './airport-db.service';
import { zonedToUtc } from '../utils/tz';
import {
  createMockAlerts,
  createMockMessages,
  createMockStats,
  createMockThreads,
  createMockTrips,
  AIRPORTS,
} from '../data/mock-data';
import { ChatMessage, ChecklistItem, ChatThread, Expense, Flight, FlightAlert, ProfilePatch, Session, TravelStats, Trip, User } from '../models';
import { AIRLINES, sampleBaggage } from '../data/airlines';
import { parseBcbp } from '../utils/bcbp';
import { matchPassengerName } from '../utils/name-match';
import { randomId } from '../security/crypto.util';
import { locale, t } from '../i18n/i18n.service';
import { ApiError, AssistantEvent, AssistantStatus, AssistantTurn, EmailPreview, BookingLookup, BookingLookupResult, ClaimRequest, FeedbackInput, GatemateApi, NewFlightInput, SocialCredential } from './api';

const ACCESS_TTL_MS = 15 * 60_000;

@Injectable()
export class MockApi extends GatemateApi {
  private user: User | null = null;
  private trips: Trip[] | null = null;
  private alerts = createMockAlerts();
  private threads = createMockThreads();
  private messages = new Map<string, ChatMessage[]>();
  private blocked = new Set<string>();

  private delay<T>(value: T, min = 450, max = 1100): Promise<T> {
    const ms = min + Math.random() * (max - min);
    return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
  }

  private session(user: User): Session {
    this.user = user;
    return {
      user,
      accessToken: randomId('at_'),
      refreshToken: randomId('rt_'),
      expiresAt: Date.now() + ACCESS_TTL_MS,
    };
  }

  private claimed = new Set<string>();
  private lookupAttempts: number[] = [];

  private makeUser(name: string, email: string, provider: User['provider']): User {
    const palette = ['#0FB5C3', '#8B7CF6', '#FF8A5B', '#2FD18A', '#5EC8FF'];
    const [first, ...rest] = name.trim().split(/\s+/);
    return {
      id: randomId('usr_'),
      name,
      email,
      provider,
      legalFirstName: first,
      legalLastName: rest.join(' ') || undefined,
      seatPreference: 'window',
      avatarColor: palette[email.length % palette.length],
      homeAirport: 'OTP',
      createdAt: new Date().toISOString(),
    };
  }

  async loginWithPassword(email: string, password: string): Promise<Session> {
    await this.delay(null, 700, 1200);
    if (password.length < 8) throw new ApiError('Incorrect email or password.', 401, 'invalid_credentials');
    const local = email.split('@')[0].replace(/[._-]+/g, ' ');
    const name = local.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Traveller';
    return this.session({ ...this.makeUser(name, email, 'password'), emailVerified: false });
  }

  async register(name: string, email: string, _password: string): Promise<Session> {
    await this.delay(null, 900, 1400);
    if (email.toLowerCase().startsWith('taken@')) {
      throw new ApiError('An account with this email already exists.', 409, 'email_taken');
    }
    return this.session(this.makeUser(name, email, 'password'));
  }

  async loginWithSocial(c: SocialCredential): Promise<Session> {
    await this.delay(null, 600, 1000);
    const name = c.displayName || (c.provider === 'apple' ? 'Apple User' : 'Google User');
    const email = c.provider === 'apple' ? 'hidden@privaterelay.appleid.com' : 'traveller@gmail.com';
    return this.session(this.makeUser(name, email, c.provider));
  }

  async refresh(refreshToken: string): Promise<Session> {
    await this.delay(null, 150, 300);
    if (!refreshToken.startsWith('rt_')) throw new ApiError('Session expired.', 401, 'invalid_grant');
    return this.session(this.user ?? this.makeUser('Alex Morgan', 'alex.morgan@example.com', 'password'));
  }

  async logout(): Promise<void> {
    await this.delay(null, 100, 200);
    this.user = null;
    this.trips = null;
  }

  async requestPasswordReset(_email: string): Promise<void> {
    await this.delay(null, 700, 1100);
  }

  static readonly DEMO_CODE = '246810';

  async confirmPasswordReset(_email: string, code: string, _password: string): Promise<void> {
    await this.delay(null, 500, 800);
    if (code !== MockApi.DEMO_CODE) throw new ApiError('This code is wrong or has expired.', 400, 'invalid_code');
  }

  async getFeatures() {
    return { emailCodes: true };
  }

  async sendVerificationCode(): Promise<void> {
    await this.delay(null, 400, 700);
  }

  async verifyEmail(code: string): Promise<User> {
    await this.delay(null, 400, 700);
    if (!this.user) throw new ApiError('Please sign in again.', 401);
    if (code !== MockApi.DEMO_CODE) throw new ApiError('That code isn’t right. 4 tries left.', 400, 'wrong_code');
    this.user = { ...this.user, emailVerified: true };
    return this.user;
  }

  async deleteAccount(): Promise<void> {
    await this.delay(null, 900, 1300);
    this.user = null;
    this.trips = null;
  }

  async exportMyData(): Promise<Blob> {
    await this.delay(null);
    const data = { user: this.user, trips: this.trips, exportedAt: new Date().toISOString() };
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  }

  async updateProfile(patch: ProfilePatch): Promise<User> {
    if (!this.user) throw new ApiError('Not signed in.', 401);
    this.user = { ...this.user, ...patch };
    return this.delay(this.user, 400, 800);
  }

  async syncPro(): Promise<User> {
    if (!this.user) throw new ApiError('Not signed in.', 401);
    return this.delay(this.user, 300, 600);
  }

  async demoGrantPro(): Promise<User> {
    if (!this.user) throw new ApiError('Not signed in.', 401);
    this.user = { ...this.user, pro: true, proUntil: new Date(Date.now() + 30 * 86_400_000).toISOString() };
    return this.delay(this.user, 500, 900);
  }

  private requireTripAllowance() {
    if (this.user?.pro) return;
    const upcoming = this.ensureTrips().filter((t) => +new Date(t.endDate) > Date.now()).length;
    if (upcoming >= 3) throw new ApiError('Free accounts can have 3 upcoming trips. Upgrade to Gatemate Pro for unlimited trips.', 402, 'pro_required');
  }

  async sendFeedback(_input: FeedbackInput): Promise<void> {
    await this.delay(null, 500, 900);
  }

  async lookupBooking(req: BookingLookup): Promise<BookingLookupResult> {
    await this.delay(null, 1200, 1800);
    const now = Date.now();
    this.lookupAttempts = this.lookupAttempts.filter((t) => now - t < 10 * 60_000);
    if (this.lookupAttempts.length >= 5) throw new ApiError('Too many lookups. Try again in a few minutes.', 429, 'rate_limited', 300);
    this.lookupAttempts.push(now);

    const legalLast = this.user?.legalLastName ?? '';
    const match = matchPassengerName(this.user?.legalFirstName ?? '', req.lastName, this.user?.legalFirstName ?? '', legalLast);
    if (!/^[A-Z0-9]{6}$/.test(req.bookingRef) || !match.lastNameOk) {
      throw new ApiError('We could not find a booking with this reference and last name.', 404, 'not_found');
    }
    const airline = AIRLINES.find((a) => a.code === req.airline);
    const seed = [...req.bookingRef].reduce((n, c) => n + c.charCodeAt(0), 0);
    const { fareName, baggage } = sampleBaggage(req.airline, seed);
    const dep = new Date(Date.now() + (12 + (seed % 20)) * 86_400_000);
    dep.setHours(6 + (seed % 12), (seed * 7) % 60, 0, 0);
    const dests = ['FCO', 'LIS', 'BCN', 'CDG', 'ATH'];
    const to = AIRPORTS[dests[seed % dests.length]];
    const num = `${req.airline} ${100 + (seed % 899)}`;
    const flight: Flight = {
      id: randomId('fl_'),
      airline: airline?.name ?? req.airline,
      airlineCode: req.airline,
      number: num,
      from: AIRPORTS['OTP'],
      to,
      departure: dep.toISOString(),
      arrival: new Date(dep.getTime() + 165 * 60_000).toISOString(),
      boardingTime: new Date(dep.getTime() - 40 * 60_000).toISOString(),
      cabin: 'Economy',
      bookingRef: req.bookingRef,
      passengerName: `${this.user?.legalFirstName ?? ''} ${legalLast}`.trim(),
      status: 'scheduled',
      durationMinutes: 165,
      distanceKm: 1800,
      fareName,
      baggage,
      seat: `${10 + (seed % 20)}${'ABCDEF'[seed % 6]}`,
    };
    return this.delay({ passengerFirstName: this.user?.legalFirstName ?? '', passengerLastName: legalLast, flights: [flight] }, 0, 0);
  }

  async claimFlight(req: ClaimRequest): Promise<Trip> {
    this.requireTripAllowance();
    await this.delay(null, 900, 1400);
    const user = this.user;
    if (!user?.legalFirstName || !user.legalLastName) throw new ApiError('Add your legal name in your profile first.', 422, 'legal_name_missing');

    let flight: Flight;
    let checks: { label: string; ok: boolean }[];
    if (req.method === 'pass') {
      const p = parseBcbp(req.barcode);
      const m = matchPassengerName(p.firstName, p.lastName, user.legalFirstName, user.legalLastName);
      const key = `${p.bookingRef}|${p.carrier}${p.flightNumber}|${p.julianDate}|${p.lastName}`;
      checks = [
        { label: 'Valid IATA boarding pass barcode', ok: true },
        { label: 'Passenger name matches your legal name', ok: m.ok },
        { label: 'Not added by another Gatemate account', ok: !this.claimed.has(key) },
      ];
      if (!m.ok) throw new ApiError('This boarding pass is in another passenger’s name. Ask them to add it and invite you to the trip.', 403, 'name_mismatch');
      if (this.claimed.has(key)) throw new ApiError('This flight is already linked to another account.', 409, 'already_claimed');
      this.claimed.add(key);
      const dep = new Date(p.flightDate);
      dep.setUTCHours(9, 0);
      const { fareName, baggage } = sampleBaggage(p.carrier, p.bookingRef.length + p.julianDate);
      flight = {
        id: randomId('fl_'),
        airline: AIRLINES.find((a) => a.code === p.carrier)?.name ?? p.carrier,
        airlineCode: p.carrier,
        number: `${p.carrier} ${p.flightNumber}`,
        from: AIRPORTS[p.from] ?? { code: p.from, city: p.from, name: `${p.from} Airport`, country: '', timezone: 'UTC' },
        to: AIRPORTS[p.to] ?? { code: p.to, city: p.to, name: `${p.to} Airport`, country: '', timezone: 'UTC' },
        departure: dep.toISOString(),
        arrival: new Date(dep.getTime() + 150 * 60_000).toISOString(),
        boardingTime: new Date(dep.getTime() - 40 * 60_000).toISOString(),
        seat: p.seat,
        cabin: 'Economy',
        bookingRef: p.bookingRef,
        passengerName: p.passengerName,
        status: 'scheduled',
        durationMinutes: 150,
        distanceKm: 1500,
        fareName,
        baggage: { ...baggage, source: 'boarding-pass' },
      };
    } else {
      const res = await this.lookupBooking(req);
      flight = res.flights[0];
      checks = [
        { label: 'Booking confirmed with the airline', ok: true },
        { label: 'Passenger name matches your legal name', ok: true },
        { label: 'Not added by another Gatemate account', ok: true },
      ];
    }
    flight.verification = { status: 'verified', method: req.method === 'pass' ? 'boarding-pass' : 'airline', checkedAt: new Date().toISOString(), checks };
    const trip = this.tripFor(flight);
    this.ensureTrips().push(trip);
    return this.delay(trip, 0, 0);
  }

  async getImportEmail(): Promise<string> {
    return this.delay(`trips+${(this.user?.id ?? 'demo').slice(-8).toLowerCase()}@in.gatemate.app`, 200, 400);
  }

  private async readEmail(text: string): Promise<{ input: NewFlightInput; ref?: string; nameFound: boolean }> {
    await this.airportDb.load();
    const fn = text.match(/\b([A-Z][A-Z0-9])\s?(\d{1,4})\b/);
    const pair = text.match(/\(([A-Z]{3})\)[^(]*\(([A-Z]{3})\)/) ?? text.match(/\b([A-Z]{3})\s*(?:-|–|→|to)\s*([A-Z]{3})\b/);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const dm = text.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/) ;
    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    const date = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : dm && months.includes(dm[2].toLowerCase()) ? `${dm[3]}-${String(months.indexOf(dm[2].toLowerCase()) + 1).padStart(2, '0')}-${dm[1].padStart(2, '0')}` : null;
    const time = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (!fn || !pair || !date || !this.airportDb.get(pair[1]) || !this.airportDb.get(pair[2])) {
      throw new ApiError('We couldn’t find a flight in this e-mail. Make sure it includes the flight number, the airports and the date.', 422, 'no_flights');
    }
    const ref = text.match(/(?:booking|reservation|confirmation)\s*(?:reference|code|number)?\s*[:#]?\s*([A-Z0-9]{6})\b/i)?.[1];
    const last = (this.user?.legalLastName ?? '').toLowerCase();
    return {
      input: { carrier: fn[1], flightNumber: fn[2], from: pair[1], to: pair[2], date: `${date}T${time ? time[1].padStart(2, '0') + ':' + time[2] : '12:00'}`, bookingRef: ref, passengerName: `${this.user?.legalFirstName ?? ''} ${this.user?.legalLastName ?? ''}`.trim() || 'Traveller' },
      ref,
      nameFound: !!last && text.toLowerCase().includes(last),
    };
  }

  async previewEmail(text: string): Promise<EmailPreview> {
    const r = await this.readEmail(text);
    const trip = await this.addFlight(r.input);
    this.trips = this.ensureTrips().filter((t) => t.id !== trip.id);
    return this.delay({ flights: trip.flights, bookingRef: r.ref ?? null, nameFound: r.nameFound }, 300, 600);
  }

  async importEmail(text: string): Promise<Trip> {
    const r = await this.readEmail(text);
    const trip = await this.addFlight(r.input);
    trip.flights[0].verification = { status: r.nameFound ? 'pending' : 'unverified', method: 'email', checkedAt: new Date().toISOString(), checks: [
      { label: 'Flights read from the airline’s confirmation e-mail', ok: true },
      { label: r.nameFound ? 'Your legal name appears on the booking' : 'Your legal name wasn’t found in the e-mail', ok: r.nameFound },
    ] };
    return this.delay(trip, 400, 700);
  }

  private invites = new Map<string, { type: 'trip' | 'chat'; id: string }>();

  async createInvite(id: string): Promise<string> {
    const token = randomId().replace(/[^a-zA-Z0-9]/g, '').slice(0, 22);
    this.invites.set(token, { type: this.ensureTrips().some((t) => t.id === id) ? 'trip' : 'chat', id });
    return this.delay(`https://gatemate.app/invite/${token}`, 300, 600);
  }

  async registerPushToken(): Promise<void> {}

  async acceptInvite(token: string) {
    const target = this.invites.get(token);
    if (!target) throw new ApiError('This invite has expired. Ask for a new link.', 410, 'invite_expired');
    return this.delay(target, 300, 600);
  }

  private tripFor(flight: Flight): Trip {
    return {
      id: randomId('trip_'),
      title: `Trip to ${flight.to.city}`,
      destination: flight.to,
      coverGradient: 'linear-gradient(135deg, #22C7D3 0%, #8B7CF6 100%)',
      emoji: '🧳',
      startDate: flight.departure,
      endDate: flight.arrival,
      flights: [flight],
      travellers: [{ id: 'me', name: 'You', initials: 'ME', color: '#0FB5C3' }],
      checklist: [
        { id: randomId(), label: 'Passport or ID card', done: false, category: 'documents' },
        { id: randomId(), label: 'Online check-in', done: false, category: 'tasks' },
      ],
      expenses: [],
    };
  }

  private ensureTrips(): Trip[] {
    this.trips ??= createMockTrips(this.user?.name ?? 'Traveller');
    return this.trips;
  }

  async getTrips(): Promise<Trip[]> {
    return this.delay(this.ensureTrips(), 600, 1300);
  }

  private airportDb = inject(AirportDbService);

  async addFlight(input: NewFlightInput): Promise<Trip> {
    const trips = this.ensureTrips();
    this.requireTripAllowance();
    await this.airportDb.load();
    const ra = this.airportDb.get(input.from), rb = this.airportDb.get(input.to);
    if (!ra || !rb) throw new ApiError('Unknown airport code.', 400, 'unknown_airport');
    const ap = (r: typeof ra) => ({ code: r.iata, city: r.city, name: r.name, country: this.airportDb.countryName(r.country), timezone: r.tz });
    const from = ap(ra), to = ap(rb);
    const departure = /Z$|[+-]\d\d:\d\d$/.test(input.date) ? new Date(input.date) : zonedToUtc(input.date, ra.tz);
    if (isNaN(departure.getTime())) throw new ApiError('Enter a valid departure date and time.', 400, 'bad_date');
    const km = Math.round(haversineKm(ra.lat, ra.lon, rb.lat, rb.lon));
    const minutes = Math.round(30 + (km / 800) * 60);
    const flight: Flight = {
      id: randomId('fl_'),
      airline: input.airlineName ?? input.carrier,
      airlineCode: input.carrier,
      number: `${input.carrier} ${input.flightNumber}`,
      from,
      to,
      departure: departure.toISOString(),
      arrival: new Date(departure.getTime() + minutes * 60_000).toISOString(),
      boardingTime: new Date(departure.getTime() - 40 * 60_000).toISOString(),
      seat: input.seat,
      cabin: 'Economy',
      bookingRef: input.bookingRef ?? '',
      passengerName: input.passengerName,
      status: 'scheduled',
      durationMinutes: minutes,
      distanceKm: km,
      verification: { status: 'unverified', method: 'manual', checkedAt: new Date().toISOString(), checks: [] },
    };
    const trip: Trip = {
      id: randomId('trip_'),
      title: `Trip to ${to.city}`,
      destination: to,
      coverGradient: 'linear-gradient(135deg, #22C7D3 0%, #8B7CF6 100%)',
      emoji: '🧳',
      startDate: flight.departure,
      endDate: flight.arrival,
      flights: [flight],
      travellers: [{ id: 'me', name: 'You', initials: 'ME', color: '#0FB5C3' }],
      checklist: [
        { id: randomId(), label: 'Passport or ID card', done: false, category: 'documents' },
        { id: randomId(), label: 'Online check-in', done: false, category: 'tasks' },
      ],
      expenses: [],
    };
    trips.push(trip);
    return this.delay(trip, 700, 1000);
  }

  async addChecklistItem(tripId: string, label: string, category: ChecklistItem['category']): Promise<ChecklistItem> {
    const item: ChecklistItem = { id: randomId('chk_'), label, done: false, category };
    this.ensureTrips().find((t) => t.id === tripId)?.checklist.push(item);
    return this.delay(item, 150, 300);
  }

  async toggleChecklistItem(tripId: string, itemId: string, done: boolean): Promise<void> {
    const item = this.ensureTrips().find((t) => t.id === tripId)?.checklist.find((c) => c.id === itemId);
    if (item) item.done = done;
    await this.delay(null, 120, 260);
  }

  async addExpense(tripId: string, expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    const created: Expense = { ...expense, id: randomId('exp_'), createdAt: new Date().toISOString() };
    this.ensureTrips().find((t) => t.id === tripId)?.expenses.push(created);
    return this.delay(created, 300, 600);
  }

  async getFlightStatus(flightId: string): Promise<Flight> {
    const flight = this.ensureTrips().flatMap((t) => t.flights).find((f) => f.id === flightId);
    if (!flight) throw new ApiError('Flight not found.', 404);
    return this.delay(flight, 300, 700);
  }

  private veloUsed = 0;

  async assistantStatus(): Promise<AssistantStatus> {
    return this.delay({ enabled: true, used: this.veloUsed, limit: 20 }, 100, 250);
  }

  async assistantChat(messages: AssistantTurn[], onEvent: (e: AssistantEvent) => void, signal: AbortSignal): Promise<void> {
    this.veloUsed++;
    const q = (messages[messages.length - 1]?.text ?? '').toLowerCase();
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const emit = (e: AssistantEvent) => !signal.aborted && onEvent(e);
    const tool = async (id: string, name: string, ms = 700) => {
      emit({ type: 'tool', id, name });
      await wait(ms);
      emit({ type: 'tool_done', id, ok: true });
    };
    const write = async (text: string) => {
      for (const chunk of text.match(/.{1,6}/gs) ?? []) {
        if (signal.aborted) return;
        emit({ type: 'delta', text: chunk });
        await wait(18);
      }
    };
    const when = (iso: string, tz: string) => new Date(iso).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz });
    await wait(500);
    await tool('t1', 'get_my_trips');
    const trip = this.ensureTrips().filter((x) => +new Date(x.endDate) > Date.now()).sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))[0];
    const f = trip?.flights[0];
    if (!trip || !f) {
      await write(t('You have no upcoming trips yet. Add a flight and I’ll plan the day with you ✈️'));
    } else if (/(prepar|pregăt|checklist|list|pack|bagaj|valiz)/.test(q)) {
      await tool('t2', 'get_destination_guide', 900);
      const items = [t('Plug adapter (type {plugs})', { plugs: 'C/F' }), t('Card without FX fees or some {code}', { code: 'EUR' }), t('Offline map of {city}', { city: f.to.city })];
      for (const label of items) await this.addChecklistItem(trip.id, label, 'packing');
      emit({ type: 'tool', id: 't3', name: 'add_checklist_items' });
      await wait(500);
      emit({ type: 'action', kind: 'checklist', tripId: trip.id, added: items });
      emit({ type: 'tool_done', id: 't3', ok: true });
      await write(t('Done! I added **{n} items** to your {city} checklist:', { n: items.length, city: f.to.city }) + '\n' + items.map((i) => '- ' + i).join('\n') + '\n\n' + t('Flight **{flight}** leaves **{time}** local time. Check in online 24 h before.', { flight: f.number, time: when(f.departure, f.from.timezone) }));
    } else if (/(delay|întârz|intarz|cancel|anul|compens|drept|right)/.test(q)) {
      await tool('t2', 'estimate_compensation', 600);
      await write(t('For **{flight}** ({from} → {to}, about {km} km), if you land **3 h or more** late you can claim **€{amount}** from the airline under EU261, unless the cause was extraordinary (weather, ATC strikes). Meanwhile they owe you meals and, overnight, a hotel. Ask the airline for the reason in writing.', { flight: f.number, from: f.from.code, to: f.to.code, km: f.distanceKm, amount: f.distanceKm <= 1500 ? 250 : 400 }));
    } else if (/(visa|viză|viza|entry|intrare|pașaport|pasaport|passport|weather|vreme)/.test(q)) {
      await tool('t2', 'web_search', 1300);
      emit({ type: 'sources', items: [{ title: 'Re-open EU', url: 'https://reopen.europa.eu' }, { title: 'Ministry of Foreign Affairs', url: 'https://www.mae.ro' }] });
      await write(t('{from} → {to} is inside the Schengen area: a valid ID card or passport is required.', { from: f.from.city, to: f.to.city }) + ' ' + t('No visa needed for EU citizens. Always check the official travel advice before you fly.'));
    } else {
      await write(t('Your next flight is **{flight}** {from} → {to}, **{time}** local time, gate **{gate}**. I can prepare your checklist, plan the airport day or check your rights if it’s delayed.', { flight: f.number, from: f.from.code, to: f.to.code, time: when(f.departure, f.from.timezone), gate: f.gate ?? t('TBA') }));
    }
    emit({ type: 'done' });
  }

  async getAlerts(): Promise<FlightAlert[]> {
    return this.delay(this.alerts, 400, 900);
  }

  async markAlertsRead(ids: string[]): Promise<void> {
    this.alerts.forEach((a) => ids.includes(a.id) && (a.read = true));
    await this.delay(null, 80, 160);
  }

  async getThreads(): Promise<ChatThread[]> {
    return this.delay(this.threads, 500, 1000);
  }

  async getMessages(threadId: string): Promise<ChatMessage[]> {
    if (!this.messages.has(threadId)) this.messages.set(threadId, createMockMessages(threadId));
    const visible = this.messages.get(threadId)!.filter((m) => !this.blocked.has(m.authorId));
    const thread = this.threads.find((t) => t.id === threadId);
    if (thread) thread.unread = 0;
    return this.delay(visible, 500, 900);
  }

  async sendMessage(threadId: string, text: string, clientId: string): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: clientId,
      threadId,
      authorId: 'me',
      authorName: this.user?.name ?? 'You',
      text,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };
    const list = this.messages.get(threadId) ?? [];
    list.push(message);
    this.messages.set(threadId, list);
    const thread = this.threads.find((t) => t.id === threadId);
    if (thread) thread.lastMessage = message;
    return this.delay(message, 250, 600);
  }

  async reportMessage(_messageId: string, _reason: string): Promise<void> {
    await this.delay(null, 400, 700);
  }

  async blockUser(userId: string): Promise<void> {
    this.blocked.add(userId);
    await this.delay(null, 300, 600);
  }

  async createThread(input: { title: string; emoji: string; tripId?: string }): Promise<ChatThread> {
    const thread: ChatThread = {
      id: randomId('chat_'),
      title: input.title,
      subtitle: 'Only you so far · invite friends',
      emoji: input.emoji,
      gradient: 'linear-gradient(135deg, #22C7D3, #0A6E80)',
      members: [{ id: 'me', name: 'You', initials: 'ME', color: '#0FB5C3' }],
      unread: 0,
      isPublic: false,
      muted: false,
    };
    this.threads.unshift(thread);
    this.messages.set(thread.id, []);
    return this.delay(thread, 500, 800);
  }

  async leaveThread(threadId: string): Promise<void> {
    this.threads = this.threads.filter((t) => t.id !== threadId);
    await this.delay(null, 300, 600);
  }

  async getStats(): Promise<TravelStats> {
    return this.delay(createMockStats(), 500, 1000);
  }
}
