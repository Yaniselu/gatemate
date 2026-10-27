import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToggle, IonToolbar } from '@ionic/angular/standalone';
import { PrefsService } from '../../core/services/prefs.service';
import { PlatformService } from '../../core/services/platform.service';

@Component({
  selector: 'gm-accessibility',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon, IonToggle],
  template: `
    <ion-header class="gm-glass-header" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/profile" text="" icon="chevron-back" /></ion-buttons>
        <ion-title>Accessibility</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="page">
        <span class="gm-label">Text size</span>
        <div class="sizes card">
          @for (s of sizes; track s.v) {
            <button [class.on]="prefs.textScale() === s.v" (click)="set({ textScale: s.v })" [attr.aria-pressed]="prefs.textScale() === s.v">
              <span [style.font-size.px]="15 * s.v">Aa</span><small>{{ s.label }}</small>
            </button>
          }
        </div>
        <p class="preview card">Boarding for flight W6 3121 to Rome starts at gate B12 in 15 minutes.</p>

        <span class="gm-label">Display</span>
        <div class="group card">
          <div class="row">
            <span class="gm-well accent"><ion-icon name="contrast-outline" /></span>
            <div class="grow"><b>High contrast</b><small>Darker text, stronger borders, solid backgrounds</small></div>
            <ion-toggle [checked]="prefs.highContrast()" (ionChange)="set({ highContrast: $event.detail.checked })" aria-label="High contrast" />
          </div>
          <div class="row">
            <span class="gm-well accent"><ion-icon name="pause-outline" /></span>
            <div class="grow"><b>Reduce motion</b><small>Turns off animations and parallax</small></div>
            <ion-toggle [checked]="prefs.reduceMotion()" (ionChange)="set({ reduceMotion: $event.detail.checked })" aria-label="Reduce motion" />
          </div>
        </div>
        <p class="note">Gatemate also follows your phone’s Reduce Motion, VoiceOver/TalkBack and Bold Text settings.</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page { padding: 12px 16px 40px; max-width: 560px; margin: 0 auto; }
    .gm-label { margin: 16px 4px 8px; }
    .sizes { display: grid; grid-template-columns: repeat(3, 1fr); padding: 6px; gap: 6px; }
    .sizes button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 4px; border-radius: 12px; background: none; color: var(--gm-ink); transition: all .3s var(--gm-ease-spring); }
    .sizes button span { font-weight: 800; }
    .sizes button small { font-size: 12px; color: var(--gm-ink-3); }
    .sizes button.on { background: var(--gm-accent-soft); transform: scale(1.03); }
    .preview { padding: 14px; margin: 10px 0 0; line-height: 1.5; color: var(--gm-ink-2); }
    .group { padding: 0 14px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--gm-line); }
    .row:last-child { border-bottom: 0; }
    .grow { flex: 1; }
    .grow b { display: block; font-size: 15px; }
    .grow small { color: var(--gm-ink-3); font-size: 12.5px; }
    ion-toggle { --track-background-checked: var(--gm-accent); }
    .note { font-size: 12.5px; color: var(--gm-ink-3); margin: 14px 4px; line-height: 1.45; }
  `,
})
export class AccessibilityPage {
  protected prefs = inject(PrefsService);
  private platform = inject(PlatformService);
  readonly sizes = [{ v: 1, label: 'Default' }, { v: 1.15, label: 'Large' }, { v: 1.3, label: 'Extra large' }];

  set(p: { textScale?: number; reduceMotion?: boolean; highContrast?: boolean }) {
    this.platform.selection();
    void this.prefs.setAccessibility(p);
  }
}
