import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConfettiService {
  burst(originX = 0.5, originY = 0.4, count = 90): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.createElement('canvas');
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '100000' });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const colors = ['#0FB5C3', '#22C7D3', '#5EC8FF', '#FFB36B', '#2FD18A', '#8B7CF6', '#ffffff'];
    const parts = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 7;
      return {
        x: originX * innerWidth,
        y: originY * innerHeight,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: colors[(Math.random() * colors.length) | 0],
      };
    });
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.22;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 2200);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        ctx.restore();
      }
      if (t < 2200) requestAnimationFrame(tick);
      else canvas.remove();
    };
    requestAnimationFrame(tick);
  }
}
