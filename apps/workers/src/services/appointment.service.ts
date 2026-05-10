import { prisma } from '@crmed/database';
import { logger } from '../config/logger';

export class AppointmentService {
  /**
   * Lista agendamentos futuros do paciente
   */
  static async listPatientAppointments(jid: string) {
    const phone = jid.split('@')[0].replace(/[^0-9]/g, '');
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: phone.substring(phone.length - 8) } },
      include: { 
        patient: { 
          include: { 
            appointments: { 
              where: { 
                scheduledAt: { gte: new Date() },
                status: 'SCHEDULED'
              },
              include: { surgeon: true },
              orderBy: { scheduledAt: 'asc' }
            } 
          } 
        } 
      }
    });

    return lead?.patient?.appointments || [];
  }

  /**
   * Reserva temporária de vaga (Lock de 5 minutos)
   */
  static async lockSlot(surgeonId: string, date: Date, startTime: string, jid: string): Promise<boolean> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      await this.clearExpiredLocks();

      const existingLock = await prisma.slotLock.findFirst({
        where: {
          surgeonId,
          date,
          startTime,
          expiresAt: { gte: new Date() }
        }
      });

      if (existingLock) {
        if (existingLock.jid === jid) return true;
        return false;
      }

      await prisma.slotLock.create({
        data: {
          surgeonId,
          date,
          startTime,
          jid,
          expiresAt
        }
      });

      logger.info('AppointmentService', `Vaga travada: ${surgeonId} em ${date.toISOString()} ${startTime} para ${jid}`);
      return true;
    } catch (error) {
      logger.error('AppointmentService', 'Erro ao criar lock de vaga', error);
      return false;
    }
  }

  static async clearExpiredLocks() {
    await prisma.slotLock.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });
  }

  /**
   * Cancela um agendamento
   */
  static async cancelAppointment(appointmentId: string) {
    return prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' }
    });
  }
}
