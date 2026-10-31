import { Trip } from '../models';
import { CARD_FONT, loadImage, roundRect } from './share-image';

export async function renderTripCard(trip: Trip, photoUrl: string | undefined, now = Date.now()): Promise<HTMLCanvasElement> {
  const photo = photoUrl ? await loadCorsImage(photoUrl) : null;
  try {
    return await draw(trip, photo, now);
  } catch {
    return draw(trip, null, now);
  }
}

async function draw(trip: Trip, photo: HTMLImageElement | null, now: number): Promise<HTMLCanvasElement> {
  const W = 1080, H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const font = (w: number, px: number) => `${w} ${px}px ${CARD_FONT}`;

  if (photo) {
    const s = Math.max(W / photo.width, H / photo.height);
    ctx.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#5fd6df');
    g.addColorStop(0.5, '#0fb5c3');
    g.addColorStop(1, '#064e5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.font = font(900, 520);
    ctx.fillText(trip.destination.code, -30, H * 0.42);
  }
  const shade = ctx.createLinearGradient(0, H * 0.35, 0, H);
  shade.addColorStop(0, 'rgba(4,20,30,0)');
  shade.addColorStop(1, 'rgba(4,20,30,.82)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(4,20,30,.28)';
  ctx.fillRect(0, 0, W, 260);

  const logo = await loadImage('logo.png');
  if (logo) {
    ctx.fillStyle = '#fff';
    roundRect(ctx, 80, 110, 84, 84, 22);
    ctx.fill();
    ctx.save();
    roundRect(ctx, 80, 110, 84, 84, 22);
    ctx.clip();
    ctx.drawImage(logo, 80, 110, 84, 84);
    ctx.restore();
  }
  ctx.fillStyle = '#fff';
  ctx.font = font(700, 38);
  ctx.fillText('Gatemate', 184, 166);

  const start = new Date(trip.startDate).getTime(), end = new Date(trip.endDate).getTime();
  const midnight = (t: number) => new Date(new Date(t).toDateString()).getTime();
  const days = Math.round((midnight(start) - midnight(now)) / 86_400_000);
  const city = trip.destination.city;
  let big: string, small: string;
  if (now < start && days > 1) [big, small] = [String(days), 'days until'];
  else if (now < start) [big, small] = days === 1 ? ['1', 'day until'] : ['Today', 'I’m flying to'];
  else if (now <= end) [big, small] = ['Now', 'exploring'];
  else [big, small] = ['Back', 'from'];

  ctx.font = font(900, big.length > 3 ? 240 : 320);
  ctx.fillText(big, 80, 1340);
  ctx.font = font(600, 56);
  ctx.globalAlpha = 0.9;
  ctx.fillText(small, 88, 1430);
  ctx.globalAlpha = 1;
  let size = 132;
  ctx.font = font(850, size);
  while (size > 64 && ctx.measureText(city).width > W - 160) ctx.font = font(850, (size -= 6));
  ctx.fillText(city, 80, 1560);

  const f = trip.flights[0];
  const when = new Date(trip.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.font = font(600, 40);
  ctx.globalAlpha = 0.9;
  ctx.fillText(f ? `${f.from.code}  ✈  ${f.to.code}  ·  ${when}` : when, 84, 1650);
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255,255,255,.16)';
  roundRect(ctx, 80, 1740, W - 160, 96, 48);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = font(700, 34);
  ctx.textAlign = 'center';
  ctx.fillText('Plan your trip with Gatemate', W / 2, 1800);
  ctx.textAlign = 'left';

  c.toDataURL('image/png').slice(0, 16);
  return c;
}

function loadCorsImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    const t = setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.src = src;
  });
}
