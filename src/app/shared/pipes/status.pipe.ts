import { Pipe, PipeTransform } from '@angular/core';
import { FlightStatus } from '../../core/models';
import { t } from '../../core/i18n/i18n.service';

const LABELS: Record<FlightStatus, string> = {
  scheduled: 'Scheduled',
  'on-time': 'On time',
  boarding: 'Boarding',
  delayed: 'Delayed',
  departed: 'Departed',
  landed: 'Landed',
  cancelled: 'Cancelled',
};

@Pipe({ name: 'flightStatus' })
export class FlightStatusPipe implements PipeTransform {
  transform(status: FlightStatus): string {
    return t(LABELS[status] ?? status);
  }
}
