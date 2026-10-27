import { AirportInfo, AuthProvider, ChatMessage, ChatThread, Expense, Flight, FlightAlert, Session, TravelStats, Trip, User } from '../models';

export interface SocialCredential {
  provider: Exclude<AuthProvider, 'password'>;
  /** OIDC ID token from Apple/Google, verified server-side (signature, aud, iss, exp, nonce). */
  idToken: string;
  nonce: string;
  /** Apple only sends the name on the very first sign-in. */
  displayName?: string;
}

export interface NewFlightInput {
  carrier: string;
  flightNumber: string;
  date: string;
  from: string;
  to: string;
  seat?: string;
  bookingRef?: string;
  passengerName: string;
}

/**
 * Contract between the app and the Gatemate Java backend.
 * `MockApi` implements it in-memory for the front-end phase; `HttpApi` talks to the real server.
 */
export abstract class GatemateApi {
  // Auth
  abstract loginWithPassword(email: string, password: string): Promise<Session>;
  abstract register(name: string, email: string, password: string): Promise<Session>;
  abstract loginWithSocial(credential: SocialCredential): Promise<Session>;
  abstract refresh(refreshToken: string): Promise<Session>;
  abstract logout(refreshToken: string): Promise<void>;
  abstract requestPasswordReset(email: string): Promise<void>;
  abstract deleteAccount(): Promise<void>;
  abstract exportMyData(): Promise<Blob>;
  abstract updateProfile(patch: Partial<Pick<User, 'name' | 'homeAirport'>>): Promise<User>;

  // Trips & flights
  abstract getTrips(): Promise<Trip[]>;
  abstract addFlight(input: NewFlightInput): Promise<Trip>;
  abstract toggleChecklistItem(tripId: string, itemId: string, done: boolean): Promise<void>;
  abstract addExpense(tripId: string, expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense>;
  abstract getFlightStatus(flightId: string): Promise<Flight>;

  // Alerts
  abstract getAlerts(): Promise<FlightAlert[]>;
  abstract markAlertsRead(ids: string[]): Promise<void>;

  // Chat
  abstract getThreads(): Promise<ChatThread[]>;
  abstract getMessages(threadId: string): Promise<ChatMessage[]>;
  abstract sendMessage(threadId: string, text: string, clientId: string): Promise<ChatMessage>;
  abstract reportMessage(messageId: string, reason: string): Promise<void>;
  abstract blockUser(userId: string): Promise<void>;
  abstract leaveThread(threadId: string): Promise<void>;

  // Airport & profile
  abstract getAirportInfo(code: string): Promise<AirportInfo>;
  abstract getStats(): Promise<TravelStats>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
