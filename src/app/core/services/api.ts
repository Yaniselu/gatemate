import { AuthProvider, ChecklistItem, ChatMessage, ChatThread, Expense, Flight, FlightAlert, ProfilePatch, Session, TravelStats, Trip, User } from '../models';

export interface SocialCredential {
  provider: Exclude<AuthProvider, 'password'>;
  /** OIDC ID token from Apple/Google, verified server-side (signature, aud, iss, exp, nonce). */
  idToken: string;
  nonce: string;
  /** Apple only sends the name on the very first sign-in. */
  displayName?: string;
  /** Apple authorization code: the server exchanges it for a refresh token so it can revoke it when the account is deleted. */
  authorizationCode?: string;
}

export interface NewFlightInput {
  carrier: string;
  /** Display name when the carrier is known (e.g. "Wizz Air"). */
  airlineName?: string;
  flightNumber: string;
  /** Local wall-clock departure time at the departure airport, e.g. "2026-11-01T06:10". */
  date: string;
  from: string;
  to: string;
  seat?: string;
  bookingRef?: string;
  passengerName: string;
}

export interface BookingLookup {
  airline: string;
  bookingRef: string;
  lastName: string;
}

export interface BookingLookupResult {
  passengerFirstName: string;
  passengerLastName: string;
  flights: Flight[];
}

/**
 * How the user proves the ticket is theirs. The backend re-checks everything:
 * - `pass`: raw IATA barcode (airline digital signature verified when present) + legal-name match;
 * - `booking`: reference + last name confirmed with the airline/aggregator;
 * - every flight can be claimed by one account only (others must be invited to the trip).
 */
export type ClaimRequest =
  | { method: 'pass'; barcode: string }
  | { method: 'booking'; airline: string; bookingRef: string; lastName: string; flightIds: string[] };

export interface FeedbackInput {
  topic: string;
  message: string;
  rating?: number;
  contactEmail?: string;
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
  abstract updateProfile(patch: ProfilePatch): Promise<User>;
  abstract sendFeedback(input: FeedbackInput): Promise<void>;

  // Trips & flights
  abstract getTrips(): Promise<Trip[]>;
  abstract addFlight(input: NewFlightInput): Promise<Trip>;
  abstract lookupBooking(req: BookingLookup): Promise<BookingLookupResult>;
  abstract claimFlight(req: ClaimRequest): Promise<Trip>;
  /** Personal forwarding address; mail is accepted only from the account's verified email with valid airline DKIM. */
  abstract getImportEmail(): Promise<string>;
  abstract createInvite(tripOrChatId: string): Promise<string>;
  /** Single-use invite token from a shared link; joins the trip or chat it points to. */
  abstract registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
  abstract acceptInvite(token: string): Promise<{ type: 'trip' | 'chat'; id: string }>;
  abstract addChecklistItem(tripId: string, label: string, category: ChecklistItem['category']): Promise<ChecklistItem>;
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
  abstract createThread(input: { title: string; emoji: string; tripId?: string }): Promise<ChatThread>;

  // Airport & profile
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
