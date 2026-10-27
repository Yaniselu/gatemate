import { inject, Injectable } from '@angular/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { PlatformService } from './platform.service';
import { BcbpError } from '../utils/bcbp';

const FORMATS = [BarcodeFormat.Pdf417, BarcodeFormat.Aztec, BarcodeFormat.QrCode, BarcodeFormat.DataMatrix];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

interface BarcodeDetectorLike {
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: { new (o: { formats: string[] }): BarcodeDetectorLike } | undefined;

/** Reads boarding-pass barcodes from the camera or from a screenshot/photo, entirely on-device. */
@Injectable({ providedIn: 'root' })
export class PassReaderService {
  private platform = inject(PlatformService);

  async fromCamera(): Promise<string | null> {
    if (!this.platform.isNative) return null;
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) throw new BcbpError('Scanning is not supported on this device.');
    const perm = await BarcodeScanner.requestPermissions();
    if (perm.camera !== 'granted' && perm.camera !== 'limited') {
      throw new BcbpError('Allow camera access in Settings to scan your boarding pass.');
    }
    const { barcodes } = await BarcodeScanner.scan({ formats: FORMATS });
    return barcodes[0]?.rawValue ?? null;
  }

  async fromImage(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) throw new BcbpError('Choose a screenshot or photo of your boarding pass.');
    if (file.size > MAX_IMAGE_BYTES) throw new BcbpError('That image is too large (max 15 MB).');

    if (this.platform.isNative) {
      // ML Kit reads from a file path: write a temporary copy to the private cache, then delete it.
      const name = `pass-${Date.now()}.img`;
      const { uri } = await Filesystem.writeFile({ path: name, data: await toBase64(file), directory: Directory.Cache });
      try {
        const { barcodes } = await BarcodeScanner.readBarcodesFromImage({ path: uri, formats: FORMATS });
        if (barcodes[0]?.rawValue) return barcodes[0].rawValue;
      } finally {
        await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => {});
      }
      throw new BcbpError('No boarding-pass barcode found in that image.');
    }

    if (typeof BarcodeDetector !== 'undefined') {
      const detector = new BarcodeDetector({ formats: ['pdf417', 'aztec', 'qr_code', 'data_matrix'] });
      const codes = await detector.detect(await createImageBitmap(file));
      if (codes[0]?.rawValue) return codes[0].rawValue;
      throw new BcbpError('No boarding-pass barcode found in that image.');
    }
    throw new BcbpError('Reading images works in the Gatemate app. In this browser, use the sample pass.');
  }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
