/** Courier timestamps without an offset are India local time. */
export function normalizeCourierEventTime(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  let text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(text) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) text = text.replace(' ', 'T') + '+05:30';
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}
