import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { environment } from '../../../environments/environment';
import { ProfilePatch, Session, User } from '../models';
import { createNonce } from '../security/crypto.util';
import { SecureStorageService } from '../security/secure-storage.service';
import { ApiError, GatemateApi, SocialCredential } from './api';
import { PlatformService } from './platform.service';

const REFRESH_KEY = 'refresh_token';
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

  /** Restore a session from the refresh token in the Keychain/Keystore. */
  async init(): Promise<void> {
    const refreshToken = await this.storage.get(REFRESH_KEY);
    if (!refreshToken) {
      this.status.set('signed-out');
      return;
    }
    const restored = await this.refresh();
    this.status.set(restored ? 'signed-in' : 'signed-out');
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
    this.session.update((s) => (s ? { ...s, user } : s));
    return user;
  }

  requestPasswordReset(email: string): Promise<void> {
    return this.api.requestPasswordReset(email.trim().toLowerCase());
  }

  /** Returns a valid access token, refreshing it shortly before expiry. */
  async getAccessToken(): Promise<string | null> {
    const s = this.session();
    if (!s) return null;
    if (s.expiresAt - Date.now() > REFRESH_SKEW_MS) return s.accessToken;
    return (await this.refresh())?.accessToken ?? null;
  }

  /** Single-flight refresh: concurrent 401s share one refresh call. Tokens rotate on every refresh. */
  refresh(): Promise<Session | null> {
    this.refreshing ??= (async () => {
      try {
        const token = await this.storage.get(REFRESH_KEY);
        if (!token) return null;
        const next = await this.api.refresh(token);
        await this.storeSession(next);
        return next;
      } catch {
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
      const configured = provider === 'apple'
        ? !!environment.auth.appleServiceId && (this.platform.isNative || !!environment.auth.appleRedirectUrl)
        : !!environment.auth.googleWebClientId && !environment.auth.googleWebClientId.startsWith('REPLACE_ME');
      if (!configured) {
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
    this.session.set(session);
  }

  private async clearLocal(): Promise<void> {
    this.session.set(null);
    this.status.set('signed-out');
    await this.storage.remove(REFRESH_KEY);
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
