import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { MapFeature } from '../../core/services/gates.service';
import { POI_META, PoiKind } from '../../core/data/airport-poi';

type LL = { lat: number; lon: number };

/**
 * The airport drawn from OpenStreetMap data, no imagery: boundary, aprons, runways, taxiways, terminal buildings
 * with their names, gates and every facility as a coloured dot. Nothing to download beyond the airport's data
 * (already on the phone after the first visit), so it opens instantly and works offline. Rendered on a canvas,
 * which stays smooth with hundreds of places.
 */
@Component({
  selector: 'gm-airport-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="plan" #host></div>
    @if (empty()) {
      <div class="empty"><span>Loading the airport plan…</span></div>
    }
    <span class="attr">© OpenStreetMap contributors</span>
  `,
  styles: `
    :host { position: relative; display: block; overflow: hidden; background: #eef2f4; }
    .plan { position: absolute; inset: 0; background: #eef2f4; }
    .attr { position: absolute; right: 8px; bottom: 4px; z-index: 500; font-size: 9px; color: #64748b; pointer-events: none; }
    .empty { position: absolute; inset: 0; z-index: 450; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 13px; pointer-events: none; }
  `,
})
export class AirportPlanComponent {
  readonly center = input.required<LL>();
  readonly features = input<MapFeature[]>([]);
  readonly me = input<LL | null>(null);
  readonly selectedGate = input<string | null>(null);
  readonly selectedPlace = input<string | null>(null);
  /** Show only this category's places (null = all). */
  readonly category = input<PoiKind | null>(null);
  readonly interactive = input(true);
  readonly zoom = input(15);
  readonly gateTap = output<string>();
  readonly placeTap = output<string>();

  readonly empty = signal(true);
  private host = viewChild.required<ElementRef<HTMLElement>>('host');
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private base?: Leaflet.LayerGroup;
  private top?: Leaflet.LayerGroup;
  private strips: { layer: Leaflet.Polyline; width: number; min: number }[] = [];
  private resize?: ResizeObserver;
  private init?: Promise<void>;
  private framedFor = '';

  constructor() {
    effect(() => {
      const f = this.features();
      const c = this.category();
      void this.ensure().then(() => this.drawBase(f, c));
    });
    effect(() => {
      const f = this.features(), me = this.me(), gate = this.selectedGate(), place = this.selectedPlace();
      void this.ensure().then(() => this.drawTop(f, me, gate, place));
    });
    inject(DestroyRef).onDestroy(() => {
      this.resize?.disconnect();
      this.map?.remove();
    });
  }

  private ensure(): Promise<void> {
    this.init ??= this.create();
    return this.init;
  }

  private async create() {
    const mod = (await import('leaflet')) as unknown as typeof Leaflet & { default?: typeof Leaflet };
    const L = (this.L = mod.default && typeof mod.default.map === 'function' ? mod.default : mod);
    const i = this.interactive();
    const c = this.center();
    this.map = L.map(this.host().nativeElement, {
      preferCanvas: true,
      zoomControl: false,
      attributionControl: false,
      dragging: i,
      touchZoom: i,
      scrollWheelZoom: i,
      doubleClickZoom: i,
      boxZoom: false,
      keyboard: i,
      zoomSnap: 0.25,
      minZoom: 11,
      maxZoom: 20,
    }).setView([c.lat, c.lon], this.zoom());
    this.base = L.layerGroup().addTo(this.map);
    this.top = L.layerGroup().addTo(this.map);
    this.map.on('zoomend', () => this.onZoom());
    this.resize = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.resize.observe(this.host().nativeElement);
    setTimeout(() => this.map?.invalidateSize(), 250);
  }

  /** Real-world widths (runways ~45 m) in pixels at the current zoom. */
  private px(metres: number, min: number): number {
    const m = this.map!;
    const mpp = (156543.03 * Math.cos((m.getCenter().lat * Math.PI) / 180)) / 2 ** m.getZoom();
    return Math.max(min, metres / mpp);
  }

  private onZoom() {
    const z = this.map!.getZoom();
    for (const s of this.strips) s.layer.setStyle({ weight: this.px(s.width, s.min) });
    const el = this.host().nativeElement;
    el.classList.toggle('z-gates', z >= 16);
    el.classList.toggle('z-names', z >= 14);
    el.classList.toggle('z-far', z < 14);
  }

  private drawBase(features: MapFeature[], category: PoiKind | null) {
    const L = this.L!, map = this.map!, layer = this.base!;
    layer.clearLayers();
    this.strips = [];
    this.empty.set(features.length === 0);
    const by = (k: MapFeature['kind']) => features.filter((f) => f.kind === k);

    for (const a of by('aerodrome')) L.polygon(a.outline!, { color: '#cfdcd3', weight: 1, fillColor: '#e3ece5', fillOpacity: 1, interactive: false }).addTo(layer);
    for (const a of by('apron')) L.polygon(a.outline!, { color: '#cdd4dc', weight: 1, fillColor: '#dde3e9', fillOpacity: 1, interactive: false }).addTo(layer);
    for (const t of by('taxiway')) {
      const line = L.polyline(t.line!, { color: '#e9d48f', weight: 2, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layer);
      this.strips.push({ layer: line, width: t.width ?? 18, min: 1.5 });
    }
    for (const r of by('runway')) {
      const line = L.polyline(r.line!, { color: '#4b5563', weight: 4, lineCap: 'butt', interactive: false }).addTo(layer);
      this.strips.push({ layer: line, width: r.width ?? 45, min: 3 });
      L.polyline(r.line!, { color: '#ffffff', weight: 1, dashArray: '8 10', opacity: 0.8, interactive: false }).addTo(layer);
    }
    for (const t of by('terminal')) {
      if (t.outline) {
        L.polygon(t.outline, { color: '#0fb5c3', weight: 2, fillColor: '#5fd6df', fillOpacity: 0.32, interactive: false, className: 'gm-terminal-outline' }).addTo(layer);
      }
    }
    // Every place as a coloured dot (canvas: fast with hundreds of them).
    const pois = features.filter((f) => f.kind === 'poi' && (!category || f.poi === category));
    for (const p of pois) {
      const meta = POI_META[p.poi ?? 'info'] ?? POI_META.info;
      const dot = L.circleMarker([p.lat, p.lon], {
        radius: category ? 7 : 5.5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: meta.color,
        fillOpacity: 1,
        interactive: this.interactive(),
      }).addTo(layer);
      if (this.interactive()) {
        dot.bindTooltip(esc(p.ref), { direction: 'top', offset: [0, -6] });
        dot.on('click', () => p.id && this.placeTap.emit(p.id));
      }
    }
    // Labels: terminal names always, gates when zoomed in.
    for (const t of by('terminal')) {
      L.marker([t.lat, t.lon], { icon: L.divIcon({ className: 'gm-plan-terminal', html: `<span>${esc(t.ref)}</span>`, iconSize: undefined }), interactive: false }).addTo(layer);
    }
    for (const r of by('runway')) {
      if (r.ref) L.marker([r.lat, r.lon], { icon: L.divIcon({ className: 'gm-plan-runway', html: `<span>${esc(r.ref)}</span>`, iconSize: undefined }), interactive: false }).addTo(layer);
    }
    for (const g of by('gate')) {
      const m = L.marker([g.lat, g.lon], { icon: L.divIcon({ className: 'gm-plan-gate', html: `<span>${esc(g.ref)}</span>`, iconSize: undefined }), interactive: this.interactive() });
      m.on('click', () => this.gateTap.emit(g.ref));
      m.addTo(layer);
    }

    // Frame the airport once per airport: terminals first, else the whole boundary.
    const key = features.length ? `${features[0].id}|${features.length}` : '';
    if (key && key !== this.framedFor) {
      this.framedFor = key;
      const frame = by('terminal').flatMap((t) => (t.outline ? t.outline.flat() : [[t.lat, t.lon] as [number, number]]));
      const pts = frame.length ? frame : by('aerodrome').flatMap((a) => a.outline!.flat());
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(frame.length ? 0.25 : 0.02), { animate: false, maxZoom: 17 });
    }
    this.onZoom();
  }

  private drawTop(features: MapFeature[], me: LL | null, gate: string | null, place: string | null) {
    const L = this.L!, map = this.map!, layer = this.top!;
    layer.clearLayers();
    const g = gate ? features.find((f) => f.kind === 'gate' && f.ref.toUpperCase() === gate.toUpperCase()) : undefined;
    const p = place ? features.find((f) => f.id === place) : undefined;
    if (g) L.marker([g.lat, g.lon], { icon: L.divIcon({ className: 'gm-plan-gate on', html: `<span>${esc(g.ref)}</span>`, iconSize: undefined }), zIndexOffset: 1000 }).addTo(layer);
    if (p) {
      const meta = POI_META[p.poi ?? 'info'] ?? POI_META.info;
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({ className: 'gm-pin-poi on', html: `<span style="--c:${meta.color}">${meta.glyph}</span>`, iconSize: undefined }),
        zIndexOffset: 1500,
      }).addTo(layer);
    }
    const target = p ?? g;
    if (me && this.interactive()) {
      L.marker([me.lat, me.lon], { icon: L.divIcon({ className: 'gm-pin-me', html: '<i></i>', iconSize: [22, 22] }), zIndexOffset: 2000 }).addTo(layer);
      if (target) {
        L.polyline([[me.lat, me.lon], [target.lat, target.lon]], { color: '#0b1b2b', weight: 3, dashArray: '2 8', lineCap: 'round' }).addTo(layer);
        map.fitBounds(L.latLngBounds([[me.lat, me.lon], [target.lat, target.lon]]).pad(0.35), { maxZoom: 18, animate: true });
      }
    } else if (target && this.interactive()) {
      map.setView([target.lat, target.lon], Math.max(map.getZoom(), 17.5), { animate: true });
    }
  }

  recenter() {
    this.framedFor = '';
    this.drawBase(this.features(), this.category());
  }

  zoomBy(d: number) {
    if (this.map) this.map.setZoom(this.map.getZoom() + d);
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
