import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'relTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | number | Date | undefined | null): string {
    if (!value) return '';
    const diff = Date.now() - new Date(value).getTime();
    const abs = Math.abs(diff);
    const future = diff < 0;
    const fmt = (n: number, unit: string) => (future ? `in ${n}${unit}` : `${n}${unit} ago`);
    if (abs < 60_000) return 'now';
    if (abs < 3_600_000) return fmt(Math.round(abs / 60_000), 'm');
    if (abs < 86_400_000) return fmt(Math.round(abs / 3_600_000), 'h');
    if (abs < 7 * 86_400_000) return fmt(Math.round(abs / 86_400_000), 'd');
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}

@Pipe({ name: 'clock' })
export class ClockPipe implements PipeTransform {
  transform(value: string | undefined | null, timeZone?: string): string {
    if (!value) return '--:--';
    return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
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
  /** Pass the airport's time zone for flight dates so a 23:50 departure isn't shown on the wrong day. */
  transform(value: string | undefined | null, withWeekday = true, timeZone?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-GB', { weekday: withWeekday ? 'short' : undefined, day: 'numeric', month: 'short', timeZone });
  }
}
