export type Availability = true | false | 'taxi';

export interface RideApps {
  uber?: Availability;
  bolt?: Availability;
  local?: string[];
}

const GRAB: RideApps = { uber: false, bolt: false, local: ['Grab'] };
const CAREEM: RideApps = { uber: true, bolt: false, local: ['Careem'] };
const LATAM: RideApps = { uber: true, bolt: false, local: ['DiDi', 'Cabify'] };
const BOTH: RideApps = { uber: true, bolt: true };

export const RIDE_APPS: Record<string, RideApps> = {
  RO: { uber: true, bolt: true, local: ['Star Taxi'] },
  BG: { uber: false, bolt: true, local: ['TaxiMe'] },
  HU: { uber: false, bolt: true, local: ['Főtaxi'] },
  GR: { uber: 'taxi', bolt: 'taxi', local: ['FreeNow'] },
  IT: { uber: 'taxi', bolt: false, local: ['itTaxi', 'FreeNow'] },
  ES: { uber: true, bolt: true, local: ['Cabify', 'FreeNow'] },
  PT: { uber: true, bolt: true, local: ['FreeNow'] },
  FR: { uber: true, bolt: true, local: ['G7', 'Heetch'] },
  DE: { uber: true, bolt: true, local: ['FreeNow'] },
  AT: BOTH,
  NL: BOTH,
  BE: BOTH,
  GB: { uber: true, bolt: true, local: ['FreeNow'] },
  IE: { uber: 'taxi', bolt: 'taxi', local: ['FreeNow'] },
  PL: { uber: true, bolt: true, local: ['FreeNow', 'iTaxi'] },
  CZ: { uber: true, bolt: true, local: ['Liftago'] },
  SK: BOTH,
  HR: BOTH,
  SE: BOTH,
  FI: BOTH,
  EE: BOTH,
  LV: BOTH,
  LT: BOTH,
  MT: { uber: true, bolt: true, local: ['eCabs'] },
  DK: { uber: false, local: ['Dantaxi'] },
  IS: { uber: false, bolt: false, local: ['Hreyfill'] },
  TR: { uber: 'taxi', bolt: false, local: ['BiTaksi'] },
  UA: { uber: true, bolt: true, local: ['Uklon'] },
  RU: { uber: false, bolt: false, local: ['Yandex Go'] },
  BY: { uber: false, bolt: false, local: ['Yandex Go'] },
  CN: { uber: false, bolt: false, local: ['DiDi'] },
  JP: { uber: 'taxi', bolt: false, local: ['GO', 'S.RIDE'] },
  KR: { uber: 'taxi', bolt: false, local: ['Kakao T'] },
  SG: GRAB,
  MY: GRAB,
  TH: GRAB,
  VN: GRAB,
  PH: GRAB,
  KH: GRAB,
  ID: { uber: false, bolt: false, local: ['Grab', 'Gojek'] },
  IN: { uber: true, bolt: false, local: ['Ola', 'Rapido'] },
  AE: CAREEM,
  SA: CAREEM,
  QA: CAREEM,
  KW: CAREEM,
  JO: CAREEM,
  PK: CAREEM,
  EG: { uber: true, bolt: false, local: ['Careem', 'inDrive'] },
  MA: { uber: false, bolt: false, local: ['Careem', 'inDrive'] },
  TN: { uber: false, bolt: true },
  IL: { bolt: false, local: ['Gett'] },
  US: { uber: true, bolt: false, local: ['Lyft'] },
  CA: { uber: true, bolt: false, local: ['Lyft'] },
  MX: LATAM,
  AR: LATAM,
  CO: LATAM,
  CL: LATAM,
  PE: LATAM,
  BR: { uber: true, bolt: false, local: ['99'] },
  AU: { uber: true, bolt: false, local: ['DiDi'] },
  ZA: BOTH,
  NG: BOTH,
  KE: BOTH,
  GH: BOTH,
};

export function rideApps(country: string | undefined): RideApps | undefined {
  return country ? RIDE_APPS[country.toUpperCase()] : undefined;
}
