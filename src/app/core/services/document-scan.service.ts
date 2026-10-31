import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { findMrz, MrzDocument } from '../utils/mrz';

interface TextScanPlugin {
  recognize(options: { image: string }): Promise<{ lines: string[] }>;
}

const TextScan = registerPlugin<TextScanPlugin>('TextScan');

@Injectable({ providedIn: 'root' })
export class DocumentScanService {
  readonly canReadPhotos = Capacitor.getPlatform() === 'ios';

  async read(file: File): Promise<MrzDocument | null> {
    const image = await downscale(file, 2200);
    const { lines } = await TextScan.recognize({ image });
    return findMrz(lines) ?? findMrz(lines.join('\n').split(/(?<=<{2,})\s+/));
  }
}

async function downscale(file: File, max: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('image'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}
