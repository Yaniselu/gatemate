import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { DestinationInfo, DestinationService, weatherLabel } from '../../core/services/destination.service';
import { AirportDbService } from '../../core/services/airport-db.service';
import { PrefsService } from '../../core/services/prefs.service';
import { SkeletonComponent } from './skeleton.component';
import { RevealDirective } from '../directives/reveal.directive';
import { locale, TranslatePipe } from '../../core/i18n/i18n.service';

@Component({
  selector: 'gm-destination-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, SkeletonComponent, RevealDirective],
  template: `
    @if (info(); as d) {
      @if (d.offline) {
        <div class="card offline-note"><ion-icon name="cloud-offline-outline" /><p>{{ 'Weather, photos and the city summary need the internet. Country facts below work offline.' | t }}</p><button (click)="retry()">{{ 'Retry' | t }}</button></div>
      }
      @if (d.summary; as s) {
        <section class="card about" gmReveal>
          <span class="gm-label">About {{ d.airport.city }}</span>
          @if (s.description) { <b class="desc">{{ s.description | t }}</b> }
          <p [class.clamp]="!expanded()">{{ s.extract }}</p>
          <div class="row">
            <button class="link" (click)="expanded.set(!expanded())">{{ expanded() ? ('Show less' | t) : ('Read more' | t) }}</button>
            <a class="link" [href]="s.pageUrl" target="_blank" rel="noopener">{{ 'Wikipedia' | t }} <ion-icon name="open-outline" /></a>
          </div>
        </section>
      }

      @if (d.weather; as w) {
        <section class="card weather" gmReveal="1">
          <div class="now">
            <ion-icon [name]="wl(w.code).icon" class="big" />
            <div>
              <b>{{ w.temp }}°C</b>
              <small>{{ wl(w.code).label }} · wind {{ w.wind }} km/h</small>
            </div>
          </div>
          <div class="days">
            @for (day of w.days; track day.date; let i = $index) {
              <div class="day" [style.--i]="i">
                <span class="gm-label">{{ i === 0 ? ('Today' | t) : weekday(day.date) }}</span>
                <ion-icon [name]="wl(day.code).icon" />
                <b>{{ day.max }}°</b><small>{{ day.min }}°</small>
              </div>
            }
          </div>
          <span class="src">{{ 'Forecast: Open-Meteo' | t }}</span>
        </section>
      }

      <section class="card facts" gmReveal="2">
        <div class="fact">
          <span class="gm-well accent"><ion-icon name="time-outline" /></span>
          <div><span class="gm-label">{{ 'Local time' | t }}</span><b>{{ localTime() }}</b><small>{{ diffLabel() }}</small></div>
        </div>
        @if (d.country; as c) {
          <div class="fact">
            <span class="gm-well accent"><ion-icon name="cash-outline" /></span>
            <div>
              <span class="gm-label">{{ 'Currency' | t }}</span><b>{{ currencyName(c.currency[0]) }}</b>
              @if (d.fx; as fx) {
                <small>1 {{ fx.base }} = {{ fx.rate.toFixed(fx.rate < 10 ? 3 : 1) }} {{ fx.currency }} · ECB {{ fx.date }}</small>
              } @else {
                <small>{{ c.currency.join(', ') }}</small>
              }
            </div>
          </div>
          <div class="fact">
            <span class="gm-well accent"><ion-icon name="language-outline" /></span>
            <div><span class="gm-label">{{ 'Languages' | t }}</span><b>{{ c.languages.slice(0, 3).join(', ') }}</b><small>Calling code +{{ c.phone[0] }}</small></div>
          </div>
          @if (c.plugs) {
            <div class="fact">
              <span class="gm-well" [class.warn]="needsAdapter()"><ion-icon name="flash-outline" /></span>
              <div>
                <span class="gm-label">{{ 'Power' | t }}</span><b>{{ 'Type {plugs} · {volts} V' | t: { plugs: c.plugs, volts: c.volts } }}</b>
                <small>{{ needsAdapter() ? ('You may need a plug adapter' | t) : ('Same plugs as at home' | t) }}</small>
              </div>
            </div>
          }
          @if (c.sos; as sos) {
            <div class="fact">
              <span class="gm-well danger"><ion-icon name="medkit-outline" /></span>
              <div>
                <span class="gm-label">{{ 'Emergency' | t }}</span>
                <b>{{ sos.general ?? sos.police }}</b>
                <small>
                  @if (sos.police && sos.general) { Police {{ sos.police }} · }
                  @if (sos.ambulance) { {{ 'Ambulance {n}' | t: { n: sos.ambulance } }} }
                  @if (sos.fire) { · Fire {{ sos.fire }} }
                  @if (!sos.ambulance && !sos.police) { {{ 'All emergencies' | t }} }
                </small>
              </div>
            </div>
          }
          <div class="fact">
            <span class="gm-well accent"><ion-icon name="car-outline" /></span>
            <div><span class="gm-label">{{ 'Traffic' | t }}</span><b>{{ (c.left ? 'Drives on the left' : 'Drives on the right') | t }}</b><small>{{ 'Capital: {city}' | t: { city: c.capital || '—' } }}</small></div>
          </div>
        }
      </section>
      <p class="note">{{ 'Facts are checked against official sources but can change — verify entry rules with your government’s travel advice.' | t }}</p>
    } @else if (error()) {
      <div class="card offline"><ion-icon name="cloud-offline-outline" /><p>{{ 'Destination info couldn’t load. Check your connection.' | t }}</p><button (click)="retry()">{{ 'Retry' | t }}</button></div>
    } @else {
      <div class="skel">
        <gm-skeleton height="140px" radius="16px" />
        <gm-skeleton height="120px" radius="16px" />
        <gm-skeleton height="220px" radius="16px" />
      </div>
    }
  `,
  styles: `
    .offline-note { display: flex; align-items: center; gap: 10px; padding: 12px 14px; margin-bottom: 12px; font-size: 13px; color: #9a3412; background: #fff7ed; }
    .offline-note p, .offline p { flex: 1; margin: 0; }
    .offline-note button, .offline button { flex: none; background: none; font-weight: 700; color: var(--gm-accent-strong); }

    :host { display: grid; gap: 12px; }
    .skel { display: grid; gap: 12px; }
    .about { padding: 16px; }
    .about .desc { display: block; margin: 4px 0 6px; font-size: 15px; }
    .about p { margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--gm-ink-2); user-select: text; }
    .about p.clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .row { display: flex; justify-content: space-between; margin-top: 8px; }
    .link { background: none; color: var(--gm-accent-strong); font-weight: 650; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
    .weather { padding: 16px; position: relative; }
    .now { display: flex; align-items: center; gap: 12px; }
    .now .big { font-size: 42px; color: var(--gm-amber); animation: gm-float 4s ease-in-out infinite; }
    .now b { display: block; font-size: 30px; font-weight: 800; line-height: 1; }
    .now small { color: var(--gm-ink-3); }
    .days { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--gm-line); }
    .day { display: flex; flex-direction: column; align-items: center; gap: 4px; animation: gm-fade-up .4s var(--gm-ease-out) both; animation-delay: calc(var(--i) * 60ms); }
    .day ion-icon { font-size: 22px; color: var(--gm-ink-2); }
    .day b { font-size: 14px; }
    .day small { font-size: 12px; color: var(--gm-ink-3); }
    .src { position: absolute; right: 14px; top: 14px; font-size: 10.5px; color: var(--gm-ink-3); }
    .facts { padding: 4px 14px; }
    .fact { display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--gm-line); }
    .fact:last-child { border-bottom: 0; }
    .fact b { display: block; font-size: 15px; margin-top: 2px; }
    .fact small { color: var(--gm-ink-3); font-size: 12.5px; }
    .gm-well.warn { color: #a26700; background: rgba(255,176,32,.14); }
    .gm-well.danger { color: #c2303a; background: rgba(255,90,95,.1); }
    .note { font-size: 12px; color: var(--gm-ink-3); text-align: center; margin: 2px 8px; }
    .offline { display: flex; gap: 12px; align-items: center; padding: 16px; color: var(--gm-ink-2); }
    .offline ion-icon { font-size: 28px; color: var(--gm-ink-3); }
  `,
})
export class DestinationGuideComponent {
  private dest = inject(DestinationService);
  private db = inject(AirportDbService);
  private prefs = inject(PrefsService);

  readonly iata = input.required<string>();
  readonly info = signal<DestinationInfo | null>(null);
  readonly error = signal(false);
  readonly expanded = signal(false);
  private now = signal(Date.now());
  protected wl = weatherLabel;

  readonly localTime = computed(() => {
    const d = this.info();
    return d ? new Date(this.now()).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone: d.airport.tz }) : '';
  });
  readonly diffLabel = computed(() => {
    const d = this.info();
    if (!d) return '';
    const offset = (tz: string) => {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date(this.now()));
      const m = parts.find((p) => p.type === 'timeZoneName')?.value.match(/GMT([+-]\d+)(?::(\d+))?/);
      return m ? +m[1] + (Math.sign(+m[1]) || 1) * (+(m[2] ?? 0) / 60) : 0;
    };
    const diff = offset(d.airport.tz) - offset(Intl.DateTimeFormat().resolvedOptions().timeZone);
    return diff === 0 ? 'Same time as you' : `${diff > 0 ? '+' : ''}${diff} h from your time`;
  });
  readonly needsAdapter = computed(() => {
    const d = this.info();
    const home = this.db.get(this.prefs.homeAirport());
    const homePlugs = home ? this.db.country(home.country)?.plugs : undefined;
    if (!d?.country?.plugs || !homePlugs) return false;
    const mine = new Set(homePlugs.split('/'));
    return !d.country.plugs.split('/').some((p) => mine.has(p));
  });

  constructor() {
    effect(() => {
      const code = this.iata();
      this.attempt();
      this.info.set(null);
      this.error.set(false);
      const home = this.db.get(this.prefs.homeAirport());
      const homeCurrency = (home && this.db.country(home.country)?.currency?.[0]) || 'EUR';
      this.db.load().then(() => this.dest.get(code, this.db.country(this.db.get(this.prefs.homeAirport())?.country ?? '')?.currency?.[0] ?? homeCurrency))
        .then((d) => this.info.set(d))
        .catch(() => this.error.set(true));
    });
    const t = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  private attempt = signal(0);
  retry() {
    this.dest.forget(this.iata());
    this.attempt.update((n) => n + 1);
  }

  weekday(date: string) {
    return new Date(date + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'short' });
  }

  currencyName(code: string) {
    try {
      return new Intl.DisplayNames([locale()], { type: 'currency' }).of(code) ?? code;
    } catch {
      return code;
    }
  }
}
