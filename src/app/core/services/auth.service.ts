import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { environment } from '../../../environments/environment';
import { ProfilePatch, Session, User } from '../models';
import { createNonce } from '../security/crypto.util';
import { SecureStorageService } from '../security/secure-storage.service';
import { ApiError, GatemateApi, RegisterExtra, SocialCredential } from './api';
import { PlatformService } from './platform.service';
import { currentLang } from '../i18n/i18n.service';

const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'session_user';
export const TRIPS_CACHE_KEY = 'trips_cache';
const REFRESH_SKEW_MS = 30_000;

export type AuthStatus = 'unknown' | 'signed-out' | 'signed-in';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(GatemateApi);
  private storage = inject(SecureStorageService);
  private platform = inject(PlatformService);
  private router = inject(Router);

  private session = signal<Session | null>(null);
  private refreshing: Promise<Session | null> | null = null;
  private socialReady: Promise<void> | null = null;

  readonly status = signal<AuthStatus>('unknown');
  readonly user = computed<User | null>(() => this.session()?.user ?? null);
  readonly firstName = computed(() => (this.user()?.name ?? '').split(' ')[0] || 'traveller');

  private failedAttempts = 0;
  readonly lockedUntil = signal(0);

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

  async register(name: string, email: string, password: string, extra?: RegisterExtra): Promise<void> {
    await this.accept(await this.api.register(name.trim(), email.trim().toLowerCase(), password, extra));
  }

  async loginWithApple(): Promise<void> {
    await this.loginWithProvider('apple');
  }

  async loginWithGoogle(): Promise<void> {
    await this.loginWithProvider('google');
  }

  async updateProfile(patch: ProfilePatch): Promise<User> {
    const user = await this.api.updateProfile(patch);
    this.setUser(user);
    return user;
  }

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

  async getAccessToken(): Promise<string | null> {
    const s = this.session();
    if (!s) return null;
    if (s.expiresAt - Date.now() > REFRESH_SKEW_MS) return s.accessToken;
    return (await this.refresh())?.accessToken ?? null;
  }

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

  async forceSignOut(): Promise<void> {
    await this.clearLocal();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  throttleSecondsLeft(): number {
    return Math.max(0, Math.ceil((this.lockedUntil() - Date.now()) / 1000));
  }

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

  providerAvailable(provider: SocialCredential['provider']): boolean {
    if (environment.useMocks && !this.platform.isNative) return true;
    const a = environment.auth;
    if (provider === 'apple') return a.appleEnabled && !!a.appleServiceId && (this.platform.isNative ? this.platform.isIos : !!a.appleRedirectUrl);
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

function isTransient(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true;
  return e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500;
}
