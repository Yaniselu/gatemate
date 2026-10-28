import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { environment } from '../../../environments/environment';
import { MapFeature } from '../../core/services/gates.service';

const POI_GLYPH: Record<string, string> = { food: '☕', pharmacy: '✚', toilets: 'WC', money: '€', charging: '⚡', shop: '🛍', info: 'i' };

/**
 * Satellite map (Leaflet + raster imagery, loaded lazily so it costs nothing until opened).
 * Gates, terminals and facilities come from OpenStreetMap; markers are lightweight HTML pins.
 */
@Component({
  selector: 'gm-sat-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map" #host></div>
    @if (failed()) {
      <div class="fallback"><span>Satellite imagery needs an internet connection.</span></div>
    }
    <span class="attr">{{ attribution }}</span>
  `,
  styles: `
    :host { position: relative; display: block; overflow: hidden; background: #1d2b36; }
    .map { position: absolute; inset: 0; }
    .attr { position: absolute; left: 6px; bottom: 4px; z-index: 500; font-size: 9px; color: rgba(255,255,255,.85); text-shadow: 0 1px 2px rgba(0,0,0,.7); pointer-events: none; max-width: 70%; }
    .fallback { position: absolute; inset: 0; z-index: 400; display: flex; align-items: center; justify-content: center; padding: 20px; text-align: center; color: #cfe3ee; font-size: 13px; background: linear-gradient(160deg, #12304a, #0a4e5c); }
  `,
})
export class SatMapComponent {
  readonly center = input.required<{ lat: number; lon: number }>();
  readonly features = input<MapFeature[]>([]);
  readonly me = input<{ lat: number; lon: number } | null>(null);
  readonly selectedGate = input<string | null>(null);
  readonly interactive = input(true);
  readonly zoom = input(15);
  readonly gateTap = output<string>();

  readonly attribution = environment.maps.attribution;
  readonly failed = signal(false);
  private host = viewChild.required<ElementRef<HTMLElement>>('host');
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private layer?: Leaflet.LayerGroup;
  private tiles = 0;
  private errors = 0;

  constructor() {
    effect(() => {
      const c = this.center();
      void this.ensure().then(() => this.map?.setView([c.lat, c.lon], this.zoom(), { animate: true }));
    });
    effect(() => {
      const f = this.features();
      const me = this.me();
      const sel = this.selectedGate();
      void this.ensure().then(() => this.draw(f, me, sel));
    });
    inject(DestroyRef).onDestroy(() => {
      this.resize?.disconnect();
      this.map?.remove();
    });
  }

  private init?: Promise<void>;

  /** Single-flight: both effects may ask for the map before the lazy import resolves. */
  private ensure(): Promise<void> {
    this.init ??= this.create();
    return this.init;
  }

  private async create() {
    // Leaflet is CommonJS: optimized builds expose it as the module's default export, dev builds as the namespace.
    const mod = (await import('leaflet')) as unknown as typeof Leaflet & { default?: typeof Leaflet };
    this.L = mod.default && typeof mod.default.map === 'function' ? mod.default : mod;
    const L = this.L;
    const c = this.center();
    const i = this.interactive();
    this.map = L.map(this.host().nativeElement, {
      zoomControl: false,
      attributionControl: false,
      dragging: i,
      touchZoom: i,
      scrollWheelZoom: i,
      doubleClickZoom: i,
      boxZoom: false,
      keyboard: i,
      zoomSnap: 0.5,
    }).setView([c.lat, c.lon], this.zoom());
    // No crossOrigin: tiles are only displayed, and a CORS request can be refused inside the iOS web view.
    const sat = L.tileLayer(environment.maps.satelliteTiles, { maxZoom: 19, maxNativeZoom: 18 });
    sat.on('tileload', () => this.tiles++);
    sat.on('tileerror', () => {
      this.errors++;
      if (this.errors > 4 && this.tiles === 0) this.failed.set(true);
    });
    sat.addTo(this.map);
    L.tileLayer(environment.maps.labelTiles, { maxZoom: 19, maxNativeZoom: 18, opacity: 0.9 }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    // The page may still be animating in (zero size) when the map is created; Leaflet then never asks for tiles.
    // Re-measure whenever the container changes size, and once more after the page transition.
    const el = this.host().nativeElement;
    this.resize = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.resize.observe(el);
    setTimeout(() => this.map?.invalidateSize(), 250);
    setTimeout(() => this.map?.invalidateSize(), 800);
    // Nothing loaded at all after a while: say so instead of showing an empty dark box.
    setTimeout(() => {
      if (this.tiles === 0) this.failed.set(true);
    }, 12_000);
  }

  private resize?: ResizeObserver;

  private draw(features: MapFeature[], me: { lat: number; lon: number } | null, selected: string | null) {
    const L = this.L!;
    this.layer!.clearLayers();
    for (const f of features) {
      if (f.kind === 'terminal') {
        L.marker([f.lat, f.lon], { icon: L.divIcon({ className: 'gm-pin-terminal', html: `<span>${esc(f.ref)}</span>`, iconSize: undefined }), interactive: false }).addTo(this.layer!);
      } else if (f.kind === 'gate') {
        const on = selected && f.ref.toUpperCase() === selected.toUpperCase();
        const m = L.marker([f.lat, f.lon], {
          icon: L.divIcon({ className: 'gm-pin-gate' + (on ? ' on' : ''), html: `<span>${esc(f.ref)}</span>`, iconSize: undefined }),
          zIndexOffset: on ? 1000 : 0,
        });
        m.on('click', () => this.gateTap.emit(f.ref));
        m.addTo(this.layer!);
      } else if (this.interactive()) {
        L.marker([f.lat, f.lon], { icon: L.divIcon({ className: `gm-pin-poi ${f.poi}`, html: `<span title="${esc(f.ref)}">${POI_GLYPH[f.poi ?? 'info']}</span>`, iconSize: undefined }) })
          .bindTooltip(esc(f.ref), { direction: 'top', offset: [0, -10] })
          .addTo(this.layer!);
      }
    }
    if (me) {
      L.marker([me.lat, me.lon], { icon: L.divIcon({ className: 'gm-pin-me', html: '<i></i>', iconSize: [22, 22] }), zIndexOffset: 2000 }).addTo(this.layer!);
      const gate = selected ? features.find((f) => f.kind === 'gate' && f.ref.toUpperCase() === selected.toUpperCase()) : undefined;
      if (gate) {
        L.polyline([[me.lat, me.lon], [gate.lat, gate.lon]], { color: '#22c7d3', weight: 4, dashArray: '2 10', lineCap: 'round', className: 'gm-route' }).addTo(this.layer!);
        this.map!.fitBounds(L.latLngBounds([[me.lat, me.lon], [gate.lat, gate.lon]]).pad(0.35), { maxZoom: 18, animate: true });
      }
    } else if (selected) {
      const gate = features.find((f) => f.kind === 'gate' && f.ref.toUpperCase() === selected.toUpperCase());
      if (gate) this.map!.setView([gate.lat, gate.lon], 17, { animate: true });
    }
  }

  recenter() {
    const c = this.center();
    this.map?.setView([c.lat, c.lon], this.zoom(), { animate: true });
  }

  zoomBy(d: number) {
    if (this.map) this.map.setZoom(this.map.getZoom() + d);
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
