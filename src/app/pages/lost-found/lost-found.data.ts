import type { LostKind } from '../../core/services/lost-found.service';

export interface LostGuide {
  kind: LostKind;
  icon: string;
  color: string;
  title: string;
  short: string;
  steps: string[];
  facts: string[];
  refLabel: string;
  refHint: string;
  itemHint: string;
}

export const LOST_GUIDES: LostGuide[] = [
  {
    kind: 'delayed',
    icon: 'bag-handle-outline',
    color: '#F59E0B',
    title: 'My checked bag didn’t arrive',
    short: 'Delayed or lost luggage',
    steps: [
      'Don’t leave the baggage hall: go to the airline’s baggage desk (Lost & Found) right away.',
      'File a Property Irregularity Report (PIR) and keep the copy. Its file reference (like CRAW612345) is how your bag is traced.',
      'Describe the bag precisely: brand, colour, size, name tag and something distinctive inside. Give an address for delivery.',
      'Buy only what you need, like toiletries and a change of clothes, and keep every receipt: reasonable costs must be refunded.',
      'Track it on the airline’s website with the file reference. Most bags turn up within 48 hours.',
      'Once it’s delivered, send your written claim for the costs within 21 days.',
    ],
    facts: ['21 days to claim delay costs', 'After 21 days it counts as lost', 'Up to about €1,800 per passenger'],
    refLabel: 'File reference (PIR)',
    refHint: 'CRAW612345',
    itemHint: 'Black Samsonite suitcase, 68 cm',
  },
  {
    kind: 'damaged',
    icon: 'construct-outline',
    color: '#EF4444',
    title: 'My bag arrived damaged or with items missing',
    short: 'Damage or missing contents',
    steps: [
      'Report it at the baggage desk before you leave the airport and ask for a damage report.',
      'Photograph the damage and the bag tag before you repair or throw anything away.',
      'Send a written complaint to the airline within 7 days of getting the bag.',
      'Add repair quotes or the purchase receipt so they can value the loss.',
      'Fragile items and valuables in checked bags are often excluded: check the airline’s conditions.',
    ],
    facts: ['7 days for a written complaint', 'Missing items count as damage', 'Keep photos and receipts'],
    refLabel: 'Damage report number',
    refHint: 'CRAW612345',
    itemHint: 'Grey suitcase, broken wheel',
  },
  {
    kind: 'plane',
    icon: 'airplane-outline',
    color: '#6366F1',
    title: 'I left something on the plane',
    short: 'Phone, jacket, headphones…',
    steps: [
      'Still at the gate? Tell the crew or gate staff straight away: cleaning starts within minutes.',
      'Once you’ve left, use the airline’s lost property form. Give the flight number, date and your seat.',
      'Describe the item precisely and add a photo if you have one.',
      'Items are kept at the airport where the plane landed, usually for 30 to 90 days.',
      'Lost a phone, passport or wallet? Lock the phone remotely and report lost documents to the police and your embassy.',
    ],
    facts: ['Your seat number speeds up the search', 'Usually kept 30–90 days'],
    refLabel: 'Case number from the airline',
    refHint: 'LF-102938',
    itemHint: 'AirPods Pro in a white case',
  },
  {
    kind: 'airport',
    icon: 'business-outline',
    color: '#0EA5E9',
    title: 'I lost something at the airport',
    short: 'Terminal, security, gate',
    steps: [
      'Go back to where you lost it, or ask the nearest information desk.',
      'Before security: the airport’s lost property office. After security or at the gate: the airline or its ground handler.',
      'Leave your phone number, e-mail and a precise description.',
      'Lost a passport or ID? Report it to the airport police and contact your embassy for an emergency travel document.',
      'Many airports have an online lost & found form on their website.',
    ],
    facts: ['Ask at the information desk first', 'Report lost documents to the police'],
    refLabel: 'Case number',
    refHint: 'LF-102938',
    itemHint: 'Blue backpack with a laptop',
  },
];
