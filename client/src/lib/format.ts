const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", "Mon 12 Oct", "12 Oct 2024". */
export function formatDay(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  if (diff > 1 && diff < 7)
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, {
    weekday: sameYear ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

export function formatTime(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function formatMonth(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Ordinal for ranks: 1st, 2nd, 3rd, 4th… */
export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Parses a typed number: "", "-" and garbage become null. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(',', '.').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
