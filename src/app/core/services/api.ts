import { AuthProvider, ChecklistItem, ChatMessage, ChatThread, Companion, Expense, Flight, FlightAlert, ProfilePatch, Session, TravelStats, Trip, User } from '../models';

export interface SocialCredential {
  provider: Exclude<AuthProvider, 'password'>;
  idToken: string;
  nonce: string;
  displayName?: string;
  authorizationCode?: string;
}

export interface RegisterExtra {
  firstName?: string;
  lastName?: string;
  country?: string;
  website?: string;
}

export interface NewFlightInput {
  carrier: string;
  airlineName?: string;
  flightNumber: string;
  date: string;
  from: string;
  to: string;
  seat?: string;
  bookingRef?: string;
  passengerName: string;
  passengers?: { companionId: string; seat?: string }[];
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

export type ClaimRequest =
  | { method: 'pass'; barcode: string; companionId?: string }
  | { method: 'booking'; airline: string; bookingRef: string; lastName: string; flightIds: string[] };

export interface FeedbackInput {
  topic: string;
  message: string;
  rating?: number;
  contactEmail?: string;
}

export interface EmailPreview {
  flights: Flight[];
  bookingRef?: string | null;
  nameFound: boolean;
}

export interface AssistantStatus {
  enabled: boolean;
  used: number;
  limit: number;
}

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

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
  abstract loginWithPassword(email: string, password: string): Promise<Session>;
  abstract register(name: string, email: string, password: string, extra?: RegisterExtra): Promise<Session>;
  abstract loginWithSocial(credential: SocialCredential): Promise<Session>;
  abstract refresh(refreshToken: string): Promise<Session>;
  abstract logout(refreshToken: string): Promise<void>;
  abstract requestPasswordReset(email: string): Promise<void>;
  abstract confirmPasswordReset(email: string, code: string, password: string): Promise<void>;
  abstract sendVerificationCode(): Promise<void>;
  abstract getFeatures(): Promise<{ emailCodes: boolean }>;
  abstract verifyEmail(code: string): Promise<User>;
  abstract deleteAccount(): Promise<void>;
  abstract exportMyData(): Promise<Blob>;
  abstract updateProfile(patch: ProfilePatch): Promise<User>;
  abstract syncPro(): Promise<User>;
  abstract sendFeedback(input: FeedbackInput): Promise<void>;

  abstract getTrips(): Promise<Trip[]>;
  abstract addFlight(input: NewFlightInput): Promise<Trip>;
  abstract lookupBooking(req: BookingLookup): Promise<BookingLookupResult>;
  abstract claimFlight(req: ClaimRequest): Promise<Trip>;
  abstract getImportEmail(): Promise<string>;
  abstract previewEmail(text: string): Promise<EmailPreview>;
  abstract importEmail(text: string): Promise<Trip>;
  abstract createInvite(tripOrChatId: string): Promise<string>;
  abstract registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
  abstract acceptInvite(token: string): Promise<{ type: 'trip' | 'chat'; id: string }>;
  abstract addChecklistItem(tripId: string, label: string, category: ChecklistItem['category']): Promise<ChecklistItem>;
  abstract toggleChecklistItem(tripId: string, itemId: string, done: boolean): Promise<void>;
  abstract addExpense(tripId: string, expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense>;
  abstract getFlightStatus(flightId: string): Promise<Flight>;
  abstract inviteByEmail(targetId: string, email: string): Promise<{ sent: boolean; url: string }>;
  abstract addPassenger(flightId: string, companionId: string, seat?: string): Promise<Flight>;
  abstract removePassenger(flightId: string, companionId: string): Promise<Flight>;
  abstract verifyIdentity(lines: string[]): Promise<User>;
  abstract getCompanions(): Promise<Companion[]>;
  abstract addCompanion(c: Pick<Companion, 'firstName' | 'lastName' | 'relation'>): Promise<Companion>;
  abstract updateCompanion(id: string, c: Partial<Pick<Companion, 'firstName' | 'lastName' | 'relation'>>): Promise<Companion>;
  abstract verifyCompanion(id: string, lines: string[]): Promise<Companion>;
  abstract removeCompanion(id: string): Promise<void>;

  abstract assistantStatus(): Promise<AssistantStatus>;
  abstract assistantChat(messages: AssistantTurn[], onEvent: (e: AssistantEvent) => void, signal: AbortSignal): Promise<void>;

  abstract getAlerts(): Promise<FlightAlert[]>;
  abstract markAlertsRead(ids: string[]): Promise<void>;

  abstract getThreads(): Promise<ChatThread[]>;
  abstract getMessages(threadId: string): Promise<ChatMessage[]>;
  abstract sendMessage(threadId: string, text: string, clientId: string): Promise<ChatMessage>;
  abstract reportMessage(messageId: string, reason: string): Promise<void>;
  abstract blockUser(userId: string): Promise<void>;
  abstract leaveThread(threadId: string): Promise<void>;
  abstract createThread(input: { title: string; emoji: string; tripId?: string }): Promise<ChatThread>;

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
