// Schematic departures map of a two-pier terminal (demo data for OTP Terminal 1).
// Production: load the airport's IMDF/indoor map from the backend's licensed map provider.

export interface MapNode {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface MapGate {
  id: string;
  node: string;
  x: number;
  y: number;
  pier: 'A' | 'B';
}

export interface MapPoi {
  id: string;
  kind: 'food' | 'restroom' | 'lounge' | 'pharmacy' | 'charging' | 'shop' | 'info';
  x: number;
  y: number;
  name: string;
}

/** 1 map unit ≈ 1.6 m; average airport walking pace ≈ 75 m/min. */
export const METERS_PER_UNIT = 1.6;
export const WALK_M_PER_MIN = 75;

export const NODES: MapNode[] = [
  { id: 'entrance', x: 180, y: 610, label: 'Entrance' },
  { id: 'checkin', x: 180, y: 555, label: 'Check-in hall' },
  { id: 'security', x: 180, y: 478, label: 'Security' },
  { id: 'plaza', x: 180, y: 420, label: 'Duty free plaza' },
  { id: 'aJ', x: 110, y: 380 },
  { id: 'a1', x: 90, y: 320 },
  { id: 'a2', x: 80, y: 250 },
  { id: 'a3', x: 72, y: 170 },
  { id: 'a4', x: 66, y: 95 },
  { id: 'passport', x: 230, y: 380, label: 'Passport control' },
  { id: 'b1', x: 262, y: 320 },
  { id: 'b2', x: 276, y: 250 },
  { id: 'b3', x: 286, y: 170 },
  { id: 'b4', x: 294, y: 95 },
];

export const EDGES: [string, string][] = [
  ['entrance', 'checkin'], ['checkin', 'security'], ['security', 'plaza'], ['plaza', 'aJ'], ['aJ', 'a1'], ['a1', 'a2'], ['a2', 'a3'], ['a3', 'a4'],
  ['plaza', 'passport'], ['passport', 'b1'], ['b1', 'b2'], ['b2', 'b3'], ['b3', 'b4'],
];

function gatesFor(pier: 'A' | 'B', nodes: string[], count: number): MapGate[] {
  const out: MapGate[] = [];
  for (let i = 0; i < count; i++) {
    const node = NODES.find((n) => n.id === nodes[Math.min(nodes.length - 1, Math.floor((i / count) * nodes.length))])!;
    const left = i % 2 === 0;
    out.push({ id: `${pier}${i + 1}`, node: node.id, pier, x: node.x + (pier === 'A' ? (left ? -34 : 26) : left ? 34 : -26), y: node.y - ((i % 4) - 1.5) * 9 });
  }
  return out;
}

export const GATES: MapGate[] = [...gatesFor('A', ['a1', 'a2', 'a3', 'a4'], 8), ...gatesFor('B', ['b1', 'b2', 'b3', 'b4'], 14)];

export const POIS: MapPoi[] = [
  { id: 'p1', kind: 'food', x: 150, y: 405, name: 'Runway Coffee Bar' },
  { id: 'p2', kind: 'shop', x: 212, y: 430, name: 'Duty Free' },
  { id: 'p3', kind: 'restroom', x: 120, y: 290, name: 'Restrooms' },
  { id: 'p4', kind: 'lounge', x: 300, y: 300, name: 'Business Lounge' },
  { id: 'p5', kind: 'charging', x: 250, y: 205, name: 'Charging' },
  { id: 'p6', kind: 'pharmacy', x: 140, y: 540, name: 'Pharmacy' },
  { id: 'p7', kind: 'restroom', x: 252, y: 130, name: 'Restrooms' },
  { id: 'p8', kind: 'info', x: 222, y: 575, name: 'Information' },
  { id: 'p9', kind: 'food', x: 108, y: 205, name: 'Pasta Volo' },
];

/** Dijkstra over the walkway graph. */
export function route(from: string, to: string): MapNode[] {
  const byId = new Map(NODES.map((n) => [n.id, n]));
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const todo = new Set(NODES.map((n) => n.id));
  const d = (a: MapNode, b: MapNode) => Math.hypot(a.x - b.x, a.y - b.y);
  while (todo.size) {
    let cur = '';
    let best = Infinity;
    todo.forEach((id) => {
      const v = dist.get(id) ?? Infinity;
      if (v < best) [best, cur] = [v, id];
    });
    if (!cur || cur === to) break;
    todo.delete(cur);
    for (const [a, b] of EDGES) {
      const next = a === cur ? b : b === cur ? a : null;
      if (!next || !todo.has(next)) continue;
      const alt = best + d(byId.get(cur)!, byId.get(next)!);
      if (alt < (dist.get(next) ?? Infinity)) {
        dist.set(next, alt);
        prev.set(next, cur);
      }
    }
  }
  const path: MapNode[] = [];
  for (let at: string | undefined = to; at; at = prev.get(at)) path.unshift(byId.get(at)!);
  return path[0]?.id === from ? path : [];
}
