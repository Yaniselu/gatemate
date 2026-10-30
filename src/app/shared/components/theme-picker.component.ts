import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { PrefsService } from '../../core/services/prefs.service';
import { TranslatePipe } from '../../core/i18n/i18n.service';

type Theme = 'system' | 'light' | 'dark';

/** Three tappable previews: like the phone, light, dark. */
@Component({
  selector: 'gm-theme-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslatePipe],
  template: `
    <div class="opts" role="radiogroup" [attr.aria-label]="'Appearance' | t">
      @for (o of options; track o.id) {
        <button role="radio" [class.on]="prefs.theme() === o.id" [attr.aria-checked]="prefs.theme() === o.id" (click)="pick(o.id)">
          <span class="pv" [attr.data-t]="o.id">
            <i class="bar"></i><i class="l1"></i><i class="l2"></i><i class="tab"></i>
          </span>
          <span class="lab"><ion-icon [name]="o.icon" />{{ o.label | t }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    button { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 6px 10px; border-radius: 18px; background: var(--gm-surface);
      border: 2px solid transparent; color: var(--gm-ink); transition: transform .3s var(--gm-ease-spring), border-color .2s; }
    button.on { border-color: var(--gm-accent); transform: scale(1.03); }
    .pv { position: relative; width: 100%; aspect-ratio: 3 / 4; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
    .pv[data-t='dark'] { background: #070b16; }
    .pv[data-t='system'] { background: linear-gradient(135deg, #ffffff 50%, #070b16 50%); }
    .pv i { position: absolute; left: 12%; right: 12%; border-radius: 6px; }
    .bar { top: 10%; height: 14%; background: linear-gradient(135deg, #0fb5c3, #6366f1); }
    .l1 { top: 32%; height: 10%; background: rgba(120,135,160,.35); }
    .l2 { top: 48%; height: 10%; right: 35% !important; background: rgba(120,135,160,.25); }
    .tab { bottom: 7%; height: 12%; background: rgba(120,135,160,.3); }
    .lab { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; }
    .lab ion-icon { font-size: 15px; color: var(--gm-accent); }
  `,
})
export class ThemePickerComponent {
  protected prefs = inject(PrefsService);
  readonly options: { id: Theme; label: string; icon: string }[] = [
    { id: 'system', label: 'Like my phone', icon: 'phone-portrait-outline' },
    { id: 'light', label: 'Light', icon: 'sunny-outline' },
    { id: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];

  pick(t: Theme) {
    void this.prefs.setTheme(t);
  }
}
