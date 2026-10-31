export interface CabinLayout {
  cols: string[];
  rows: number;
  exits: number[];
  wing: [number, number];
}

export interface AircraftModel {
  code: string;
  name: string;
  match: RegExp;
  cabin: CabinLayout;
}

const N6 = ['A', 'B', 'C', '|', 'D', 'E', 'F'];
const R4 = ['A', 'C', '|', 'D', 'F'];

export const AIRCRAFT: AircraftModel[] = [
  { code: 'A388', name: 'Airbus A380', match: /A38|A380/, cabin: { cols: ['A', 'B', 'C', '|', 'D', 'E', 'F', 'G', '|', 'H', 'J', 'K'], rows: 88, exits: [1, 25, 45, 70, 88], wing: [38, 58] } },
  { code: 'B77W', name: 'Boeing 777-300ER', match: /B77W|B773|777-3|777/, cabin: { cols: ['A', 'B', 'C', '|', 'D', 'E', 'F', 'G', '|', 'H', 'J', 'K'], rows: 52, exits: [1, 15, 33, 52], wing: [20, 32] } },
  { code: 'B789', name: 'Boeing 787-9', match: /B78|787/, cabin: { cols: ['A', 'B', 'C', '|', 'D', 'E', 'F', '|', 'H', 'J', 'K'], rows: 45, exits: [1, 14, 30, 45], wing: [17, 28] } },
  { code: 'A359', name: 'Airbus A350-900', match: /A35|A350/, cabin: { cols: ['A', 'B', 'C', '|', 'D', 'E', 'F', '|', 'H', 'J', 'K'], rows: 46, exits: [1, 14, 31, 46], wing: [17, 29] } },
  { code: 'A333', name: 'Airbus A330', match: /A33|A330/, cabin: { cols: ['A', 'C', '|', 'D', 'E', 'F', 'G', '|', 'H', 'K'], rows: 44, exits: [1, 13, 28, 44], wing: [16, 27] } },
  { code: 'B763', name: 'Boeing 767', match: /B76|767/, cabin: { cols: ['A', 'C', '|', 'D', 'E', 'F', '|', 'H', 'K'], rows: 40, exits: [1, 14, 40], wing: [15, 24] } },
  { code: 'A21N', name: 'Airbus A321neo', match: /A21N|A321NEO|A321-2[57]1N|A321 ?NEO/, cabin: { cols: N6, rows: 40, exits: [1, 12, 13, 26, 40], wing: [11, 22] } },
  { code: 'A321', name: 'Airbus A321', match: /A321|A21/, cabin: { cols: N6, rows: 36, exits: [1, 10, 11, 24, 36], wing: [10, 20] } },
  { code: 'A20N', name: 'Airbus A320neo', match: /A20N|A320NEO|A320 ?NEO/, cabin: { cols: N6, rows: 31, exits: [1, 12, 13, 31], wing: [10, 18] } },
  { code: 'A320', name: 'Airbus A320', match: /A320|A32/, cabin: { cols: N6, rows: 30, exits: [1, 11, 12, 30], wing: [9, 17] } },
  { code: 'A319', name: 'Airbus A319', match: /A319|A19N|A31/, cabin: { cols: N6, rows: 26, exits: [1, 10, 26], wing: [8, 15] } },
  { code: 'BCS3', name: 'Airbus A220-300', match: /BCS3|A220-3|A223|A220/, cabin: { cols: ['A', 'C', '|', 'D', 'E', 'F'], rows: 29, exits: [1, 11, 12, 29], wing: [9, 17] } },
  { code: 'B38M', name: 'Boeing 737 MAX 8', match: /B38M|737 ?MAX ?8|7M8/, cabin: { cols: N6, rows: 33, exits: [1, 16, 17, 33], wing: [12, 20] } },
  { code: 'B39M', name: 'Boeing 737 MAX 9', match: /B39M|737 ?MAX ?9|7M9/, cabin: { cols: N6, rows: 36, exits: [1, 15, 16, 36], wing: [13, 22] } },
  { code: 'B739', name: 'Boeing 737-900', match: /B739|737-9/, cabin: { cols: N6, rows: 36, exits: [1, 15, 16, 36], wing: [13, 22] } },
  { code: 'B737', name: 'Boeing 737-700', match: /B737|737-7/, cabin: { cols: N6, rows: 24, exits: [1, 12, 24], wing: [9, 15] } },
  { code: 'B738', name: 'Boeing 737-800', match: /B738|737-8|737/, cabin: { cols: N6, rows: 32, exits: [1, 16, 17, 32], wing: [12, 20] } },
  { code: 'E195', name: 'Embraer 195', match: /E195|E95|ERJ-?195|E295/, cabin: { cols: R4, rows: 30, exits: [1, 12, 30], wing: [10, 17] } },
  { code: 'E190', name: 'Embraer 190', match: /E190|E90|ERJ-?190|E290/, cabin: { cols: R4, rows: 25, exits: [1, 10, 25], wing: [9, 15] } },
  { code: 'CRJ9', name: 'Bombardier CRJ900', match: /CRJ/, cabin: { cols: R4, rows: 22, exits: [1, 22], wing: [8, 13] } },
  { code: 'DH8D', name: 'De Havilland Dash 8-400', match: /DH8|Q400|DASH/, cabin: { cols: R4, rows: 20, exits: [1, 20], wing: [6, 10] } },
  { code: 'AT76', name: 'ATR 72-600', match: /AT7|ATR ?72|AT76|AT75/, cabin: { cols: R4, rows: 18, exits: [1, 18], wing: [3, 6] } },
];

const TYPICAL: Record<string, string> = {
  W6: 'A21N', W4: 'A21N', W9: 'A21N', '5W': 'A21N',
  FR: 'B38M', RK: 'B738', AL: 'B38M',
  RO: 'B738', H4: 'A320', '0B': 'A320',
  U2: 'A320', EC: 'A320', DS: 'A320',
  LH: 'A320', OS: 'A320', LX: 'BCS3', SN: 'A320', EW: 'A320', '4U': 'A320',
  AF: 'A320', KL: 'B738', BA: 'A320', IB: 'A320', VY: 'A320', AZ: 'A20N', TP: 'A20N', LO: 'B38M', OK: 'A320', A3: 'A320', OA: 'A320',
  TK: 'A321', PC: 'A20N', DY: 'B738', D8: 'B738', SK: 'A20N', AY: 'A321', EI: 'A320', FB: 'A220', JU: 'A319', OU: 'A320', JP: 'A320',
  EK: 'B77W', QR: 'B789', EY: 'B789', LY: 'B738', MS: 'A20N', SV: 'A321',
  AA: 'A321', DL: 'A321', UA: 'B739', B6: 'A20N', WN: 'B38M', AC: 'A320',
};

export function aircraftFor(type: string | undefined, airlineCode: string | undefined): { model: AircraftModel; exact: boolean } | null {
  const t = (type ?? '').toUpperCase().trim();
  if (t) {
    const m = AIRCRAFT.find((a) => a.code === t) ?? AIRCRAFT.find((a) => a.match.test(t));
    if (m) return { model: m, exact: true };
  }
  const typical = TYPICAL[(airlineCode ?? '').toUpperCase()];
  const m = typical ? AIRCRAFT.find((a) => a.code === typical || a.match.test(typical)) : undefined;
  return m ? { model: m, exact: false } : null;
}
