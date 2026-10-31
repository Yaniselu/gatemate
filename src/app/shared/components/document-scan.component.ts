import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { DocumentScanService } from '../../core/services/document-scan.service';
import { findMrz, MrzDocument } from '../../core/utils/mrz';
import { PlatformService } from '../../core/services/platform.service';
import { locale, TranslatePipe } from '../../core/i18n/i18n.service';

type Step = 'intro' | 'reading' | 'manual' | 'found';

@Component({
  selector: 'gm-document-scan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, FormsModule],
  template: `
    <div class="scan card">
      @switch (step()) {
        @case ('intro') {
          <div class="doc" aria-hidden="true">
            <div class="photo"></div>
            <div class="rows"><i></i><i></i><i class="short"></i></div>
            <div class="mrz"><span>P&lt;ROUPOPESCU&lt;&lt;ANA&lt;&lt;&lt;&lt;&lt;&lt;&lt;</span><span>05123456&lt;8ROU9001014F3012…</span></div>
          </div>
          <h3>{{ 'Scan the photo page' | t }}</h3>
          <p>{{ 'Lay the passport or ID card flat in good light. The two or three lines of letters and «<<<» at the bottom must be sharp.' | t }}</p>
          @if (scan.canReadPhotos) {
            <label class="gm-btn">
              <ion-icon name="camera-outline" />{{ 'Take a photo' | t }}
              <input type="file" accept="image/*" capture="environment" (change)="picked($event)" hidden />
            </label>
            <label class="gm-btn ghost">
              <ion-icon name="image-outline" />{{ 'Choose from photos' | t }}
              <input type="file" accept="image/*" (change)="picked($event)" hidden />
            </label>
          }
          <button class="link" (click)="step.set('manual')"><ion-icon name="keypad-outline" />{{ 'Type the code lines instead' | t }}</button>
          <p class="privacy"><ion-icon name="lock-closed" />{{ 'The photo is read on this phone and never uploaded. Only the code lines are checked, and the document number is not stored.' | t }}</p>
        }
        @case ('reading') {
          <div class="busy"><span class="spin"></span>{{ 'Reading the document…' | t }}</div>
        }
        @case ('manual') {
          <h3>{{ 'Type the code lines' | t }}</h3>
          <p>{{ 'Copy the lines at the bottom of the photo page exactly, one per line. Use < for each arrow.' | t }}</p>
          <textarea [(ngModel)]="typed" rows="3" spellcheck="false" autocapitalize="characters" autocomplete="off" placeholder="P<ROUPOPESCU<<ANA<<<<<<<<<<<<<<<<<<<<<<<<<<<"></textarea>
          @if (error()) { <p class="err"><ion-icon name="alert-circle" />{{ error() | t }}</p> }
          <button class="gm-btn" (click)="checkTyped()" [disabled]="typed.trim().length < 50">{{ 'Check' | t }}</button>
          <button class="link" (click)="reset()">{{ 'Back' | t }}</button>
        }
        @case ('found') {
          @if (doc(); as d) {
            <div class="ok"><ion-icon name="checkmark-circle" />{{ 'Document read' | t }}</div>
            <dl>
              <dt>{{ 'Name' | t }}</dt><dd>{{ d.firstName }} {{ d.lastName }}</dd>
              <dt>{{ 'Issued by' | t }}</dt><dd>{{ country() }}</dd>
              <dt>{{ 'Document' | t }}</dt><dd>{{ d.type === 'P' ? ('Passport' | t) : ('ID card' | t) }} ···{{ d.number.slice(-3) }}</dd>
              <dt>{{ 'Valid until' | t }}</dt><dd [class.bad]="expired()">{{ fmt(d.expiry) }}</dd>
            </dl>
            @if (expired()) {
              <p class="err"><ion-icon name="alert-circle" />{{ 'This document has expired.' | t }}</p>
              <button class="gm-btn ghost" (click)="reset()">{{ 'Scan another document' | t }}</button>
            } @else {
              <button class="gm-btn" [disabled]="busy()" (click)="done.emit(d.lines)">{{ busy() ? ('Checking…' | t) : ('Use this name' | t) }}</button>
              <button class="link" (click)="reset()">{{ 'Scan again' | t }}</button>
            }
          }
        }
      }
      @if (step() === 'intro' && error()) { <p class="err"><ion-icon name="alert-circle" />{{ error() | t }}</p> }
      <button class="x" (click)="cancel.emit()" [attr.aria-label]="'Close' | t"><ion-icon name="close" /></button>
    </div>
  `,
  styles: `
    .scan { position: relative; padding: 20px 18px 16px; display: flex; flex-direction: column; gap: 10px; }
    h3 { margin: 4px 0 0; font-size: 18px; font-weight: 800; }
    p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--gm-ink-2); }
    .doc { position: relative; height: 128px; border-radius: 14px; padding: 12px; overflow: hidden;
      background: linear-gradient(135deg, #1e3a5f, #0f2a44); color: #cfe3f7; display: grid; grid-template-columns: 64px 1fr; gap: 10px; }
    .photo { grid-row: span 2; border-radius: 8px; background: linear-gradient(160deg, #9fb7cf, #5f7f9f); height: 72px; }
    .rows { display: flex; flex-direction: column; gap: 7px; padding-top: 4px; }
    .rows i { height: 7px; border-radius: 4px; background: rgba(207, 227, 247, .35); }
    .rows i.short { width: 60%; }
    .mrz { position: absolute; left: 10px; right: 10px; bottom: 9px; display: flex; flex-direction: column; gap: 2px; padding: 5px 7px; border-radius: 6px;
      font: 700 10px/1.25 ui-monospace, Menlo, monospace; letter-spacing: .06em; white-space: nowrap; overflow: hidden;
      background: rgba(255, 255, 255, .1); outline: 2px dashed #5fd8e3; outline-offset: 1px; animation: glow 1.8s ease-in-out infinite; }
    @keyframes glow { 50% { outline-color: rgba(95, 216, 227, .35); } }
    .gm-btn { justify-content: center; }
    .link { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; font-weight: 700; color: var(--gm-accent-strong); background: none; }
    .privacy { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; color: var(--gm-ink-3); }
    .privacy ion-icon { flex: none; margin-top: 2px; }
    textarea { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid var(--gm-card-border); background: var(--gm-surface); color: var(--gm-ink);
      font: 600 13px/1.4 ui-monospace, Menlo, monospace; letter-spacing: .04em; text-transform: uppercase; resize: none; }
    .busy { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 36px 0; font-weight: 700; color: var(--gm-ink-2); }
    .spin { width: 22px; height: 22px; border-radius: 50%; border: 3px solid var(--gm-line); border-top-color: var(--gm-accent); animation: spin .8s linear infinite; }
    @keyframes spin { to { rotate: 360deg; } }
    .ok { display: flex; align-items: center; gap: 8px; font-weight: 800; color: #16a34a; font-size: 16px; }
    .ok ion-icon { font-size: 22px; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 4px 0 6px; font-size: 14.5px; }
    dt { color: var(--gm-ink-3); font-weight: 600; }
    dd { margin: 0; font-weight: 750; text-align: right; }
    dd.bad { color: var(--gm-coral); }
    .err { display: flex; gap: 6px; align-items: flex-start; color: var(--gm-coral); font-weight: 650; }
    .err ion-icon { flex: none; margin-top: 2px; }
    .x { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
      background: var(--gm-surface); color: var(--gm-ink-2); font-size: 18px; }
  `,
})
export class DocumentScanComponent {
  protected scan = inject(DocumentScanService);
  private platform = inject(PlatformService);
  readonly busy = input(false);
  readonly done = output<string[]>();
  readonly cancel = output<void>();

  readonly step = signal<Step>('intro');
  readonly doc = signal<MrzDocument | null>(null);
  readonly error = signal('');
  typed = '';

  readonly expired = computed(() => {
    const d = this.doc();
    return !!d && new Date(d.expiry + 'T23:59:59') < new Date();
  });
  readonly country = computed(() => {
    const c = this.doc()?.country ?? '';
    const iso2 = ISO3[c];
    try {
      return iso2 ? new Intl.DisplayNames([locale()], { type: 'region' }).of(iso2) ?? c : c;
    } catch {
      return c;
    }
  });

  async picked(ev: Event) {
    const inputEl = ev.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    this.error.set('');
    this.step.set('reading');
    try {
      const d = await this.scan.read(file);
      if (!d) throw new Error('none');
      this.platform.impact();
      this.doc.set(d);
      this.step.set('found');
    } catch {
      this.step.set('intro');
      this.error.set('We couldn’t find the code lines. Try again closer, without glare, or type them instead.');
    }
  }

  checkTyped() {
    const d = findMrz(this.typed);
    if (!d) {
      this.error.set('Those lines don’t add up. Check every character, especially 0 and O.');
      return;
    }
    this.error.set('');
    this.doc.set(d);
    this.step.set('found');
  }

  reset() {
    this.doc.set(null);
    this.error.set('');
    this.step.set('intro');
  }

  fmt(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

const ISO3: Record<string, string> = {
  ROU: 'RO', MDA: 'MD', DEU: 'DE', D: 'DE', FRA: 'FR', ITA: 'IT', ESP: 'ES', GBR: 'GB', USA: 'US', AUT: 'AT', BEL: 'BE', BGR: 'BG', HRV: 'HR', CYP: 'CY',
  CZE: 'CZ', DNK: 'DK', EST: 'EE', FIN: 'FI', GRC: 'GR', HUN: 'HU', IRL: 'IE', LVA: 'LV', LTU: 'LT', LUX: 'LU', MLT: 'MT', NLD: 'NL', POL: 'PL', PRT: 'PT',
  SVK: 'SK', SVN: 'SI', SWE: 'SE', NOR: 'NO', CHE: 'CH', ISL: 'IS', UKR: 'UA', SRB: 'RS', TUR: 'TR', CAN: 'CA', AUS: 'AU', JPN: 'JP', CHN: 'CN', IND: 'IN',
  BRA: 'BR', MEX: 'MX', ARE: 'AE', ISR: 'IL', ALB: 'AL', MKD: 'MK', MNE: 'ME', BIH: 'BA', GEO: 'GE', ARM: 'AM', RUS: 'RU', BLR: 'BY', UTO: '',
};
