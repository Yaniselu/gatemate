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
export interface EmailPreview {
  flights: Flight[];
  bookingRef?: string | null;
  /** The account's legal name appears in the e-mail. */
  nameFound: boolean;
}

/** Velo, the AI travel agent: whether it's on, and today's messages. */
export interface AssistantStatus {
  enabled: boolean;
  used: number;
  limit: number;
}

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** What streams back while Velo answers. */
export type AssistantEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; id: string; name: string }
  | { type: 'tool_done'; id: string; ok: boolean }
  | { type: 'action'; kind: 'checklist'; tripId: string; added: string[] }
  | { type: 'sources'; items: { title: string; url: string }[] }
  | { type: 'truncated' }
  | { type: 'done' }
  | { type: 'error'; message: string };

export abstract class GatemateApi {
  // Auth
  abstract loginWithPassword(email: string, password: string): Promise<Session>;
  abstract register(name: string, email: string, password: string): Promise<Session>;
  abstract loginWithSocial(credential: SocialCredential): Promise<Session>;
  abstract refresh(refreshToken: string): Promise<Session>;
  abstract logout(refreshToken: string): Promise<void>;
  abstract requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password with the 6-digit code from the reset e-mail. */
  abstract confirmPasswordReset(email: string, code: string, password: string): Promise<void>;
  /** E-mails a new 6-digit code to confirm the account's address. */
  abstract sendVerificationCode(): Promise<void>;
  /** What the server supports (e.g. e-mailing codes). */
  abstract getFeatures(): Promise<{ emailCodes: boolean }>;
  abstract verifyEmail(code: string): Promise<User>;
  abstract deleteAccount(): Promise<void>;
  abstract exportMyData(): Promise<Blob>;
  abstract updateProfile(patch: ProfilePatch): Promise<User>;
  /** Asks the server to re-check the store subscription right after a purchase or restore. */
  abstract syncPro(): Promise<User>;
  abstract sendFeedback(input: FeedbackInput): Promise<void>;

  // Trips & flights
  abstract getTrips(): Promise<Trip[]>;
  abstract addFlight(input: NewFlightInput): Promise<Trip>;
  abstract lookupBooking(req: BookingLookup): Promise<BookingLookupResult>;
  abstract claimFlight(req: ClaimRequest): Promise<Trip>;
  /** Personal forwarding address; mail is accepted only from the account's verified email with valid airline DKIM. */
  abstract getImportEmail(): Promise<string>;
  /** Reads flights out of a pasted confirmation e-mail without saving anything. */
  abstract previewEmail(text: string): Promise<EmailPreview>;
  abstract importEmail(text: string): Promise<Trip>;
  abstract createInvite(tripOrChatId: string): Promise<string>;
  /** Single-use invite token from a shared link; joins the trip or chat it points to. */
  abstract registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
  abstract acceptInvite(token: string): Promise<{ type: 'trip' | 'chat'; id: string }>;
  abstract addChecklistItem(tripId: string, label: string, category: ChecklistItem['category']): Promise<ChecklistItem>;
  abstract toggleChecklistItem(tripId: string, itemId: string, done: boolean): Promise<void>;
  abstract addExpense(tripId: string, expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense>;
  abstract getFlightStatus(flightId: string): Promise<Flight>;

  // Velo (AI travel agent)
  abstract assistantStatus(): Promise<AssistantStatus>;
  /** Streams one answer; resolves when it's finished (or aborted). */
  abstract assistantChat(messages: AssistantTurn[], onEvent: (e: AssistantEvent) => void, signal: AbortSignal): Promise<void>;

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
