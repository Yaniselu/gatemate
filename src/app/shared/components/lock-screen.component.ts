import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { AppLockService } from '../../core/security/app-lock.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'gm-lock-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    <div class="wrap" role="dialog" aria-modal="true" aria-label="Gatemate is locked">
      <div class="icon" [class.fail]="failed()">
        <ion-icon name="lock-closed" />
      </div>
      <h2>Gatemate is locked</h2>
      <p>Your boarding passes and chats are protected.</p>
      <button class="gm-btn" (click)="unlock()">
        <ion-icon name="finger-print-outline" /> Unlock with {{ lock.biometryLabel() }}
      </button>
      <button class="link" (click)="auth.logout(); lock.locked.set(false)">Sign out instead</button>
    </div>
  `,
  styles: `
    :host {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(255, 255, 255, 0.72);
      -webkit-backdrop-filter: blur(30px) saturate(180%);
      backdrop-filter: blur(30px) saturate(180%);
      display: flex; align-items: center; justify-content: center;
      animation: gm-fade-in .3s var(--gm-ease-out);
    }
    .wrap { text-align: center; padding: 32px; width: 100%; max-width: 360px; animation: gm-fade-up .5s var(--gm-ease-out); }
    .icon {
      width: 88px; height: 88px; margin: 0 auto 20px; border-radius: 30px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 40px;
      background: linear-gradient(135deg, #22c7d3, #0a93a6);
      box-shadow: 0 16px 34px var(--gm-accent-glow);
      animation: gm-float 3s ease-in-out infinite;
    }
    .icon.fail { animation: gm-shake .4s; }
    h2 { margin: 0 0 6px; font-size: 24px; font-weight: 800; }
    p { margin: 0 0 28px; color: var(--gm-ink-3); }
    .link { margin-top: 16px; background: none; color: var(--gm-ink-3); font-weight: 600; }
  `,
})
export class LockScreenComponent implements OnInit {
  protected lock = inject(AppLockService);
  protected auth = inject(AuthService);
  protected failed = signal(false);

  ngOnInit(): void {
    setTimeout(() => this.unlock(), 400);
  }

  async unlock() {
    this.failed.set(false);
    const ok = await this.lock.unlock();
    if (!ok) this.failed.set(true);
  }
}
