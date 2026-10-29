import { inject, Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { environment } from '../../../environments/environment';
import { NetworkService } from './network.service';

/**
 * The API runs on a server that sleeps when nobody uses it and needs a while to start. Gatemate wakes it the moment
 * the app opens (and every time it comes back to the foreground), so it is up by the time the traveller signs in or
 * pulls fresh data, instead of starting only on their first tap.
 */
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
    // A sleeping server wakes on any request; once a minute is plenty.
    if (Date.now() - this.last < 60_000 || !this.network.online()) return;
    this.last = Date.now();
    const health = environment.apiUrl.replace(/\/api\/v1\/?$/, '') + '/actuator/health';
    // Fire and forget: the answer isn't needed, and no-cors keeps it free of CORS preflights.
    void fetch(health, { mode: 'no-cors', cache: 'no-store', keepalive: true }).catch(() => {});
  }
}
