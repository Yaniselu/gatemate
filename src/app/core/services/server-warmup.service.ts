import { inject, Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { environment } from '../../../environments/environment';
import { NetworkService } from './network.service';

@Injectable({ providedIn: 'root' })
export class ServerWarmupService {
  private network = inject(NetworkService);
  private last = 0;

  start(): void {
    if (environment.useMocks) return;
    this.ping();
    void App.addListener('appStateChange', ({ isActive }) => isActive && this.ping()).catch(() => {});
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.ping());
  }

  private ping(): void {
    if (Date.now() - this.last < 60_000 || !this.network.online()) return;
    this.last = Date.now();
    const health = environment.apiUrl.replace(/\/api\/v1\/?$/, '') + '/actuator/health';
    void fetch(health, { mode: 'no-cors', cache: 'no-store', keepalive: true }).catch(() => {});
  }
}
