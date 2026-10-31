
export const MAX_MESSAGE_LENGTH = 1000;

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+/i;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/;
const BLOCKED_WORDS = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot', 'retard', 'whore'];
const BLOCKED_RE = new RegExp(`\\b(${BLOCKED_WORDS.join('|')})\\w*`, 'gi');

export function cleanText(input: string, maxLength = MAX_MESSAGE_LENGTH): string {
  return input.replace(CONTROL_RE, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLength);
}

export function containsLink(text: string): boolean {
  return URL_RE.test(text);
}

export function containsSensitiveNumber(text: string): boolean {
  const match = text.match(CARD_RE);
  if (!match) return false;
  const digits = match[0].replace(/\D/g, '');
  return luhn(digits);
}

export function maskProfanity(text: string): { text: string; flagged: boolean } {
  let flagged = false;
  const masked = text.replace(BLOCKED_RE, (w) => {
    flagged = true;
    return w[0] + '•'.repeat(w.length - 1);
  });
  return { text: masked, flagged };
}

function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = +digits[i];
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}
