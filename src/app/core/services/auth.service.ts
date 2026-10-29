import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { environment } from '../../../environments/environment';
import { ProfilePatch, Session, User } from '../models';
import { createNonce } from '../security/crypto.util';
import { SecureStorageService } from '../security/secure-storage.service';
import { ApiError, GatemateApi, SocialCredential } from './api';
import { PlatformService } from './platform.service';
import { currentLang } from '../i18n/i18n.service';

const REFRESH_KEY = 'refresh_token';
/** Last known profile, so the app opens instantly (and offline) while the token refreshes in the background. */
const USER_KEY = 'session_user';
/** Device copy of the user's trips (see TravelStore); erased with the session. */
export const TRIPS_CACHE_KEY = 'trips_cache';
const REFRESH_SKEW_MS = 30_000;

export type AuthStatus = 'unknown' | 'signed-out' | 'signed-in';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(GatemateApi);
  private storage = inject(SecureStorageService);
  private platform = inject(PlatformService);
  private router = inject(Router);

  // Access token is kept in memory only — never written to disk.
  private session = signal<Session | null>(null);
  private refreshing: Promise<Session | null> | null = null;
  private socialReady: Promise<void> | null = null;

  readonly status = signal<AuthStatus>('unknown');
  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly firstName = computed(() => (this.user()?.name ?? '').split(' ')[0] || 'traveller');

  // Client-side brute-force friction. The backend enforces the real rate limit.
  private failedAttempts = 0;
  readonly lockedUntil = signal(0);

  /**
   * Restore a session from the refresh token in the Keychain/Keystore. With a saved profile the app opens
   * straight away and the token refreshes in the background, so a sleeping server or no signal doesn't
   * block start-up. Only a rejected token signs the user out.
   */
  async init(): Promise<void> {
    const refreshToken = await this.storage.get(REFRESH_KEY);
    if (!refreshToken) {
      this.status.set('signed-out');
      return;
    }
    const cached = await this.cachedUser();
    if (cached) {
      this.session.set({ user: cached, accessToken: '', expiresAt: 0, refreshToken });
      this.status.set('signed-in');
      void this.refresh().then((s) => { if (!s) void this.forceSignOut(); }, () => {});
      return;
    }
    try {
      const restored = await this.refresh();
      this.status.set(restored ? 'signed-in' : 'signed-out');
    } catch {
      this.status.set('signed-out');
    }
  }

  async loginWithPassword(email: string, password: string): Promise<void> {
    this.assertNotThrottled();
    try {
      await this.accept(await this.api.loginWithPassword(email.trim().toLowerCase(), password));
      this.failedAttempts = 0;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) this.registerFailure();
      if (e instanceof ApiError && e.status === 429) this.lockedUntil.set(Date.now() + (e.retryAfterSeconds ?? 60) * 1000);
      throw e;
    }
  }

  async register(name: string, email: string, password: string): Promise<void> {
    await this.accept(await this.api.register(name.trim(), email.trim().toLowerCase(), password));
  }

  async loginWithApple(): Promise<void> {
    await this.loginWithProvider('apple');
  }

  async loginWithGoogle(): Promise<void> {
    await this.loginWithProvider('google');
  }

  /** Saves only the changed fields and swaps the user in place (no reload of other data). */
  async updateProfile(patch: ProfilePatch): Promise<User> {
    const user = await this.api.updateProfile(patch);
    this.setUser(user);
    return user;
  }

  /** Replaces the signed-in user (e.g. after the server confirms a subscription). */
  setUser(user: User): void {
    this.session.update((s) => (s ? { ...s, user } : s));
    void this.storage.set(USER_KEY, JSON.stringify(user)).catch(() => {});
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.api.requestPasswordReset(email.trim().toLowerCase());
  }

  confirmPasswordReset(email: string, code: string, password: string): Promise<void> {
    return this.api.confirmPasswordReset(email.trim().toLowerCase(), code, password);
  }

  private features: Promise<{ emailCodes: boolean }> | null = null;
  /** Whether the server can e-mail codes (verification, password reset). */
  async emailCodes(): Promise<boolean> {
    this.features ??= this.api.getFeatures().catch(() => {
      this.features = null;
      return { emailCodes: false };
    });
    return (await this.features).emailCodes;
  }

  sendVerificationCode(): Promise<void> {
    return this.api.sendVerificationCode();
  }

  async verifyEmail(code: string): Promise<void> {
    this.setUser(await this.api.verifyEmail(code));
  }

  /**
   * Returns a valid access token, refreshing it shortly before expiry. Throws an ApiError when the server
   * can't be reached, so callers show "no connection" instead of signing the user out.
   */
  async getAccessToken(): Promise<string | null> {
    const s = this.session();
    if (!s) return null;
    if (s.expiresAt - Date.now() > REFRESH_SKEW_MS) return s.accessToken;
    return (await this.refresh())?.accessToken ?? null;
  }

  /**
   * Single-flight refresh: concurrent 401s share one refresh call. Tokens rotate on every refresh.
   * Resolves null when the server rejects the token (signed out); rethrows when it simply can't be reached.
   */
  refresh(): Promise<Session | null> {
    this.refreshing ??= (async () => {
      try {
        const token = await this.storage.get(REFRESH_KEY);
        if (!token) return null;
        const next = await this.api.refresh(token);
        await this.storeSession(next);
        return next;
      } catch (e) {
        if (isTransient(e)) throw e;
        await this.clearLocal();
        return null;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async logout(): Promise<void> {
    const token = await this.storage.get(REFRESH_KEY);
    if (token) await this.api.logout(token).catch(() => {});
    if (this.platform.isNative) await SocialLogin.logout({ provider: 'google' }).catch(() => {});
    await this.clearLocal();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  async deleteAccount(): Promise<void> {
    await this.api.deleteAccount();
    await this.storage.clear();
    await this.clearLocal();
    await this.router.navigateByUrl('/welcome', { replaceUrl: true });
  }

  /** Called by the interceptor when the server rejects the token for good. */
  async forceSignOut(): Promise<void> {
    await this.clearLocal();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  throttleSecondsLeft(): number {
    return Math.max(0, Math.ceil((this.lockedUntil() - Date.now()) / 1000));
  }

  // ---------------------------------------------------------------------------

  private async loginWithProvider(provider: SocialCredential['provider']): Promise<void> {
    const nonce = createNonce();
    let credential: SocialCredential;

    if (environment.useMocks && !this.platform.isNative) {
      credential = { provider, idToken: 'mock-id-token', nonce, displayName: 'Alex Morgan' };
    } else {
      if (!this.providerAvailable(provider)) {
        throw new ApiError(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in isn’t set up for this build yet. Use email for now.`, 0, 'provider_not_configured');
      }
      await this.initSocial();
      if (provider === 'apple') {
        const res = await SocialLogin.login({ provider: 'apple', options: { scopes: ['email', 'name'], nonce } });
        const r = res.result as { idToken: string | null; authorizationCode?: string | null; profile?: { givenName?: string | null; familyName?: string | null } };
        if (!r.idToken) throw new ApiError('Apple sign-in was cancelled.', 0, 'cancelled');
        const displayName = [r.profile?.givenName, r.profile?.familyName].filter(Boolean).join(' ') || undefined;
        credential = { provider, idToken: r.idToken, nonce, displayName, authorizationCode: r.authorizationCode ?? undefined };
      } else {
        const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'], nonce } });
        const r = res.result as { idToken?: string | null; profile?: { name?: string | null } };
        if (!r.idToken) throw new ApiError('Google sign-in was cancelled.', 0, 'cancelled');
        credential = { provider, idToken: r.idToken, nonce, displayName: r.profile?.name ?? undefined };
      }
    }
    await this.accept(await this.api.loginWithSocial(credential));
  }

  /**
   * Whether this build can offer the provider. Apple on iOS needs the Sign in with Apple capability (paid Apple
   * Developer account); elsewhere both need client IDs. Demo builds always show both.
   */
  providerAvailable(provider: SocialCredential['provider']): boolean {
    if (environment.useMocks && !this.platform.isNative) return true;
    const a = environment.auth;
    if (provider === 'apple') return a.appleEnabled && !!a.appleServiceId && (this.platform.isNative || !!a.appleRedirectUrl);
    const id = this.platform.isNative && this.platform.isIos ? a.googleIosClientId : a.googleWebClientId;
    return !!id && !id.startsWith('REPLACE_ME');
  }

  private initSocial(): Promise<void> {
    this.socialReady ??= SocialLogin.initialize({
      apple: { clientId: environment.auth.appleServiceId, redirectUrl: environment.auth.appleRedirectUrl },
      google: { webClientId: environment.auth.googleWebClientId, iOSClientId: environment.auth.googleIosClientId, mode: 'online' },
    });
    return this.socialReady;
  }

  private async accept(session: Session): Promise<void> {
    await this.storeSession(session);
    this.status.set('signed-in');
  }

  private async storeSession(session: Session): Promise<void> {
    await this.storage.set(REFRESH_KEY, session.refreshToken);
    await this.storage.set(USER_KEY, JSON.stringify(session.user)).catch(() => {});
    this.session.set(session);
    this.syncLanguage(session.user);
  }

  /** Push alerts and e-mails are written on the server in the account's language: keep it in step with the app. */
  private syncLanguage(user: User): void {
    const lang = currentLang();
    if (user.lang === lang) return;
    void this.api.updateProfile({ lang }).then((u) => {
      const s = this.session();
      if (s && s.user.id === u.id) this.session.set({ ...s, user: u });
    }, () => {});
  }

  private async cachedUser(): Promise<User | null> {
    try {
      const raw = await this.storage.get(USER_KEY);
      const u = raw ? (JSON.parse(raw) as User) : null;
      return u && typeof u.id === 'string' && typeof u.name === 'string' ? u : null;
    } catch {
      return null;
    }
  }

  private async clearLocal(): Promise<void> {
    this.session.set(null);
    this.status.set('signed-out');
    await Promise.all([REFRESH_KEY, USER_KEY, TRIPS_CACHE_KEY].map((k) => this.storage.remove(k)));
  }

  private registerFailure(): void {
    this.failedAttempts++;
    const over = this.failedAttempts - environment.security.maxLoginAttemptsBeforeBackoff;
    if (over >= 0) {
      const seconds = Math.min(300, 15 * 2 ** over);
      this.lockedUntil.set(Date.now() + seconds * 1000);
    }
  }

  private assertNotThrottled(): void {
    const left = this.throttleSecondsLeft();
    if (left > 0) throw new ApiError(`Too many attempts. Try again in ${left}s.`, 429, 'throttled', left);
  }
}

/** No connection, timeout or a server error: the token may still be fine, so keep the session. */
function isTransient(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true;
  return e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500;
}
