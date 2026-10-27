import { Directive, HostListener, inject } from '@angular/core';
import { PlatformService } from '../../core/services/platform.service';

/** Springy press-down scale with a light haptic tick. */
@Directive({
  selector: '[gmPressable]',
  host: { class: 'gm-pressable', '[class.is-pressed]': 'pressed' },
})
export class PressableDirective {
  private platform = inject(PlatformService);
  pressed = false;

  @HostListener('pointerdown')
  down() {
    this.pressed = true;
    this.platform.tap();
  }

  @HostListener('pointerup')
  @HostListener('pointerleave')
  @HostListener('pointercancel')
  up() {
    this.pressed = false;
  }
}
