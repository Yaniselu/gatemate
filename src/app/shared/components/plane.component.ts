import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n.service';

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
        <linearGradient id="gm-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff7d6" stop-opacity=".9" />
          <stop offset="1" stop-color="#fff7d6" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="M118 44 L92 18 L106 18 L150 44 Z" fill="#c2d3de" />
      <path d="M30 44 L16 8 L34 8 L64 42 Z" fill="url(#gm-tail)" />
      <path d="M24 16 L33 16 L40 26 L28 26 Z" fill="#0fb5c3" />
      <path d="M28 54 L6 64 L20 67 L54 58 Z" fill="#c9d8e2" />
      <path d="M20 52 C20 44 40 40 70 40 L188 40 C212 40 228 46 236 52 C228 58 212 63 188 63 L42 63 C28 63 20 59 20 52 Z" fill="url(#gm-body)" />
      <path d="M40 57 L200 57" stroke="#0fb5c3" stroke-width="3" stroke-linecap="round" />
      <path d="M60 60 L188 60" stroke="#0b1b2b" stroke-opacity=".08" stroke-width="2" />
      <g fill="#1d3a52" fill-opacity=".85">
        @for (x of windows; track x) {
          <rect [attr.x]="x" y="46" width="4.2" height="5.2" rx="2" />
        }
      </g>
      <path d="M212 46 L224 46 C228 48 230 50 231 51 L214 51 Z" fill="#1d3a52" />
      <rect x="196" y="44" width="6" height="12" rx="2" fill="none" stroke="#9fb3c2" stroke-width="1" />
      <path d="M112 58 L76 94 L98 94 L156 58 Z" fill="url(#gm-wing)" stroke="#c9d8e2" stroke-width="1" />
      <path d="M128 68 L141 68 L147 77 L131 77 Z" fill="#c9d8e2" />
      <path d="M118 80 C118 75.5 121 74 126 74 L156 74 C160.5 74 163 77 163 81.5 C163 86 160.5 89 156 89 L126 89 C121 89 118 87.5 118 83 Z" fill="#e8f0f5" stroke="#b9cbd7" stroke-width="1" />
      <path d="M118 78 L111 79.5 L111 84 L118 85.5 Z" fill="#9fb3c2" />
      <path d="M126 85.5 L156 85.5" stroke="#b9cbd7" stroke-width="1" />
      <ellipse cx="162" cy="81.5" rx="2.6" ry="6.6" fill="#0b1b2b" fill-opacity=".8" />
      <g class="lights">
        <circle class="nav red" cx="79" cy="93" r="2.6" />
        <circle class="nav strobe" cx="77" cy="93" r="1.6" />
        <circle class="nav beacon" cx="110" cy="39.5" r="2" />
        <circle class="nav beacon" cx="118" cy="63.5" r="2" />
        <circle class="nav strobe tail" cx="18" cy="9" r="1.6" />
        <path class="beam" d="M233 52 L300 40 L300 66 Z" />
      </g>
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { width: 100%; height: auto; overflow: visible; filter: drop-shadow(0 18px 24px rgba(0, 60, 80, 0.28)); }
    .lights { display: none; }
    :host-context(html.gm-dark) .lights { display: inline; }
    :host-context(html.gm-dark) svg { filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.55)) brightness(.9); }
    .nav.red { fill: #ff3b3b; filter: drop-shadow(0 0 4px #ff3b3b); }
    .nav.beacon { fill: #ff4d4d; animation: beacon 1.2s steps(1) infinite; filter: drop-shadow(0 0 5px #ff4d4d); }
    .nav.strobe { fill: #fff; opacity: 0; animation: strobe 1.6s infinite; filter: drop-shadow(0 0 6px #fff); }
    .nav.strobe.tail { animation-delay: .1s; }
    .beam { fill: url(#gm-beam); opacity: .55; }
    @keyframes beacon { 0%, 100% { opacity: 1; } 50% { opacity: .15; } }
    @keyframes strobe { 0%, 8%, 14%, 100% { opacity: 0; } 4%, 11% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .nav { animation: none !important; opacity: 1; } }
  `,
})
export class PlaneComponent {
  readonly windows = Array.from({ length: 14 }, (_, i) => 66 + i * 9);
}
