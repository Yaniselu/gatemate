import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { greatCircle, RouteLine } from '../../core/utils/travel-summary';
import { TranslatePipe } from '../../core/i18n/i18n.service';

const BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

@Component({
  selector: 'gm-route-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="map" #host></div>
    @if (offline()) {
      <div class="offline">{{ 'Map tiles need an internet connection' | t }}</div>
    }
    <span class="attr">{{ '© Esri' | t }}</span>
  `,
  styles: `
    :host { position: relative; display: block; overflow: hidden; background: #eef3f5; }
    .map { position: absolute; inset: 0; background: #eef3f5; }
    .attr { position: absolute; right: 8px; bottom: 4px; z-index: 500; font-size: 9px; color: #64748b; pointer-events: none; }
    .offline { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 500; font-size: 11px; color: #475569; background: rgba(255,255,255,.9); padding: 4px 10px; border-radius: 99px; white-space: nowrap; }
  `,
})
export class RouteMapComponent {
  readonly routes = input<RouteLine[]>([]);
  readonly plane = input<{ lat: number; lon: number; heading?: number } | null>(null);
  readonly offline = signal(false);
  private host = viewChild.required<ElementRef<HTMLElement>>('host');
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private layer?: Leaflet.LayerGroup;
  private resize?: ResizeObserver;
  private init?: Promise<void>;

  constructor() {
    effect(() => {
      const r = this.routes();
      const p = this.plane();
      void (this.init ??= this.create()).then(() => this.draw(r, p));
    });
    inject(DestroyRef).onDestroy(() => {
      this.resize?.disconnect();
      this.map?.remove();
    });
  }

  private async create() {
    const mod = (await import('leaflet')) as unknown as typeof Leaflet & { default?: typeof Leaflet };
    const L = (this.L = mod.default && typeof mod.default.map === 'function' ? mod.default : mod);
    this.map = L.map(this.host().nativeElement, {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      minZoom: 1,
      maxZoom: 8,
      zoomSnap: 0.25,
    }).setView([30, 10], 1.5);
    let loaded = 0;
    const tiles = L.tileLayer(BASE, { maxZoom: 8 });
    tiles.on('tileload', () => {
      loaded++;
      this.offline.set(false);
    });
    tiles.on('tileerror', () => loaded === 0 && this.offline.set(true));
    tiles.addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    this.resize = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.resize.observe(this.host().nativeElement);
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  private draw(routes: RouteLine[], plane: { lat: number; lon: number; heading?: number } | null = null) {
    const L = this.L!, map = this.map!, layer = this.layer!;
    layer.clearLayers();
    const bounds: [number, number][] = [];
    const seen = new Set<string>();
    routes.forEach((r, i) => {
      const pts = greatCircle(r.from, r.to);
      bounds.push(...pts);
      const line = L.polyline(pts, {
        color: '#0fb5c2',
        weight: r.upcoming ? 2 : 2.5 + Math.min(3, r.count - 1),
        opacity: r.upcoming ? 0.7 : 0.95,
        dashArray: r.upcoming ? '4 7' : undefined,
        lineCap: 'round',
        interactive: false,
        className: r.upcoming ? 'gm-arc upcoming' : 'gm-arc',
      }).addTo(layer);
      const el = line.getElement() as SVGPathElement | undefined;
      if (el && !r.upcoming) {
        el.setAttribute('pathLength', '1');
        el.style.animationDelay = `${Math.min(i, 12) * 90}ms`;
      }
      for (const p of [r.from, r.to]) {
        if (seen.has(p.code)) continue;
        seen.add(p.code);
        L.circleMarker([p.lat, p.lon], { radius: 4.5, color: '#fff', weight: 2, fillColor: '#0b7f8a', fillOpacity: 1, interactive: true })
          .bindTooltip(`${p.code} · ${p.city}`, { direction: 'top', offset: [0, -4] })
          .addTo(layer);
      }
    });
    if (plane) {
      const html = `<span style="transform: rotate(${(plane.heading ?? 0) - 45}deg)">✈</span>`;
      L.marker([plane.lat, plane.lon], { icon: L.divIcon({ className: 'gm-live-plane', html, iconSize: [30, 30] }), zIndexOffset: 3000, interactive: false }).addTo(layer);
      bounds.push([plane.lat, plane.lon]);
    }
    if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.25), { maxZoom: plane ? 6 : 5, animate: false });
    else map.setView([30, 10], 1.5);
  }
}
