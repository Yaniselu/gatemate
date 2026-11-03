import type { MapFeature } from '../services/gates.service';

export type Pt = [number, number];

export interface WalkRoute {
  points: Pt[];
  levels: (string | undefined)[];
  meters: number;
  minutes: number;
  onPaths: boolean;
  viaEntrance: boolean;
  levelChange: boolean;
}

const WALK_M_PER_MIN = 75;
const SNAP_M = 90;

export function metres(a: Pt, b: Pt): number {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function key(p: Pt): string {
  return `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
}

function length(pts: Pt[]): number {
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += metres(pts[i - 1], pts[i]);
  return m;
}

class Heap {
  private items: [number, number][] = [];
  get size() {
    return this.items.length;
  }
  push(node: number, cost: number) {
    const a = this.items;
    a.push([cost, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export class WalkGraph {
  private nodes: Pt[] = [];
  private levels: (string | undefined)[] = [];
  private index = new Map<string, number>();
  private adj: { to: number; w: number; m: number }[][] = [];
  private comp: number[] = [];

  constructor(features: MapFeature[]) {
    for (const f of features) {
      if ((f.kind !== 'walk' && f.kind !== 'escalator') || !f.line || f.line.length < 2) continue;
      const slow = f.cls === 'steps' ? 1.6 : f.kind === 'escalator' ? 1.25 : 1;
      let prev = this.node(f.line[0], f.level);
      for (let i = 1; i < f.line.length; i++) {
        const next = this.node(f.line[i], f.level);
        const m = metres(f.line[i - 1], f.line[i]);
        if (next !== prev && m > 0) {
          this.adj[prev].push({ to: next, w: m * slow, m });
          this.adj[next].push({ to: prev, w: m * slow, m });
        }
        prev = next;
      }
    }
    this.components();
  }

  get size(): number {
    return this.nodes.length;
  }

  private node(p: Pt, level?: string): number {
    const k = key(p);
    let i = this.index.get(k);
    if (i === undefined) {
      i = this.nodes.length;
      this.index.set(k, i);
      this.nodes.push([p[0], p[1]]);
      this.levels.push(level);
      this.adj.push([]);
    }
    return i;
  }

  private components() {
    this.comp = new Array(this.nodes.length).fill(-1);
    let id = 0;
    for (let s = 0; s < this.nodes.length; s++) {
      if (this.comp[s] !== -1) continue;
      const stack = [s];
      this.comp[s] = id;
      while (stack.length) {
        const n = stack.pop()!;
        for (const e of this.adj[n]) if (this.comp[e.to] === -1) {
          this.comp[e.to] = id;
          stack.push(e.to);
        }
      }
      id++;
    }
  }

  private nearest(p: Pt, comp?: number): { i: number; d: number } | null {
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      if (comp !== undefined && this.comp[i] !== comp) continue;
      const d = metres(p, this.nodes[i]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best < 0 || bd > SNAP_M ? null : { i: best, d: bd };
  }

  snap(p: Pt, within: number): Pt {
    const n = this.nearest(p);
    return n && n.d <= within ? this.nodes[n.i] : p;
  }

  route(from: Pt, to: Pt): { points: Pt[]; levels: (string | undefined)[]; metres: number; levelChange: boolean } | null {
    if (!this.nodes.length) return null;
    const s = this.nearest(from);
    if (!s) return null;
    const t = this.nearest(to, this.comp[s.i]);
    if (!t) return null;
    const dist = new Float64Array(this.nodes.length).fill(Infinity);
    const prev = new Int32Array(this.nodes.length).fill(-1);
    const heap = new Heap();
    dist[s.i] = 0;
    heap.push(s.i, 0);
    while (heap.size) {
      const [cost, n] = heap.pop();
      if (n === t.i) break;
      if (cost > dist[n]) continue;
      for (const e of this.adj[n]) {
        const c = cost + e.w;
        if (c < dist[e.to]) {
          dist[e.to] = c;
          prev[e.to] = n;
          heap.push(e.to, c);
        }
      }
    }
    if (dist[t.i] === Infinity) return null;
    const path: number[] = [];
    for (let n = t.i; n !== -1; n = prev[n]) path.push(n);
    path.reverse();
    const lv = new Set(path.map((n) => this.levels[n]).filter((l): l is string => !!l && !l.includes(';')));
    const pts: Pt[] = [from, ...path.map((n) => this.nodes[n]), to];
    const levels = [this.levels[path[0]], ...path.map((n) => this.levels[n]), this.levels[path[path.length - 1]]];
    return { points: pts, levels, metres: length(pts), levelChange: lv.size > 1 };
  }
}

export function inside(p: Pt, ring: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function planRoute(graph: WalkGraph | null, features: MapFeature[], from: Pt, to: Pt): WalkRoute {
  const onGraph = graph?.route(from, to);
  if (onGraph) {
    return { points: onGraph.points, levels: onGraph.levels, meters: Math.round(onGraph.metres), minutes: minutes(onGraph.metres), onPaths: true, viaEntrance: false, levelChange: onGraph.levelChange };
  }
  const terminals = features.filter((f) => f.kind === 'terminal' && f.outline?.length);
  const inTerminal = (p: Pt) => terminals.some((t) => t.outline!.some((r) => inside(p, r as Pt[])));
  const entrances = features.filter((f) => f.kind === 'entrance').map((f) => [f.lat, f.lon] as Pt);
  let points: Pt[] = [from, to];
  let viaEntrance = false;
  if (entrances.length && !inTerminal(from) && inTerminal(to)) {
    const door = entrances.reduce((best, e) => (metres(from, e) + metres(e, to) < metres(from, best) + metres(best, to) ? e : best));
    points = [from, door, to];
    viaEntrance = true;
  }
  const m = length(points);
  return { points, levels: points.map(() => undefined), meters: Math.round(m), minutes: minutes(m * (viaEntrance ? 1.1 : 1.3)), onPaths: false, viaEntrance, levelChange: false };
}

function minutes(m: number): number {
  return Math.max(1, Math.round(m / WALK_M_PER_MIN));
}
