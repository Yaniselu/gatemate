/**
 * Shrinks a user photo before upload: centre-crops to a square, resizes to `size` px and
 * re-encodes as WebP (JPEG fallback). Re-encoding through a canvas also drops EXIF metadata,
 * including GPS location, so a profile photo never leaks where it was taken.
 */
export async function compressAvatar(file: File, size = 320, quality = 0.82): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(file.type)) throw new Error('Choose a JPG, PNG, WebP or HEIC photo.');
  if (file.size > 20 * 1024 * 1024) throw new Error('That photo is too large (max 20 MB).');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('This photo format is not supported on this device.');
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
}
