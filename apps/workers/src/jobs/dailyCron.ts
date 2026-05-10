import { format, differenceInDays, startOfDay, addDays } from 'date-fns';
import { prisma } from '@crmed/database';
import { whatsappQueue } from '../queues/whatsapp.processor';
import { logger } from '../config/logger';

/**
 * RN05:
 * O envio de mensagens via WhatsApp deve seguir a cronologia exata:
 * • 4 dias antes da consulta (Mensagem de confirmação)
 * • 2 dias antes (Lembrete)
 * • 1 dia antes (Ligação/Mensagem para não confirmados)
 * • Dia da consulta (Última tentativa)
 */
export async function processDailyAppointments() {
  logger.info('Cron', 'Iniciando varredura diária de consultas...');

  try {
    const templates = await prisma.messageTemplate.findMany();
    
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 5); 

    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: {
          gte: today,
          lt: maxDate,
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'],
        },
      },
      include: {
        patient: true, // the model field is `patient Lead`
        surgeon: true,
      }
    });

    logger.info('Cron', `${appointments.length} consultas encontradas nos próximos 4 dias`);

    for (const appointment of appointments) {
      // TypeScript safety checks for included relation fields
      const leadData = appointment.patient as any;
      if (!leadData || !leadData.phone) continue;

      const surgeonData = appointment.surgeon as any;

      const aptDate = startOfDay(new Date(appointment.scheduledAt));
      const daysUntilApt = differenceInDays(aptDate, today);

      const template = templates.find(t => t.triggerDays === daysUntilApt && t.triggerDays >= 0 && t.triggerDays <= 5);
      
      if (!template) {
        continue;
      }

      // RN06: Evita disparo duplicado
      const alreadySent = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Appointment',
          entityId: appointment.id,
          action: 'WHATSAPP_SENT',
          reason: {
            contains: `Lembrete de ${daysUntilApt} dia(s)`,
          }
        }
      });

      if (alreadySent) {
        logger.debug('Cron', `Mensagem de ${daysUntilApt} dias já enviada para consulta ${appointment.id}`);
        continue;
      }

      let content = template.content;
      content = content.replace(/{nome}/g, leadData.name.split(' ')[0]);
      content = content.replace(/{data}/g, format(new Date(appointment.scheduledAt), 'dd/MM/yyyy'));
      content = content.replace(/{hora}/g, format(new Date(appointment.scheduledAt), 'HH:mm'));
      content = content.replace(/{medico}/g, surgeonData?.name || 'seu médico');
      content = content.replace(/{procedimento}/g, appointment.procedure);

      await whatsappQueue.add('send-reminder', {
        appointmentId: appointment.id,
        leadId: leadData.id,
        patientName: leadData.name,
        phone: leadData.phone,
        message: content,
        triggerDays: daysUntilApt,
      }, {
        attempts: 3, // Evolutio API might be temporary unavailable, bullmq auto-retries
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `apt-${appointment.id}-t-${daysUntilApt}`, // unique job ID to prevent duplicates
      });
      
      logger.success('Cron', `Job adicionado: ${leadData.name} (${daysUntilApt} dias)`);
    }

  } catch (error) {
    logger.error('Cron', 'Erro fatal na varredura diária', error);
  }
}
