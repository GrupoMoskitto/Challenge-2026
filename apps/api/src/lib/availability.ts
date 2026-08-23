import { getBrasiliaTimeDetails } from '@crmed/database';

export const checkSurgeonAvailability = (surgeon: any, scheduledAt: Date): boolean => {
  if (!surgeon) return true;

  const { timeVal, dateStr, dayOfWeek } = getBrasiliaTimeDetails(scheduledAt);

  // 1. Check ScheduleBlocks (vacations, congress, etc.)
  if (surgeon.blocks) {
    const isBlocked = surgeon.blocks.find((block: any) => {
      // scheduledAt should not fall within a block
      return scheduledAt >= new Date(block.startDate) && scheduledAt <= new Date(block.endDate);
    });
    if (isBlocked) return false;
  }

  // 2. Check Extra Availability (exceptions)
  if (surgeon.extraAvailability) {
    const extraAvail = surgeon.extraAvailability.find((ea: any) => {
      // ea.date is stored, we just compare the yyyy-MM-dd in local BRT
      const { dateStr: eaDateStr } = getBrasiliaTimeDetails(new Date(ea.date));
      return eaDateStr === dateStr && ea.isActive;
    });

    if (extraAvail) {
      const [sh, sm] = extraAvail.startTime.split(':').map(Number);
      const [eh, em] = extraAvail.endTime.split(':').map(Number);
      return timeVal >= (sh * 60 + sm) && timeVal < (eh * 60 + em);
    }
  }

  // 3. Check Weekly Availability
  if (surgeon.availability) {
    const weeklyAvail = surgeon.availability.find((a: any) => a.dayOfWeek === dayOfWeek && a.isActive);

    if (weeklyAvail) {
      const [sh, sm] = weeklyAvail.startTime.split(':').map(Number);
      const [eh, em] = weeklyAvail.endTime.split(':').map(Number);
      return timeVal >= (sh * 60 + sm) && timeVal < (eh * 60 + em);
    }
  }

  // 4. Fallback to Hospital Default Profile: Mon-Fri, 08:00 - 18:00
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  if (isWeekday) {
    return timeVal >= (8 * 60) && timeVal < (18 * 60);
  }

  return false; // Sat/Sun closed by default if no rule
};
