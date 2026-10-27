import { inject, Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { PlatformService } from './platform.service';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private ctrl = inject(ToastController);
  private platform = inject(PlatformService);

  async show(message: string, kind: 'info' | 'success' | 'error' = 'info', icon?: string): Promise<void> {
    if (kind === 'success') this.platform.success();
    if (kind === 'error') this.platform.error();
    await this.ctrl.dismiss().catch(() => {});
    const toast = await this.ctrl.create({
      message,
      duration: 2600,
      position: 'top',
      cssClass: 'gm-toast',
      icon: icon ?? (kind === 'success' ? 'checkmark-circle' : kind === 'error' ? 'alert-circle' : 'information-circle'),
      swipeGesture: 'vertical',
    });
    await toast.present();
  }
}
