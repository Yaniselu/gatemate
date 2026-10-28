import { inject, Injectable } from '@angular/core';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerAndroidScanningLibrary, CapacitorBarcodeScannerCameraDirection, CapacitorBarcodeScannerTypeHintALLOption } from '@capacitor/barcode-scanner';
import { PlatformService } from './platform.service';
import { BcbpError } from '../utils/bcbp';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Longest side the decoder works on: big enough for a PDF417 on a phone screenshot, small enough to be quick. */
const DECODE_MAX_SIDE = 2000;

/** Reads boarding-pass barcodes (PDF417, Aztec, QR, Data Matrix) from the camera or a screenshot, entirely on-device. */
@Injectable({ providedIn: 'root' })
export class PassReaderService {
  private platform = inject(PlatformService);

  /** Native camera scanner (iOS / Android). Resolves null when the user closes the scanner. */
  async fromCamera(): Promise<string | null> {
    if (!this.platform.isNative) return null;
    try {
      const res = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
        scanInstructions: 'Point the camera at the barcode on your boarding pass',
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.ZXING },
      });
      return res.ScanResult || null;
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
      if (msg.includes('cancel')) return null;
      if (msg.includes('permission') || msg.includes('denied') || msg.includes('authoriz')) {
        throw new BcbpError('Allow camera access for Gatemate in Settings to scan your boarding pass.');
      }
      throw new BcbpError('The camera scanner could not start. Try uploading a screenshot instead.');
    }
  }

  /** Decodes a screenshot or photo in the app (no upload). Works the same on iOS, Android and the web. */
  async fromImage(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) throw new BcbpError('Choose a screenshot or photo of your boarding pass.');
    if (file.size > MAX_IMAGE_BYTES) throw new BcbpError('That image is too large (max 15 MB).');
    const zx = await import('@zxing/library');
    const bitmap = await loadImage(file);
    const hints = new Map();
    hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [zx.BarcodeFormat.PDF_417, zx.BarcodeFormat.AZTEC, zx.BarcodeFormat.QR_CODE, zx.BarcodeFormat.DATA_MATRIX]);
    hints.set(zx.DecodeHintType.TRY_HARDER, true);
    const reader = new zx.MultiFormatReader();
    reader.setHints(hints);
    // Try the full image, then a smaller copy: small barcodes and very large images decode best at different scales.
    for (const scale of [1, 0.5]) {
      const { data, width, height } = grayscale(bitmap, scale);
      try {
        const result = reader.decode(new zx.BinaryBitmap(new zx.HybridBinarizer(new zx.RGBLuminanceSource(data, width, height))));
        if (result.getText()) return result.getText();
      } catch {
        /* not found at this scale */
      }
    }
    throw new BcbpError('No boarding-pass barcode found in that image. Crop closer to the barcode and try again.');
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new BcbpError('That image could not be opened.'));
    };
    img.src = url;
  });
}

function grayscale(img: HTMLImageElement, scale: number): { data: Uint8ClampedArray; width: number; height: number } {
  const ratio = Math.min(1, DECODE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight)) * scale;
  const width = Math.max(1, Math.round(img.naturalWidth * ratio));
  const height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  return { data: out, width, height };
}
