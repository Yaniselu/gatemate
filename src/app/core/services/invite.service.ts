import { inject, Injectable } from '@angular/core';
import { Share } from '@capacitor/share';
import { GatemateApi } from './api';
import { PlatformService } from './platform.service';
import { ToastService } from './toast.service';

/**
 * Trip/group invitations. Links are single-use, expire after 7 days and only add someone after
 * they sign in — so a forwarded link can't be used to read the chat anonymously.
 */
@Injectable({ providedIn: 'root' })
export class InviteService {
  private api = inject(GatemateApi);
  private platform = inject(PlatformService);
  private toast = inject(ToastService);

  link(targetId: string): Promise<string> {
    return this.api.createInvite(targetId);
  }

  message(title: string, url: string): string {
    return `✈️ Join "${title}" on Gatemate — we'll plan the trip and get gate alerts together:\n${url}`;
  }

  /** Opens WhatsApp with the invite pre-filled; the user picks contacts or groups there. */
  whatsapp(title: string, url: string): void {
    this.platform.tap();
    const wa = `https://wa.me/?text=${encodeURIComponent(this.message(title, url))}`;
    window.open(wa, '_blank', 'noopener');
  }

  async share(title: string, url: string): Promise<void> {
    const text = this.message(title, url);
    try {
      if (this.platform.isNative) await Share.share({ title: 'Gatemate invite', text, url, dialogTitle: 'Invite friends' });
      else if (navigator.share) await navigator.share({ title: 'Gatemate invite', text });
      else await this.copy(url);
    } catch {
      /* share sheet dismissed */
    }
  }

  async copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      await this.toast.show('Invite link copied', 'success');
    } catch {
      await this.toast.show(url);
    }
  }
}
