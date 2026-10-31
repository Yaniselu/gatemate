import { Pipe, PipeTransform } from '@angular/core';
import { locale } from '../../core/i18n/i18n.service';

@Pipe({ name: 'relTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | number | Date | undefined | null): string {
    if (!value) return '';
    const diff = new Date(value).getTime() - Date.now();
    const abs = Math.abs(diff);
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto', style: 'narrow' });
    if (abs < 60_000) return rtf.format(0, 'second');
    if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
    if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
    if (abs < 7 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), 'day');
    return new Date(value).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  }
}

@Pipe({ name: 'clock' })
export class ClockPipe implements PipeTransform {
  transform(value: string | undefined | null, timeZone?: string): string {
    if (!value) return '--:--';
    return new Date(value).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', timeZone });
  }
}

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
  }
}

@Pipe({ name: 'shortDate' })
export class ShortDatePipe implements PipeTransform {
  transform(value: string | undefined | null, withWeekday = true, timeZone?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString(locale(), { weekday: withWeekday ? 'short' : undefined, day: 'numeric', month: 'short', timeZone });
  }
}
