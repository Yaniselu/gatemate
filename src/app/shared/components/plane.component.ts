import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n.service';

/** Hand-drawn side-view airliner (nose to the right). Pure SVG, scales to any size. */
@Component({
  selector: 'gm-plane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg" role="img" [aria-label]="'Airplane' | t">
      <defs>
        <linearGradient id="gm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.65" stop-color="#f1f6f9" />
          <stop offset="1" stop-color="#cfdde6" />
        </linearGradient>
        <linearGradient id="gm-tail" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0b1b2b" />
          <stop offset="1" stop-color="#1d3a52" />
        </linearGradient>
        <linearGradient id="gm-wing" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#dfe9ef" />
          <stop offset="1" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      <!-- far wing -->
      <path d="M118 44 L92 18 L106 18 L150 44 Z" fill="#c2d3de" />
      <!-- tail fin -->
      <path d="M30 44 L16 8 L34 8 L64 42 Z" fill="url(#gm-tail)" />
      <path d="M24 16 L33 16 L40 26 L28 26 Z" fill="#0fb5c3" />
      <!-- horizontal stabiliser -->
      <path d="M28 54 L6 64 L20 67 L54 58 Z" fill="#c9d8e2" />
      <!-- fuselage -->
      <path d="M20 52 C20 44 40 40 70 40 L188 40 C212 40 228 46 236 52 C228 58 212 63 188 63 L42 63 C28 63 20 59 20 52 Z" fill="url(#gm-body)" />
      <path d="M40 57 L200 57" stroke="#0fb5c3" stroke-width="3" stroke-linecap="round" />
      <path d="M60 60 L188 60" stroke="#0b1b2b" stroke-opacity=".08" stroke-width="2" />
      <!-- windows -->
      <g fill="#1d3a52" fill-opacity=".85">
        @for (x of windows; track x) {
          <rect [attr.x]="x" y="46" width="4.2" height="5.2" rx="2" />
        }
      </g>
      <!-- cockpit -->
      <path d="M212 46 L224 46 C228 48 230 50 231 51 L214 51 Z" fill="#1d3a52" />
      <!-- door -->
      <rect x="196" y="44" width="6" height="12" rx="2" fill="none" stroke="#9fb3c2" stroke-width="1" />
      <!-- near wing -->
      <path d="M112 58 L76 94 L98 94 L156 58 Z" fill="url(#gm-wing)" stroke="#c9d8e2" stroke-width="1" />
      <!-- engine -->
      <rect x="96" y="66" width="34" height="13" rx="6.5" fill="#e8f0f5" stroke="#b9cbd7" stroke-width="1" />
      <ellipse cx="129" cy="72.5" rx="3" ry="6" fill="#0b1b2b" fill-opacity=".75" />
    </svg>
  `,
  styles: `:host { display: block; } svg { width: 100%; height: auto; overflow: visible; filter: drop-shadow(0 18px 24px rgba(0, 60, 80, 0.28)); }`,
})
export class PlaneComponent {
  readonly windows = Array.from({ length: 14 }, (_, i) => 66 + i * 9);
}
