import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { GatemateApi } from '../../core/services/api';
import { ToastService } from '../../core/services/toast.service';
import { DocumentScanComponent } from '../../shared/components/document-scan.component';
import { locale, TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-identity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, DocumentScanComponent],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/profile" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>{{ 'Identity' | t }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        @if (auth.user(); as u) {
          <section class="status card" [class.ok]="u.identityVerified">
            <span class="seal"><ion-icon [name]="u.identityVerified ? 'shield-checkmark' : 'shield-checkmark-outline'" /></span>
            <div>
              <b>{{ u.identityVerified ? ('Identity verified' | t) : ('Not verified yet' | t) }}</b>
              <small>{{ (u.legalFirstName || '') + ' ' + (u.legalLastName || '') }}</small>
              @if (u.identityVerified && u.identityExpiry) { <small>{{ 'Document valid until {date}' | t: { date: fmt(u.identityExpiry) } }}</small> }
            </div>
          </section>

          @if (scanning()) {
            <gm-document-scan [busy]="busy()" (done)="verify($event)" (cancel)="scanning.set(false)" />
          } @else {
            <section class="why card">
              <h3>{{ 'Why verify?' | t }}</h3>
              <ul>
                <li><ion-icon name="airplane-outline" />{{ 'Tickets are added to your account only when the name on them matches yours.' | t }}</li>
                <li><ion-icon name="lock-closed-outline" />{{ 'Nobody can change your name to take over someone else’s ticket: a new name needs a passport scan.' | t }}</li>
                <li><ion-icon name="eye-off-outline" />{{ 'The photo stays on your phone. We keep your name, the issuing country and the expiry date, not the document number.' | t }}</li>
              </ul>
              <p class="opt">{{ 'Optional: everything else in Gatemate works without it.' | t }}</p>
            </section>
            <button class="gm-btn" (click)="scanning.set(true)"><ion-icon name="id-card-outline" />{{ u.identityVerified ? ('Scan a new document' | t) : ('Scan passport or ID card' | t) }}</button>
            <a class="gm-btn ghost" routerLink="/family"><ion-icon name="people-outline" />{{ 'Family members' | t }}</a>
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 12px 16px 40px; display: flex; flex-direction: column; gap: 14px; }
    .status { display: flex; align-items: center; gap: 14px; padding: 16px; }
    .status div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .status b { font-size: 17px; font-weight: 800; }
    .status small { color: var(--gm-ink-3); font-size: 13.5px; }
    .seal { width: 48px; height: 48px; flex: none; border-radius: 15px; display: grid; place-items: center; font-size: 26px;
      color: var(--gm-ink-3); background: var(--gm-surface); }
    .status.ok .seal { color: #fff; background: linear-gradient(135deg, #16a34a, #0d9488); box-shadow: 0 10px 22px rgba(22, 163, 74, .3); }
    .why { padding: 16px; }
    .why h3 { margin: 0 0 10px; font-size: 16px; font-weight: 800; }
    .why ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .why li { display: flex; gap: 10px; font-size: 14px; line-height: 1.4; color: var(--gm-ink-2); }
    .why li ion-icon { flex: none; font-size: 18px; color: var(--gm-accent-strong); margin-top: 1px; }
    .opt { margin: 12px 0 0; font-size: 13px; color: var(--gm-ink-3); }
    .gm-btn { justify-content: center; text-decoration: none; }
  `,
})
export class IdentityPage {
  protected auth = inject(AuthService);
  private api = inject(GatemateApi);
  private toast = inject(ToastService);
  readonly scanning = signal(false);
  readonly busy = signal(false);

  async verify(lines: string[]) {
    this.busy.set(true);
    try {
      this.auth.setUser(await this.api.verifyIdentity(lines));
      this.scanning.set(false);
      void this.toast.show('Identity verified. Your tickets now match this name.', 'success');
    } catch (e) {
      void this.toast.show(e instanceof Error ? e.message : 'Could not verify this document.', 'error');
    } finally {
      this.busy.set(false);
    }
  }

  fmt(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
