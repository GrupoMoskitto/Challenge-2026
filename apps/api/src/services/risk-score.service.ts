import { prisma, Prisma } from '@crmed/database';
import { calculateRiskScore } from '../lib/risk-score';
import { AppointmentRiskContext } from '@crmed/types';
import { logger } from '../config/logger';

export class RiskScoreService {
  static async updateRiskScore(appointmentId: string): Promise<void> {
    try {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: {
            include: {
              lead: {
                include: {
                  contacts: {
                    where: { direction: 'OUTBOUND' },
                    orderBy: { date: 'desc' },
                    take: 1
                  }
                }
              },
              appointments: true // Fetch all to filter in memory or more specific query
            }
          },
          notifications: {
            where: { type: 'CONFIRMATION_48H' },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!appointment) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }

      const patient = appointment.patient;
      const lead = patient.lead;

      // History of previous appointments
      const patientPreviousAppointments = patient.appointments
        .filter(a => a.id !== appointment.id && a.scheduledAt < appointment.scheduledAt)
        .map(a => ({
          status: a.status,
          scheduledAt: a.scheduledAt
        }));

      // Notifications
      const confirmationNotification = appointment.notifications[0];
      const sentAt = confirmationNotification?.sentAt;
      
      // SLA calculation
      let slaBreached = false;
      if (sentAt) {
        const workMinutes = this.calculateWorkMinutes(sentAt, new Date());
        slaBreached = workMinutes >= 1440; // 24 business hours
      }

      const lastOutboundContact = lead.contacts[0];

      const context: AppointmentRiskContext = {
        appointmentId: appointment.id,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        patientPreviousAppointments,
        confirmationNotificationSentAt: sentAt || undefined,
        slaBreached,
        leadStatus: lead.status,
        lastOutboundContactAt: lastOutboundContact?.date || undefined,
      };

      const result = calculateRiskScore(context);

      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          riskScore: result.score,
          riskLevel: result.level as any, // Cast to Prisma enum
          riskUpdatedAt: new Date(),
        }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: appointmentId,
          action: 'RISK_SCORE_UPDATED',
          newValue: {
            score: result.score,
            level: result.level,
            signals: result.signals
          } as unknown as Prisma.InputJsonValue,
          appointmentId: appointment.id,
          patientId: patient.id,
          reason: 'Automatic risk score recalculation'
        }
      });

      logger.info('RiskScoreService', `Risk score updated for appointment ${appointmentId}: ${result.score} (${result.level})`);
    } catch (error: any) {
      logger.error('RiskScoreService', `Failed to update risk score for appointment ${appointmentId}`, error);
      throw error;
    }
  }

  /**
   * Calculates work minutes between two dates (Mon-Fri, 08:00 - 18:00)
   * 10 hours per day = 600 min/day. 24h business hours = 1440 min.
   */
  private static calculateWorkMinutes(start: Date, end: Date): number {
    if (start > end) return 0;

    let totalMinutes = 0;
    const current = new Date(start);

    while (current < end) {
      const day = current.getDay();
      const isWorkDay = day >= 1 && day <= 5; // Mon-Fri

      if (isWorkDay) {
        const hour = current.getHours();

        // Work hours: 08:00 to 18:00
        if (hour >= 8 && hour < 18) {
          totalMinutes++;
        }
      }

      current.setMinutes(current.getMinutes() + 1);
    }

    return totalMinutes;
  }
}
