import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NavController } from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { GatemateApi } from './api';
import { MockApi } from './mock-api';
import { t as tr } from '../i18n/i18n.service';

/** What a Pro plan looks like on the paywall. Prices always come from the store, already localized. */
export interface ProPlan {
  id: 'monthly' | 'annual';
  title: string;
  price: string;
  perMonth?: string;
  trial?: string;
  /** Store package (RevenueCat) — absent in demo builds. */
  pkg?: unknown;
}

export type ProReason = 'trips' | 'explore' | 'expenses' | 'profile';
const ENTITLEMENT = 'pro';

/**
 * Gatemate Pro. Purchases go through the App Store / Google Play (RevenueCat SDK); the server is told by the store,
 * not by the app, so `isPro` follows the server's answer. The local store state only fills the gap until it arrives.
 */
@Injectable({ providedIn: 'root' })
export class ProService {
  private auth = inject(AuthService);
  private api = inject(GatemateApi);
  private nav = inject(NavController);

  private storeActive = signal(false);
  readonly plans = signal<ProPlan[]>([]);
  readonly state = signal<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  readonly busy = signal(false);
  private managementUrl: string | null = null;
  private configuredFor: string | null = null;

  readonly isPro = computed(() => !!this.auth.user()?.pro || this.storeActive());
  readonly demo = environment.useMocks;

  private get apiKey(): string {
    const p = Capacitor.getPlatform();
    return p === 'ios' ? environment.purchases.iosApiKey : p === 'android' ? environment.purchases.androidApiKey : '';
  }

  constructor() {
    // Tie the store account to our user id, so the server can match store events to this account.
    effect(() => {
      const id = this.auth.user()?.id;
      if (id && id !== this.configuredFor) void this.configure(id);
      if (!id) this.storeActive.set(false);
    });
  }

  private async configure(userId: string) {
    if (!Capacitor.isNativePlatform() || !this.apiKey) return;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { isConfigured } = await Purchases.isConfigured();
      if (isConfigured) await Purchases.logIn({ appUserID: userId });
      else await Purchases.configure({ apiKey: this.apiKey, appUserID: userId });
      this.configuredFor = userId;
      await Purchases.addCustomerInfoUpdateListener((info) => this.applyInfo(info));
      this.applyInfo((await Purchases.getCustomerInfo()).customerInfo);
    } catch {
      /* store not reachable: stays free until next launch */
    }
  }

  private applyInfo(info: { entitlements: { active: Record<string, unknown> }; managementURL: string | null }) {
    const active = !!info.entitlements.active[ENTITLEMENT];
    this.managementUrl = info.managementURL;
    if (active && !this.auth.user()?.pro) void this.syncWithServer();
    this.storeActive.set(active);
  }

  async loadPlans(): Promise<void> {
    if (this.state() === 'ready' || this.state() === 'loading') return;
    if (this.demo) {
      this.plans.set([
        { id: 'annual', title: 'Yearly', price: tr('{price} / year', { price: '€19.99' }), perMonth: tr('{price} / month', { price: '€1.67' }), trial: tr('{n}-day free trial', { n: 7 }) },
        { id: 'monthly', title: 'Monthly', price: tr('{price} / month', { price: '€2.99' }), trial: tr('{n}-day free trial', { n: 7 }) },
      ]);
      this.state.set('ready');
      return;
    }
    if (!Capacitor.isNativePlatform() || !this.apiKey) {
      this.state.set('unavailable');
      return;
    }
    this.state.set('loading');
    try {
      const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();
      const pkgs = offerings.current?.availablePackages ?? [];
      const plans: ProPlan[] = [];
      for (const p of pkgs) {
        const annual = p.packageType === PACKAGE_TYPE.ANNUAL;
        if (!annual && p.packageType !== PACKAGE_TYPE.MONTHLY) continue;
        const intro = p.product.introPrice;
        plans.push({
          id: annual ? 'annual' : 'monthly',
          title: annual ? 'Yearly' : 'Monthly',
          price: tr(annual ? '{price} / year' : '{price} / month', { price: p.product.priceString }),
          perMonth: annual && p.product.pricePerMonthString ? tr('{price} / month', { price: p.product.pricePerMonthString }) : undefined,
          trial: intro && intro.price === 0 ? trialLabel(intro.periodNumberOfUnits, intro.periodUnit) : undefined,
          pkg: p,
        });
      }
      plans.sort((a) => (a.id === 'annual' ? -1 : 1));
      this.plans.set(plans);
      this.state.set(plans.length ? 'ready' : 'unavailable');
    } catch {
      this.state.set('unavailable');
    }
  }

  /** Returns true when the user is Pro afterwards; false if they cancelled. Throws on store errors. */
  async purchase(plan: ProPlan): Promise<boolean> {
    this.busy.set(true);
    try {
      if (this.demo) {
        this.auth.setUser(await (this.api as MockApi).demoGrantPro());
        return true;
      }
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      try {
        const res = await Purchases.purchasePackage({ aPackage: plan.pkg as never });
        this.applyInfo(res.customerInfo);
      } catch (e) {
        if ((e as { userCancelled?: boolean })?.userCancelled) return false;
        throw e;
      }
      await this.syncWithServer();
      return this.isPro();
    } finally {
      this.busy.set(false);
    }
  }

  async restore(): Promise<boolean> {
    this.busy.set(true);
    try {
      if (this.demo) return this.isPro();
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.restorePurchases();
      this.applyInfo(customerInfo);
      await this.syncWithServer();
      return this.isPro();
    } finally {
      this.busy.set(false);
    }
  }

  /** Subscriptions are managed in the store (Apple ID / Google Play settings). */
  manage() {
    const url = this.managementUrl ?? (Capacitor.getPlatform() === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions');
    window.open(url, '_system');
  }

  open(reason: ProReason) {
    void this.nav.navigateForward('/pro', { queryParams: { reason } });
  }

  private async syncWithServer() {
    try {
      this.auth.setUser(await this.api.syncPro());
    } catch {
      /* the webhook will update the account shortly */
    }
  }
}

/** "7-day free trial", "1-month free trial"… in the app's language. */
function trialLabel(n: number, unit: string): string {
  const u = unit.toLowerCase();
  if (u.startsWith('week')) return tr('{n}-week free trial', { n });
  if (u.startsWith('month')) return tr('{n}-month free trial', { n });
  if (u.startsWith('year')) return tr('{n}-year free trial', { n });
  return tr('{n}-day free trial', { n });
}
