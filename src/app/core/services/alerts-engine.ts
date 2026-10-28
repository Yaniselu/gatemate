import { Flight, FlightAlert, Trip } from '../models';

const H = 3600_000;
const SCHENGEN = new Set(['AT', 'BE', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH']);

export interface EngineContext {
  now: number;
  countryOf: (iata: string) => string | undefined;
  /** km from the user to the departure airport, if location is known. */
  kmToAirport?: (iata: string) => number | undefined;
  /** Weather code forecast for the arrival day, if known. */
  arrivalWeather?: (trip: Trip) => number | undefined;
}

/**
 * Builds reminders from the user's own trips. Each alert has a stable id so read/dismissed state
 * survives refreshes. Live gate/delay changes come from the server as push notifications.
 */
export function buildAlerts(trips: Trip[], ctx: EngineContext): FlightAlert[] {
  const out: FlightAlert[] = [];
  const iso = (t: number) => new Date(t).toISOString();
  for (const trip of trips) {
    for (const f of trip.flights) {
      const dep = new Date(f.departure).getTime();
      const board = new Date(f.boardingTime).getTime();
      if (dep < ctx.now - 2 * H || dep - ctx.now > 14 * 24 * H) continue;
      const fromC = ctx.countryOf(f.from.code), toC = ctx.countryOf(f.to.code);
      const schengen = !!fromC && !!toC && SCHENGEN.has(fromC) && SCHENGEN.has(toC);
      const base = { flightId: f.id, tripId: trip.id, read: false, source: 'device' as const };

      out.push({ ...base, id: `checkin-${f.id}`, kind: 'checkin', title: `Check-in opens · ${f.number}`, body: `Most airlines open online check-in 24–48 h before departure. Check in early to keep your seat${f.seat ? ` (${f.seat})` : ''}.`, createdAt: iso(dep - 24 * H), scheduledFor: iso(dep - 24 * H) });

      out.push({ ...base, id: `docs-${f.id}`, kind: 'documents', title: schengen ? 'ID card or passport' : 'Passport & entry rules', body: schengen ? `${f.from.city} → ${f.to.city} is inside the Schengen area: a valid ID card or passport is required.` : `Check passport validity and visa or eTA requirements for ${f.to.city} on your government’s travel advice page.`, createdAt: iso(dep - 72 * H), scheduledFor: iso(dep - 72 * H) });

      if (f.baggage && !f.baggage.cabinBag) {
        const d = f.baggage.personalItem.dimensionsCm.join(' × ');
        out.push({ ...base, id: `bags-${f.id}`, kind: 'bags', title: 'Only a personal item is included', body: `Your ${f.fareName ?? ''} fare allows one bag up to ${d} cm under the seat. Adding a bag online is cheaper than at the gate.`, createdAt: iso(dep - 48 * H), scheduledFor: iso(dep - 48 * H) });
      }

      const undone = trip.checklist.filter((c) => !c.done).length;
      if (undone) {
        out.push({ ...base, id: `check-${f.id}`, kind: 'checklist', title: `${undone} thing${undone > 1 ? 's' : ''} left on your checklist`, body: trip.checklist.filter((c) => !c.done).map((c) => c.label).slice(0, 3).join(' · '), createdAt: iso(dep - 36 * H), scheduledFor: iso(dep - 36 * H) });
      }

      const km = ctx.kmToAirport?.(f.from.code);
      const t = arrivalPlan(f, schengen, km);
      out.push({ ...base, id: `leave-${f.id}`, kind: 'leave', title: 'Time to leave for the airport', body: `Leave around ${clock(t.leaveAt, f.from.timezone)} to be at ${f.from.code} ${t.arriveBeforeH} h before departure${km !== undefined ? ` (≈${t.driveMin} min drive)` : ''}. Estimate — check traffic.`, createdAt: iso(t.leaveAt), scheduledFor: iso(t.leaveAt) });

      out.push({ ...base, id: `boarding-${f.id}`, kind: 'boarding', title: `Boarding in 15 minutes · ${f.number}`, body: `Gate ${f.gate ?? 'TBA'}${f.seat ? ` · Seat ${f.seat}` : ''}. Have your boarding pass and ID ready.`, createdAt: iso(board - 15 * 60_000), scheduledFor: iso(board - 15 * 60_000) });

      const code = ctx.arrivalWeather?.(trip);
      if (code !== undefined && code >= 51) {
        const snow = code >= 71 && code <= 86;
        out.push({ ...base, id: `wx-${f.id}`, kind: 'weather', title: snow ? `Snow expected in ${f.to.city}` : `Rain expected in ${f.to.city}`, body: snow ? 'Pack warm layers and allow extra time for transfers.' : 'Pack an umbrella or a light rain jacket.', createdAt: iso(dep - 24 * H), scheduledFor: iso(dep - 24 * H) });
      }
    }
  }
  return out;
}

/** When to be at the airport and when to leave: 2 h inside Schengen, 3 h otherwise, plus the drive. */
function arrivalPlan(f: Flight, schengen: boolean, km: number | undefined) {
  const dep = new Date(f.departure).getTime();
  const arriveBeforeH = schengen ? 2 : 3;
  const driveMin = km !== undefined ? Math.max(10, Math.round((km / 45) * 60)) : 45; // conservative 45 km/h city average
  const arriveAt = dep - arriveBeforeH * H;
  return { arriveBeforeH, driveMin, arriveAt, leaveAt: arriveAt - driveMin * 60_000 };
}

export interface DayStep {
  id: 'leave' | 'arrive' | 'bagdrop' | 'security' | 'boarding' | 'gateclose' | 'takeoff' | 'landing';
  title: string;
  detail: string;
  icon: string;
  at: number;
}

/**
 * The flight day as a timeline, from leaving home to landing. Times are typical airline cut-offs;
 * the airline's own times (boarding) are used when we have them.
 */
export function airportDay(f: Flight, ctx: Pick<EngineContext, 'countryOf' | 'kmToAirport'>): DayStep[] {
  const dep = new Date(f.departure).getTime();
  const fromC = ctx.countryOf(f.from.code), toC = ctx.countryOf(f.to.code);
  const schengen = !!fromC && !!toC && SCHENGEN.has(fromC) && SCHENGEN.has(toC);
  const km = ctx.kmToAirport?.(f.from.code);
  const p = arrivalPlan(f, schengen, km);
  const checked = !!f.baggage?.checked.length;
  const steps: DayStep[] = [
    { id: 'leave', title: 'Leave for the airport', detail: km !== undefined ? `≈${p.driveMin} min to ${f.from.code} from where you are` : 'Allow about 45 min — check traffic', icon: 'car-outline', at: p.leaveAt },
    { id: 'arrive', title: `Arrive at ${f.from.code}`, detail: `${p.arriveBeforeH} h before departure${f.terminal ? ` · Terminal ${f.terminal}` : ''}`, icon: 'business-outline', at: p.arriveAt },
  ];
  if (checked) steps.push({ id: 'bagdrop', title: 'Bag drop closes', detail: 'Usually 40–60 min before departure', icon: 'cube-outline', at: dep - 45 * 60_000 });
  steps.push(
    { id: 'security', title: schengen ? 'Security' : 'Security & passport control', detail: schengen ? 'Liquids out, laptop ready' : 'Have your passport and boarding pass ready', icon: 'shield-checkmark-outline', at: p.arriveAt + 20 * 60_000 },
    { id: 'boarding', title: 'Boarding starts', detail: `Gate ${f.gate ?? 'shown ~40 min before'}${f.seat ? ` · Seat ${f.seat}` : ''}`, icon: 'people-outline', at: new Date(f.boardingTime).getTime() },
    { id: 'gateclose', title: 'Gate closes', detail: 'Usually 15–20 min before departure', icon: 'lock-closed-outline', at: dep - 15 * 60_000 },
    { id: 'takeoff', title: `Take-off · ${f.number}`, detail: `${f.from.city} → ${f.to.city}`, icon: 'airplane', at: dep },
    { id: 'landing', title: `Land in ${f.to.city}`, detail: 'Local time at arrival', icon: 'flag-outline', at: new Date(f.arrival).getTime() },
  );
  return steps.sort((a, b) => a.at - b.at);
}

function clock(t: number, timeZone?: string) {
  try {
    return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
  } catch {
    return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
}
