/** Colors a game card can have. Chosen to read well with white text and emoji. */
export const GAME_COLORS = [
  '#FF6B5A', // coral
  '#FF9F1C', // orange
  '#F2B705', // amber
  '#2EB872', // green
  '#14A3A3', // teal
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#E84393', // pink
  '#64748B', // slate
] as const;

/** Stable color for a player key, used for avatars and chart lines. */
export const PLAYER_COLORS = [
  '#6D4AFF',
  '#FF6B5A',
  '#2EB872',
  '#F2A900',
  '#3B82F6',
  '#E84393',
  '#14A3A3',
  '#FF8C42',
  '#8B5CF6',
  '#64748B',
];

export function colorForKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}
