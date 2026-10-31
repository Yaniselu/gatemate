import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, Injector } from '@angular/core';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessage, ChecklistItem, ChatThread, Companion, Expense, Flight, FlightAlert, ProfilePatch, Session, TravelStats, Trip, User } from '../models';
import { ApiError, AssistantEvent, AssistantStatus, AssistantTurn, EmailPreview, BookingLookup, BookingLookupResult, ClaimRequest, FeedbackInput, GatemateApi, NewFlightInput, RegisterExtra, SocialCredential } from './api';
import { currentLang, t } from '../i18n/i18n.service';
import { AuthService } from './auth.service';

const REQUEST_TIMEOUT_MS = 120_000;

@Injectable()
export class HttpApi extends GatemateApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  private injector = inject(Injector);

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
  register(name: string, email: string, password: string, extra?: RegisterExtra) {
    return this.call(this.http.post<Session>(`${this.base}/auth/register`, { name, email, password, lang: currentLang(), ...extra }));
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
  async confirmPasswordReset(email: string, code: string, password: string) {
    await this.call(this.http.post<void>(`${this.base}/auth/password-reset/confirm`, { email, code, password }));
  }
  getFeatures() {
    return this.call(this.http.get<{ emailCodes: boolean }>(`${this.base}/auth/features`));
  }
  async sendVerificationCode() {
    await this.call(this.http.post<void>(`${this.base}/me/email/code`, {}));
  }
  verifyEmail(code: string) {
    return this.call(this.http.post<User>(`${this.base}/me/email/verify`, { code }));
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
  previewEmail(text: string) {
    return this.call(this.http.post<EmailPreview>(`${this.base}/bookings/email/preview`, { text }));
  }
  importEmail(text: string) {
    return this.call(this.http.post<Trip>(`${this.base}/bookings/email/import`, { text }));
  }
  async createInvite(id: string) {
    return (await this.call(this.http.post<{ url: string }>(`${this.base}/invites`, { targetId: id }))).url;
  }
  syncPro() {
    return this.call(this.http.post<User>(`${this.base}/me/pro/sync`, {}));
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
  addPassenger(flightId: string, companionId: string, seat?: string) {
    return this.call(this.http.post<Flight>(`${this.base}/flights/${enc(flightId)}/passengers`, { companionId, seat: seat || null }));
  }
  removePassenger(flightId: string, companionId: string) {
    return this.call(this.http.delete<Flight>(`${this.base}/flights/${enc(flightId)}/passengers/${enc(companionId)}`));
  }
  verifyIdentity(lines: string[]) {
    return this.call(this.http.post<User>(`${this.base}/me/identity`, { lines }));
  }
  getCompanions() {
    return this.call(this.http.get<Companion[]>(`${this.base}/me/companions`));
  }
  addCompanion(c: Pick<Companion, 'firstName' | 'lastName' | 'relation'>) {
    return this.call(this.http.post<Companion>(`${this.base}/me/companions`, c));
  }
  updateCompanion(id: string, c: Partial<Pick<Companion, 'firstName' | 'lastName' | 'relation'>>) {
    return this.call(this.http.patch<Companion>(`${this.base}/me/companions/${enc(id)}`, c));
  }
  verifyCompanion(id: string, lines: string[]) {
    return this.call(this.http.post<Companion>(`${this.base}/me/companions/${enc(id)}/identity`, { lines }));
  }
  async removeCompanion(id: string) {
    await this.call(this.http.delete<void>(`${this.base}/me/companions/${enc(id)}`));
  }

  assistantStatus() {
    return this.call(this.http.get<AssistantStatus>(`${this.base}/assistant`));
  }

  async assistantChat(messages: AssistantTurn[], onEvent: (e: AssistantEvent) => void, signal: AbortSignal): Promise<void> {
    const auth = this.injector.get(AuthService);
    const send = async (token: string | null) =>
      fetch(`${this.base}/assistant/chat`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Requested-With': 'Gatemate', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages }),
      });
    let res: Response;
    try {
      res = await send(await auth.getAccessToken());
      if (res.status === 401) res = await send((await auth.refresh())?.accessToken ?? null);
    } catch (e) {
      if (signal.aborted) return;
      throw new ApiError(t('No connection. Check your internet and try again.'), 0);
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const api = typeof body?.code === 'string' && typeof body?.message === 'string' && res.status < 500;
      throw new ApiError(api ? t(body.message) : t('Something went wrong on our side. Please try again.'), res.status, body?.code, Number(res.headers.get('Retry-After')) || undefined);
    }
    let buffer = '';
    const flush = (final: boolean) => {
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = final ? '' : (parts.pop() ?? '');
      for (const part of parts) {
        const data = part.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n');
        if (!data) continue;
        try {
          onEvent(JSON.parse(data) as AssistantEvent);
        } catch {
        }
      }
    };
    try {
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          flush(false);
        }
      } else {
        buffer = await res.text();
      }
      buffer += '\n\n';
      flush(true);
    } catch (e) {
      if (!signal.aborted) throw new ApiError(t('No connection. Check your internet and try again.'), 0);
    }
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
    return new ApiError(t(msg), e.status, e.error?.code, retryAfter);
  }
  if (e instanceof Error && e.name === 'TimeoutError') return new ApiError(t('The server is waking up. Please try again in a moment.'), 408);
  return new ApiError('Unexpected error.', 0);
}
