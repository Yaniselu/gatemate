import { BaggageAllowance, BagItem } from '../models';

export type ImportMethod = 'booking' | 'email' | 'pass';

export interface AirlineOption {
  code: string;
  name: string;
  /** Ways a booking from this airline can be imported and verified. */
  methods: ImportMethod[];
}

// Airline names are used only to identify the carrier of the user's own booking (no logos, no affiliation).
export const AIRLINES: AirlineOption[] = [
  { code: 'W6', name: 'Wizz Air', methods: ['booking', 'email', 'pass'] },
  { code: 'FR', name: 'Ryanair', methods: ['booking', 'email', 'pass'] },
  { code: 'RO', name: 'TAROM', methods: ['booking', 'email', 'pass'] },
  { code: 'H4', name: 'HiSky', methods: ['email', 'pass'] },
  { code: 'U2', name: 'easyJet', methods: ['booking', 'email', 'pass'] },
  { code: 'LH', name: 'Lufthansa', methods: ['booking', 'email', 'pass'] },
  { code: 'TK', name: 'Turkish Airlines', methods: ['booking', 'email', 'pass'] },
  { code: 'A3', name: 'Aegean Airlines', methods: ['booking', 'email', 'pass'] },
  { code: 'AF', name: 'Air France', methods: ['booking', 'email', 'pass'] },
  { code: 'KL', name: 'KLM', methods: ['booking', 'email', 'pass'] },
  { code: 'BA', name: 'British Airways', methods: ['booking', 'email', 'pass'] },
  { code: 'EK', name: 'Emirates', methods: ['booking', 'email', 'pass'] },
];

/** Typical fare bundles used by the mock API to build realistic allowances. Real data comes from the booking. */
export function sampleBaggage(airlineCode: string, seed: number): { fareName: string; baggage: BaggageAllowance } {
  const lowCost = ['W6', 'FR', 'U2', 'H4'].includes(airlineCode);
  const tier = seed % 3;
  const personal = (dims: [number, number, number]): BagItem => ({ label: 'Personal item', dimensionsCm: dims, count: 1, included: true });
  const bag = (label: string, d: [number, number, number], maxKg: number, count = 1): BagItem => ({ label, dimensionsCm: d, maxKg, count, included: true });
  const pick = (list: { fareName: string; baggage: BaggageAllowance }[]) => list[tier];
  if (lowCost) {
    const dims: [number, number, number] = airlineCode === 'FR' ? [40, 20, 25] : airlineCode === 'U2' ? [45, 36, 20] : [40, 30, 20];
    return pick([
      { fareName: 'Basic', baggage: { personalItem: personal(dims), cabinBag: null, checked: [], notes: ['Must fit under the seat in front of you.', 'Larger cabin bags are charged at the gate.'], source: 'airline' as const } },
      { fareName: 'Priority', baggage: { personalItem: personal(dims), cabinBag: bag('Cabin trolley', [55, 40, 23], 10), checked: [], notes: ['Priority boarding included.'], source: 'airline' as const } },
      { fareName: 'Plus', baggage: { personalItem: personal(dims), cabinBag: bag('Cabin trolley', [55, 40, 23], 10), checked: [bag('Checked bag', [149, 119, 171], 20)], notes: ['Free online check-in and seat selection.'], source: 'airline' as const } },
    ]);
  }
  return pick([
    { fareName: 'Economy Light', baggage: { personalItem: personal([40, 30, 15]), cabinBag: bag('Cabin bag', [55, 40, 23], 8), checked: [], notes: [], source: 'airline' as const } },
    { fareName: 'Economy Classic', baggage: { personalItem: personal([40, 30, 15]), cabinBag: bag('Cabin bag', [55, 40, 23], 8), checked: [bag('Checked bag', [158, 0, 0], 23)], notes: ['Checked bag: up to 158 cm total (L+W+H).'], source: 'airline' as const } },
    { fareName: 'Economy Flex', baggage: { personalItem: personal([40, 30, 15]), cabinBag: bag('Cabin bag', [55, 40, 23], 8), checked: [bag('Checked bag', [158, 0, 0], 23, 2)], notes: ['Free changes before departure.'], source: 'airline' as const } },
  ]);
}
