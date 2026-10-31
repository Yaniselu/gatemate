import { Injectable, NgZone, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

type Scrollable = HTMLElement & { getScrollElement?: () => Promise<HTMLElement> };

@Injectable({ providedIn: 'root' })
export class KeyboardService {
  private zone = inject(NgZone);
  private root = document.documentElement;
  private nativeHeight = 0;
  private settle?: ReturnType<typeof setTimeout>;

  start() {
    this.zone.runOutsideAngular(() => {
      const vv = window.visualViewport;
      vv?.addEventListener('resize', () => this.measure());
      vv?.addEventListener('scroll', () => this.measure());
      document.addEventListener('focusin', (e) => {
        if (isField(e.target)) this.later(e.target as HTMLElement);
      });
      document.addEventListener('focusout', () => setTimeout(() => this.measure(), 60));
      if (Capacitor.isNativePlatform()) {
        void Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
          this.nativeHeight = keyboardHeight;
          this.root.classList.add('gm-kb-open');
        });
        void Keyboard.addListener('keyboardDidShow', ({ keyboardHeight }) => {
          this.nativeHeight = keyboardHeight;
          this.measure();
          const el = document.activeElement;
          if (isField(el)) this.reveal(el as HTMLElement);
        });
        void Keyboard.addListener('keyboardWillHide', () => {
          this.nativeHeight = 0;
          this.root.classList.remove('gm-kb-open');
          this.root.style.setProperty('--gm-kb-overlap', '0px');
        });
      }
    });
  }

  private measure() {
    const vv = window.visualViewport;
    let overlap = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    if (overlap < 60) overlap = 0;
    this.root.style.setProperty('--gm-kb-overlap', overlap + 'px');
    const open = overlap > 0 || this.nativeHeight > 0 || isField(document.activeElement);
    this.root.classList.toggle('gm-kb-open', open && (overlap > 0 || this.nativeHeight > 0));
  }

  private later(el: HTMLElement) {
    clearTimeout(this.settle);
    this.settle = setTimeout(() => {
      this.measure();
      this.reveal(el);
    }, 320);
  }

  private async reveal(el: HTMLElement) {
    if (document.activeElement !== el || el.closest('ion-footer')) return;
    const vv = window.visualViewport;
    const visibleBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
    const footer = el.closest('ion-modal, .ion-page')?.querySelector('ion-footer');
    const footerH = footer ? footer.getBoundingClientRect().height : 0;
    const limit = visibleBottom - footerH - 16;
    const r = el.getBoundingClientRect();
    const host = el.closest('ion-content') as Scrollable | null;
    if (r.bottom <= limit && r.top >= 70) return;
    const scroller = (await host?.getScrollElement?.()) ?? scrollParent(el);
    if (!scroller) return;
    const delta = r.bottom > limit ? r.bottom - limit + 12 : r.top - 90;
    scroller.scrollBy({ top: delta, behavior: 'smooth' });
  }
}

function isField(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  return t instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button', 'submit', 'color', 'file'].includes(t.type);
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p) {
    const s = getComputedStyle(p).overflowY;
    if ((s === 'auto' || s === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return null;
}
