import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'avatarBg' })
export class AvatarBgPipe implements PipeTransform {
  transform(color: string | null | undefined): string {
    if (!color) return 'linear-gradient(135deg, #0b8f9c, #2a6fc0)';
    if (color.includes('gradient')) return color;
    return `linear-gradient(135deg, color-mix(in srgb, ${color} 72%, #0b1b2b), color-mix(in srgb, ${color} 58%, #0b1b2b))`;
  }
}
