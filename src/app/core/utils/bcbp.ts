export interface BoardingPassData {
  passengerName: string;
  firstName: string;
  lastName: string;
  raw: string;
  bookingRef: string;
  from: string;
  to: string;
  carrier: string;
  flightNumber: string;
  julianDate: number;
  flightDate: Date;
  cabinCode: string;
  seat: string;
  sequence: string;
}

export class BcbpError extends Error {}

export function parseBcbp(raw: string, today = new Date()): BoardingPassData {
  const data = raw.replace(/\r?\n/g, '');
  if (data.length < 60 || data[0] !== 'M') throw new BcbpError('This code is not a boarding pass.');
  const field = (start: number, len: number) => data.substr(start, len).trim();

  const from = field(30, 3);
  const to = field(33, 3);
  const julianDate = parseInt(field(44, 3), 10);
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !(julianDate >= 1 && julianDate <= 366)) {
    throw new BcbpError('The boarding pass could not be read. Try again or add it manually.');
  }

  const [last = '', first = ''] = field(2, 20).split('/');
  const seatRaw = field(48, 4);
  return {
    passengerName: titleCase(`${first.trim().replace(/\s*(MRS|MSTR|MISS|MR|MS|DR|CHD|INF)$/, '') || first} ${last}`.trim()),
    firstName: first.trim(),
    lastName: last.trim(),
    raw: data,
    bookingRef: field(23, 7),
    from,
    to,
    carrier: field(36, 3),
    flightNumber: field(39, 5).replace(/^0+/, ''),
    julianDate,
    flightDate: dateFromJulian(julianDate, today),
    cabinCode: field(47, 1),
    seat: seatRaw.replace(/^0+/, ''),
    sequence: field(52, 5).replace(/^0+/, ''),
  };
}

function dateFromJulian(day: number, today: Date): Date {
  const candidate = (year: number) => new Date(Date.UTC(year, 0, day));
  const thisYear = candidate(today.getUTCFullYear());
  const sixtyDays = 60 * 864e5;
  return thisYear.getTime() < today.getTime() - sixtyDays ? candidate(today.getUTCFullYear() + 1) : thisYear;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
