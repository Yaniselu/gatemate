import { inject, Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { InAppReview } from '@capacitor-community/in-app-review';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { t } from '../i18n/i18n.service';
import { PlatformService } from './platform.service';

const KEY = 'gm_review';
const MIN_SESSIONS = 3;
const MIN_POSITIVE = 2;
const COOLDOWN_DAYS = 120;
const STORE_URL = {
  ios: '',
  android: 'https://play.google.com/store/apps/details?id=com.velosyntech.gatemate&showAllReviews=true',
};

interface State {
  sessions: number;
  positive: number;
  lastAsked: number;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private platform = inject(PlatformService);
  private alerts = inject(AlertController);
  private router = inject(Router);
  private state: State = { sessions: 0, positive: 0, lastAsked: 0 };
  private ready: Promise<void> | null = null;

  init(): Promise<void> {
    this.ready ??= (async () => {
      try {
        const v = (await Preferences.get({ key: KEY })).value;
        if (v) this.state = { ...this.state, ...JSON.parse(v) };
      } catch {
      }
      this.state.sessions++;
      await this.save();
    })();
    return this.ready;
  }

  async positiveMoment(delayMs = 1500): Promise<void> {
    await this.init();
    this.state.positive++;
    await this.save();
    const days = (Date.now() - this.state.lastAsked) / 86_400_000;
    if (this.state.sessions < MIN_SESSIONS || this.state.positive < MIN_POSITIVE || days < COOLDOWN_DAYS) return;
    if (!this.platform.isNative) return;
    this.state.lastAsked = Date.now();
    await this.save();
    setTimeout(() => void this.ask(), delayMs);
  }

  private async ask(): Promise<void> {
    const alert = await this.alerts.create({
      header: t('Your opinion counts'),
      message: t('Leave a review in the store, or tell us directly what we should improve. Both help us a lot.'),
      cssClass: 'gm-review-alert',
      buttons: [
        { text: t('Leave a review'), handler: () => void InAppReview.requestReview().catch(() => this.openStorePage()) },
        { text: t('Send a suggestion'), handler: () => void this.router.navigateByUrl('/feedback') },
        { text: t('Not now'), role: 'cancel' },
      ],
    });
    await alert.present();
  }

  openStorePage(): void {
    const url = this.platform.platform === 'android' ? STORE_URL.android : STORE_URL.ios;
    if (url) window.open(url, '_blank', 'noopener');
  }

  private async save() {
    await Preferences.set({ key: KEY, value: JSON.stringify(this.state) }).catch(() => {});
  }
}
