import { Pipe, PipeTransform } from '@angular/core';
import { FlightStatus } from '../../core/models';

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
    return LABELS[status] ?? status;
  }
}
