import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessage, ChecklistItem, ChatThread, Expense, Flight, FlightAlert, ProfilePatch, Session, TravelStats, Trip, User } from '../models';
import { ApiError, BookingLookup, BookingLookupResult, ClaimRequest, FeedbackInput, GatemateApi, NewFlightInput, SocialCredential } from './api';

// Generous: a free-tier server can take ~50 s to wake up after being idle.
const REQUEST_TIMEOUT_MS = 120_000;

/** Real backend client. Endpoints are the contract the Spring Boot API will implement. */
@Injectable()
export class HttpApi extends GatemateApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private async call<T>(req: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(req.pipe(timeout(REQUEST_TIMEOUT_MS)));
    } catch (e) {
      throw toApiError(e);
    }
  }

  loginWithPassword(email: string, password: string) {
    return this.call(this.http.post<Session>(`${this.base}/auth/login`, { email, password }));
  }
  register(name: string, email: string, password: string) {
    return this.call(this.http.post<Session>(`${this.base}/auth/register`, { name, email, password }));
  }
  loginWithSocial(c: SocialCredential) {
    return this.call(this.http.post<Session>(`${this.base}/auth/oauth/${c.provider}`, c));
  }
  refresh(refreshToken: string) {
    return this.call(this.http.post<Session>(`${this.base}/auth/refresh`, { refreshToken }));
  }
  async logout(refreshToken: string) {
    await this.call(this.http.post<void>(`${this.base}/auth/logout`, { refreshToken }));
  }
  async requestPasswordReset(email: string) {
    await this.call(this.http.post<void>(`${this.base}/auth/password-reset`, { email }));
  }
  async deleteAccount() {
    await this.call(this.http.delete<void>(`${this.base}/me`));
  }
  exportMyData() {
    return this.call(this.http.get(`${this.base}/me/export`, { responseType: 'blob' }));
  }
  updateProfile(patch: ProfilePatch) {
    return this.call(this.http.patch<User>(`${this.base}/me`, patch));
  }
  async sendFeedback(input: FeedbackInput) {
    await this.call(this.http.post<void>(`${this.base}/feedback`, input));
  }
  lookupBooking(req: BookingLookup) {
    return this.call(this.http.post<BookingLookupResult>(`${this.base}/bookings/lookup`, req));
  }
  claimFlight(req: ClaimRequest) {
    return this.call(this.http.post<Trip>(`${this.base}/flights/claim`, req));
  }
  async getImportEmail() {
    return (await this.call(this.http.get<{ address: string }>(`${this.base}/me/import-email`))).address;
  }
  async createInvite(id: string) {
    return (await this.call(this.http.post<{ url: string }>(`${this.base}/invites`, { targetId: id }))).url;
  }
  async registerPushToken(token: string, platform: 'ios' | 'android') {
    await this.call(this.http.post<void>(`${this.base}/push-tokens`, { token, platform }));
  }
  addChecklistItem(tripId: string, label: string, category: ChecklistItem['category']) {
    return this.call(this.http.post<ChecklistItem>(`${this.base}/trips/${enc(tripId)}/checklist`, { label, category }));
  }
  acceptInvite(token: string) {
    return this.call(this.http.post<{ type: 'trip' | 'chat'; id: string }>(`${this.base}/invites/${enc(token)}/accept`, {}));
  }
  createThread(input: { title: string; emoji: string; tripId?: string }) {
    return this.call(this.http.post<ChatThread>(`${this.base}/chats`, input));
  }

  getTrips() {
    return this.call(this.http.get<Trip[]>(`${this.base}/trips`));
  }
  addFlight(input: NewFlightInput) {
    return this.call(this.http.post<Trip>(`${this.base}/flights`, input));
  }
  async toggleChecklistItem(tripId: string, itemId: string, done: boolean) {
    await this.call(this.http.patch<void>(`${this.base}/trips/${enc(tripId)}/checklist/${enc(itemId)}`, { done }));
  }
  addExpense(tripId: string, expense: Omit<Expense, 'id' | 'createdAt'>) {
    return this.call(this.http.post<Expense>(`${this.base}/trips/${enc(tripId)}/expenses`, expense));
  }
  getFlightStatus(flightId: string) {
    return this.call(this.http.get<Flight>(`${this.base}/flights/${enc(flightId)}/status`));
  }

  getAlerts() {
    return this.call(this.http.get<FlightAlert[]>(`${this.base}/alerts`));
  }
  async markAlertsRead(ids: string[]) {
    await this.call(this.http.post<void>(`${this.base}/alerts/read`, { ids }));
  }

  getThreads() {
    return this.call(this.http.get<ChatThread[]>(`${this.base}/chats`));
  }
  getMessages(threadId: string) {
    return this.call(this.http.get<ChatMessage[]>(`${this.base}/chats/${enc(threadId)}/messages`));
  }
  sendMessage(threadId: string, text: string, clientId: string) {
    return this.call(this.http.post<ChatMessage>(`${this.base}/chats/${enc(threadId)}/messages`, { text, clientId }));
  }
  async reportMessage(messageId: string, reason: string) {
    await this.call(this.http.post<void>(`${this.base}/moderation/reports`, { messageId, reason }));
  }
  async blockUser(userId: string) {
    await this.call(this.http.post<void>(`${this.base}/moderation/blocks`, { userId }));
  }
  async leaveThread(threadId: string) {
    await this.call(this.http.delete<void>(`${this.base}/chats/${enc(threadId)}/membership`));
  }

  getStats() {
    return this.call(this.http.get<TravelStats>(`${this.base}/me/stats`));
  }
}

const enc = encodeURIComponent;

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof HttpErrorResponse) {
    const retryAfter = Number(e.headers?.get('Retry-After')) || undefined;
    // Our API returns {code, message} with messages written for users; anything else (proxies, HTML error
    // pages) is never echoed.
    const api = typeof e.error?.code === 'string' && typeof e.error?.message === 'string' && e.status < 500;
    const msg =
      e.status === 0 ? 'No connection. Check your internet and try again.'
      : api ? e.error.message.slice(0, 200)
      : e.status === 401 ? 'Your session has expired. Please sign in again.'
      : e.status === 403 ? 'You do not have access to this.'
      : e.status === 429 ? 'Too many attempts. Please wait a moment.'
      : e.status >= 500 ? 'Something went wrong on our side. Please try again.'
      : typeof e.error?.message === 'string' ? e.error.message.slice(0, 200)
      : 'Request failed.';
    return new ApiError(msg, e.status, e.error?.code, retryAfter);
  }
  if (e instanceof Error && e.name === 'TimeoutError') return new ApiError('The server is waking up. Please try again in a moment.', 408);
  return new ApiError('Unexpected error.', 0);
}
