import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Network } from '@capacitor/network';

/** Whether the phone has a connection. Drives the offline banner and re-syncs data when it comes back. */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private zone = inject(NgZone);
  readonly online = signal(true);

  constructor() {
    void Network.getStatus()
      .then((s) => this.online.set(s.connected))
      .catch(() => {});
    void Network.addListener('networkStatusChange', (s) => this.zone.run(() => this.online.set(s.connected))).catch(() => {});
  }
}
