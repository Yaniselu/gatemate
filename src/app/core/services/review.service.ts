import { inject, Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { InAppReview } from '@capacitor-community/in-app-review';
import { PlatformService } from './platform.service';

const KEY = 'gm_review';
const MIN_SESSIONS = 3;
const MIN_POSITIVE = 2;
const COOLDOWN_DAYS = 120;
const STORE_URL = {
  ios: 'https://apps.apple.com/app/id0000000000?action=write-review',
  android: 'https://play.google.com/store/apps/details?id=app.gatemate&showAllReviews=true',
};

interface State {
  sessions: number;
  positive: number;
  lastAsked: number;
}

/**
 * Store-compliant review prompts:
 * - Apple 5.6.1 and Google Play's in-app review policy forbid custom rating dialogs and
 *   "Do you like the app?" gating questions before the review prompt.
 * - So we call the native API (SKStoreReviewController / Play In-App Review) directly, only after
 *   positive moments (e.g. a ticket verified, a trip completed), never mid-task, with a long cooldown.
 *   The OS decides whether to show it (Apple caps it at 3 times per year).
 * - Feedback is a separate, always-available screen and never leads to a store review.
 */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private platform = inject(PlatformService);
  private state: State = { sessions: 0, positive: 0, lastAsked: 0 };
  private ready: Promise<void> | null = null;

  init(): Promise<void> {
    this.ready ??= (async () => {
      try {
        const v = (await Preferences.get({ key: KEY })).value;
        if (v) this.state = { ...this.state, ...JSON.parse(v) };
      } catch {
        /* ignore */
      }
      this.state.sessions++;
      await this.save();
    })();
    return this.ready;
  }

  /** Call after something went well for the user. May show the native review sheet. */
  async positiveMoment(delayMs = 1500): Promise<void> {
    await this.init();
    this.state.positive++;
    await this.save();
    const days = (Date.now() - this.state.lastAsked) / 86_400_000;
    if (this.state.sessions < MIN_SESSIONS || this.state.positive < MIN_POSITIVE || days < COOLDOWN_DAYS) return;
    if (!this.platform.isNative) return;
    setTimeout(async () => {
      try {
        await InAppReview.requestReview();
        this.state.lastAsked = Date.now();
        await this.save();
      } catch {
        /* not available */
      }
    }, delayMs);
  }

  /** User explicitly tapped "Rate Gatemate": open the store's review page (always allowed). */
  openStorePage(): void {
    const url = this.platform.platform === 'android' ? STORE_URL.android : STORE_URL.ios;
    window.open(url, '_blank', 'noopener');
  }

  private async save() {
    await Preferences.set({ key: KEY, value: JSON.stringify(this.state) }).catch(() => {});
  }
}
