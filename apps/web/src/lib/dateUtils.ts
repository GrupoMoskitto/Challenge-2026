/**
 * Creates an ISO 8601 formatted date string with an explicit timezone offset for Brasília (-03:00).
 * Prevents ambiguous dates from being sent to the backend.
 * 
 * @param date - The date string in YYYY-MM-DD format
 * @param time - The time string in HH:MM format
 * @returns An explicit ISO string like "2026-04-01T14:30:00-03:00"
 */
export const buildExplicitScheduledAt = (date: string, time: string): string => {
  return `${date}T${time}:00-03:00`;
};
