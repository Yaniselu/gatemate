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
  const tf = normalizeName(ticketFirst).replace(/ /g, '');
  const lf = normalizeName(legalFirst).replace(/ /g, '');
  const lastNameOk = !!tl && !!ll && (tl === ll || (tl.length >= 8 && ll.startsWith(tl)));
  const firstNameOk = !!tf && !!lf && (tf === lf || lf.startsWith(tf) || tf.startsWith(lf));
  return { ok: lastNameOk && firstNameOk, lastNameOk, firstNameOk };
}
