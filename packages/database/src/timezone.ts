import { toZonedTime, format } from 'date-fns-tz';

export const BRASILIA_TZ = 'America/Sao_Paulo';

/**
 * Ensures the date string explicitly defines a timezone (UTC Z or explicit offset).
 * Rejects ambiguous local strings like "2026-04-01T10:00:00" without "Z".
 */
export function ensureExplicitTimezone(dateString: string): void {
  if (!dateString.endsWith('Z') && !/[-+]\d{2}:\d{2}$/.test(dateString)) {
    throw new Error('Formato de data ambíguo. O horário deve incluir o timezone explícito (ex: terminando em Z para UTC ou com offset -03:00).');
  }
}

/**
 * Converts a UTC Date object to Brasília local time and extracts its hour, minute, date string, and day of week.
 */
export function getBrasiliaTimeDetails(date: Date) {
  const zonedDate = toZonedTime(date, BRASILIA_TZ);
  return {
    hour: zonedDate.getHours(),
    minute: zonedDate.getMinutes(),
    timeVal: zonedDate.getHours() * 60 + zonedDate.getMinutes(),
    dateStr: format(zonedDate, 'yyyy-MM-dd', { timeZone: BRASILIA_TZ }),
    dayOfWeek: zonedDate.getDay(), // 0 = Sunday, 6 = Saturday
  };
}
