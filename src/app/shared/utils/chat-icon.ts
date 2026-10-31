export const CHAT_ICONS: { emoji: string; icon: string }[] = [
  { emoji: '✈️', icon: 'airplane' },
  { emoji: '🏖️', icon: 'sunny' },
  { emoji: '🏔️', icon: 'trail-sign' },
  { emoji: '🏙️', icon: 'business' },
  { emoji: '🎉', icon: 'sparkles' },
  { emoji: '⚽', icon: 'football' },
  { emoji: '🎿', icon: 'snow' },
  { emoji: '🍝', icon: 'restaurant' },
  { emoji: '🌴', icon: 'leaf' },
  { emoji: '💼', icon: 'briefcase' },
  { emoji: '🎓', icon: 'school' },
  { emoji: '❤️', icon: 'heart' },
];

export function chatIcon(emoji: string | null | undefined, isPublic = false): string {
  if (isPublic) return 'people';
  const clean = (emoji ?? '').replace(/️/g, '');
  return CHAT_ICONS.find((c) => c.emoji.replace(/️/g, '') === clean)?.icon ?? 'chatbubbles';
}
