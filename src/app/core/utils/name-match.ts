const TITLES = /\b(MR|MRS|MS|MISS|MSTR|DR|PROF|CHD|INF)\b/g;

export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z /]/g, ' ')
    .replace(TITLES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface NameMatch {
  ok: boolean;
  lastNameOk: boolean;
  firstNameOk: boolean;
}

export function matchPassengerName(ticketFirst: string, ticketLast: string, legalFirst: string, legalLast: string): NameMatch {
  const tl = normalizeName(ticketLast).replace(/ /g, '');
  const ll = normalizeName(legalLast).replace(/ /g, '');
  const tf = firstOnTicket(ticketFirst);
  const lf = normalizeName(legalFirst).replace(/ /g, '');
  const lastNameOk = !!tl && !!ll && (tl === ll || (tl.length >= 8 && ll.startsWith(tl)));
  const firstNameOk = !!tf && !!lf && (tf === lf || lf.startsWith(tf) || tf.startsWith(lf));
  if (lastNameOk && firstNameOk) return { ok: true, lastNameOk, firstNameOk };
  if (anyOrder(ticketFirst, ticketLast, legalFirst, legalLast)) return { ok: true, lastNameOk: true, firstNameOk: true };
  return { ok: false, lastNameOk, firstNameOk };
}

function anyOrder(ticketFirst: string, ticketLast: string, legalFirst: string, legalLast: string): boolean {
  const legal = normalizeName(`${legalFirst ?? ''} ${legalLast ?? ''}`).split(/[ /]+/).filter(Boolean);
  const lastWords = normalizeName(ticketLast ?? '').split(/[ /]+/).filter(Boolean);
  if (legal.length < 2 || !lastWords.length) return false;
  for (const w of lastWords) {
    const i = legal.indexOf(w);
    if (i < 0) return false;
    legal.splice(i, 1);
  }
  const rest = legal.join('');
  const tf = normalizeName(ticketFirst ?? '').replace(/ /g, '');
  return !!rest && !!tf && (tf === rest || tf.startsWith(rest) || rest.startsWith(tf));
}

export function firstOnTicket(first: string): string {
  const f = normalizeName(first ?? '').replace(/ /g, '');
  const cut = f.replace(/(MRS|MSTR|MISS|MR|MS|DR|CHD|INF)$/, '');
  return cut.length >= 2 ? cut : f;
}

export function nameQuality(ticketFirst: string, ticketLast: string, legalFirst?: string, legalLast?: string): number {
  if (!legalFirst || !legalLast) return 0;
  const tl = normalizeName(ticketLast).replace(/ /g, ''), ll = normalizeName(legalLast).replace(/ /g, '');
  const tf = firstOnTicket(ticketFirst), lf = normalizeName(legalFirst).replace(/ /g, '');
  if (tl && tl === ll && tf && tf === lf) return 3 + lf.length;
  return matchPassengerName(ticketFirst, ticketLast, legalFirst, legalLast).ok ? 1 : 0;
}
