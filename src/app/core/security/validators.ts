import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// RFC 5322-lite: strict enough to reject garbage, loose enough for real addresses.
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M}' .-]{1,59}$/u;
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456789', '1234567890', 'qwertyuiop', 'iloveyou1',
  'admin12345', 'welcome123', 'letmein123', 'football1', 'gatemate1', 'gatemate123',
]);

export const MIN_PASSWORD_LENGTH = 10;

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

export const emailValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  if (!v) return null;
  return isEmail(v) ? null : { email: true };
};

export const nameValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  if (!v) return null;
  return NAME_RE.test(v) ? null : { name: true };
};

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Strong' | 'Excellent';
  checks: { length: boolean; lower: boolean; upper: boolean; digit: boolean; symbol: boolean };
}

export function passwordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= MIN_PASSWORD_LENGTH,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  let points = Object.values(checks).filter(Boolean).length;
  if (password.length >= 14) points++;
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || /(.)\1{3,}/.test(password)) points = Math.min(points, 1);
  const score = Math.max(0, Math.min(4, points - 2)) as PasswordStrength['score'];
  const labels: PasswordStrength['label'][] = ['Too weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
  return { score, label: labels[score], checks };
}

/** Requires length, mixed case, a digit and a symbol, and rejects common passwords. */
export const strongPasswordValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '');
  if (!v) return null;
  if (v.length > 128) return { passwordTooLong: true };
  const { checks } = passwordStrength(v);
  if (!Object.values(checks).every(Boolean)) return { weakPassword: true };
  if (COMMON_PASSWORDS.has(v.toLowerCase())) return { commonPassword: true };
  return null;
};

/** Group-level validator: password must not contain the e-mail's local part. */
export function passwordNotContainingEmail(passwordKey: string, emailKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const pw = String(group.get(passwordKey)?.value ?? '').toLowerCase();
    const local = String(group.get(emailKey)?.value ?? '').split('@')[0].toLowerCase();
    return local.length >= 3 && pw.includes(local) ? { passwordContainsEmail: true } : null;
  };
}
