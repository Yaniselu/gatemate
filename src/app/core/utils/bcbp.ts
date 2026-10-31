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
    flightDate: dateFromJulian(julianDate, today, issueDate(data, today)),
    cabinCode: field(47, 1),
    seat: seatRaw.replace(/^0+/, ''),
    sequence: field(52, 5).replace(/^0+/, ''),
  };
}

function dateFromJulian(day: number, today: Date, issued: Date | null): Date {
  const at = (year: number) => new Date(Date.UTC(year, 0, Math.min(day, isLeap(year) ? 366 : 365)));
  const y = today.getUTCFullYear();
  if (issued) {
    const same = at(issued.getUTCFullYear());
    return same.getTime() >= issued.getTime() - 864e5 ? same : at(issued.getUTCFullYear() + 1);
  }
  return [at(y - 1), at(y), at(y + 1)].sort((a, b) => Math.abs(a.getTime() - today.getTime()) - Math.abs(b.getTime() - today.getTime()))[0];
}

function issueDate(raw: string, today: Date): Date | null {
  if (raw.length < 71 || raw[60] !== '>') return null;
  const field = raw.slice(67, 71);
  if (!/^\d{4}$/.test(field)) return null;
  const digit = +field[0], julian = +field.slice(1);
  if (julian < 1 || julian > 366) return null;
  let year = today.getUTCFullYear() - ((today.getUTCFullYear() % 10) - digit + 10) % 10;
  if (year > today.getUTCFullYear()) year -= 10;
  return new Date(Date.UTC(year, 0, julian));
}

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
