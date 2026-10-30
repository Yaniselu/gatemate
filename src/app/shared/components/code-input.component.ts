import { ChangeDetectionStrategy, Component, ElementRef, input, model, output, viewChild } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n.service';

/**
 * Six-digit code entry: one real input (so iOS can fill the code from Mail/Messages and paste works),
 * drawn as six boxes with the caret in the next empty one.
 */
@Component({
  selector: 'gm-code-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <label class="boxes" [class.error]="error()" (click)="focus()">
      @for (i of slots; track i) {
        <span class="box" [class.filled]="value().length > i" [class.caret]="value().length === i">{{ value().at(i) ?? '' }}</span>
      }
      <input #field type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" [aria-label]="'6-digit code' | t"
        [value]="value()" (input)="onInput($event)" (keydown.enter)="complete.emit(value())" />
    </label>
  `,
  styles: `
    .boxes { position: relative; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; cursor: text; }
    .box { height: 58px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800;
      color: var(--gm-ink); background: var(--gm-surface); border: 1.5px solid var(--gm-card-border); transition: border-color .2s, transform .25s var(--gm-ease-spring), background .2s; }
    .box.filled { background: var(--gm-card-bg); border-color: rgba(var(--gm-accent-rgb), .5); animation: gm-pop .3s var(--gm-ease-spring); }
    .box.caret { border-color: var(--gm-accent); box-shadow: 0 0 0 4px rgba(var(--gm-accent-rgb), .12); }
    .error .box { border-color: #e5484d; animation: code-shake .4s; }
    input { position: absolute; inset: 0; opacity: 0; font-size: 16px; color: transparent; caret-color: transparent; }
    @keyframes code-shake { 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }
  `,
})
export class CodeInputComponent {
  readonly value = model('');
  readonly error = input(false);
  readonly complete = output<string>();
  readonly slots = [0, 1, 2, 3, 4, 5];
  private field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  onInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== el.value) el.value = digits;
    this.value.set(digits);
    if (digits.length === 6) this.complete.emit(digits);
  }

  focus() {
    this.field().nativeElement.focus();
  }
}
