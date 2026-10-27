import { Injectable } from '@angular/core';
import {
  createMockAirportInfo,
  createMockAlerts,
  createMockMessages,
  createMockStats,
  createMockThreads,
  createMockTrips,
  AIRPORTS,
} from '../data/mock-data';
import { AirportInfo, ChatMessage, ChatThread, Expense, Flight, FlightAlert, Session, TravelStats, Trip, User } from '../models';
import { randomId } from '../security/crypto.util';
import { ApiError, GatemateApi, NewFlightInput, SocialCredential } from './api';

const ACCESS_TTL_MS = 15 * 60_000;

/** In-memory backend used until the Java API exists. Adds realistic latency so skeletons are visible. */
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

  private makeUser(name: string, email: string, provider: User['provider']): User {
    const palette = ['#0FB5C3', '#8B7CF6', '#FF8A5B', '#2FD18A', '#5EC8FF'];
    return {
      id: randomId('usr_'),
      name,
      email,
      provider,
      avatarColor: palette[email.length % palette.length],
      homeAirport: 'OTP',
      createdAt: new Date().toISOString(),
    };
  }

  // ---------- Auth ----------
  async loginWithPassword(email: string, password: string): Promise<Session> {
    await this.delay(null, 700, 1200);
    if (password.length < 8) throw new ApiError('Incorrect email or password.', 401, 'invalid_credentials');
    const local = email.split('@')[0].replace(/[._-]+/g, ' ');
    const name = local.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Traveller';
    return this.session(this.makeUser(name, email, 'password'));
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
    // After a page reload the in-memory mock forgot the user: restore a demo profile.
    return this.session(this.user ?? this.makeUser('Alex Morgan', 'alex.morgan@example.com', 'password'));
  }

  async logout(): Promise<void> {
    await this.delay(null, 100, 200);
    this.user = null;
    this.trips = null;
  }

  async requestPasswordReset(_email: string): Promise<void> {
    // Always succeeds so the response never reveals whether an account exists.
    await this.delay(null, 700, 1100);
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

  async updateProfile(patch: Partial<Pick<User, 'name' | 'homeAirport'>>): Promise<User> {
    if (!this.user) throw new ApiError('Not signed in.', 401);
    this.user = { ...this.user, ...patch };
    return this.delay(this.user, 300, 600);
  }

  // ---------- Trips ----------
  private ensureTrips(): Trip[] {
    this.trips ??= createMockTrips(this.user?.name ?? 'Traveller');
    return this.trips;
  }

  async getTrips(): Promise<Trip[]> {
    return this.delay(this.ensureTrips(), 600, 1300);
  }

  async addFlight(input: NewFlightInput): Promise<Trip> {
    const trips = this.ensureTrips();
    const from = AIRPORTS[input.from] ?? { code: input.from, city: input.from, name: `${input.from} Airport`, country: '', timezone: 'UTC' };
    const to = AIRPORTS[input.to] ?? { code: input.to, city: input.to, name: `${input.to} Airport`, country: '', timezone: 'UTC' };
    const departure = new Date(input.date);
    const flight: Flight = {
      id: randomId('fl_'),
      airline: input.carrier,
      airlineCode: input.carrier,
      number: `${input.carrier} ${input.flightNumber}`,
      from,
      to,
      departure: departure.toISOString(),
      arrival: new Date(departure.getTime() + 150 * 60_000).toISOString(),
      boardingTime: new Date(departure.getTime() - 40 * 60_000).toISOString(),
      seat: input.seat,
      cabin: 'Economy',
      bookingRef: input.bookingRef ?? '',
      passengerName: input.passengerName,
      status: 'scheduled',
      durationMinutes: 150,
      distanceKm: 1500,
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

  // ---------- Alerts ----------
  async getAlerts(): Promise<FlightAlert[]> {
    return this.delay(this.alerts, 400, 900);
  }

  async markAlertsRead(ids: string[]): Promise<void> {
    this.alerts.forEach((a) => ids.includes(a.id) && (a.read = true));
    await this.delay(null, 80, 160);
  }

  // ---------- Chat ----------
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

  async leaveThread(threadId: string): Promise<void> {
    this.threads = this.threads.filter((t) => t.id !== threadId);
    await this.delay(null, 300, 600);
  }

  // ---------- Airport & profile ----------
  async getAirportInfo(code: string): Promise<AirportInfo> {
    return this.delay(createMockAirportInfo(code), 600, 1200);
  }

  async getStats(): Promise<TravelStats> {
    return this.delay(createMockStats(), 500, 1000);
  }
}
