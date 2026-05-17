import { format, differenceInDays, startOfDay, addDays } from 'date-fns';
import { prisma, TemplateParser } from '@crmed/database';
import { whatsappQueue } from '../queues/whatsapp.processor';
import { riskScoreQueue } from '../queues/risk-score.processor';
import { logger } from '../config/logger';

/**
 * RN05:
 * O envio de mensagens via WhatsApp deve seguir a cronologia exata:
 * • 30 dias antes (Preparativos)
 * • 7 dias antes (Orientações)
 * • 2 dias antes (Confirmação Obrigatória)
 */
export async function processDailyAppointments() {
  logger.info('Cron', 'Iniciando varredura diária de consultas...');

  try {
    const templates = await prisma.messageTemplate.findMany();
    
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 31); 

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
        patient: {
          include: {
            lead: true
          }
        },
        surgeon: true,
      }
    });

    logger.info('Cron', `${appointments.length} consultas encontradas nos próximos 30 dias`);

    for (const appointment of appointments) {
      // Recalculate risk score for every appointment found
      await riskScoreQueue.add('recalculate-daily', { appointmentId: appointment.id });

      const leadData = appointment.patient?.lead;
      if (!leadData || !leadData.phone) continue;

      const surgeonData = appointment.surgeon;

      const aptDate = startOfDay(new Date(appointment.scheduledAt));
      const daysUntilApt = differenceInDays(aptDate, today);

      // Encontra template exato para os dias restantes
      const template = templates.find(t => t.triggerDays === daysUntilApt);
      
      if (!template) {
        continue;
      }

      // RN06: Evita disparo duplicado do mesmo template para a mesma consulta
      const alreadySent = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Appointment',
          entityId: appointment.id,
          action: 'WHATSAPP_SENT',
          reason: {
            contains: `Template: ${template.name}`,
          }
        }
      });

      if (alreadySent) {
        logger.debug('Cron', `Mensagem do template "${template.name}" já enviada para consulta ${appointment.id}`);
        continue;
      }

      const content = TemplateParser.parse(template.content, {
        paciente: leadData.name.split(' ')[0],
        procedimento: appointment.procedure,
        medico: surgeonData?.name,
        data: format(new Date(appointment.scheduledAt), 'dd/MM/yyyy'),
        hora: format(new Date(appointment.scheduledAt), 'HH:mm'),
        horario: format(new Date(appointment.scheduledAt), 'HH:mm'),
      });

      await whatsappQueue.add('send-reminder', {
        appointmentId: appointment.id,
        leadId: leadData.id,
        patientName: leadData.name,
        phone: leadData.phone,
        message: content,
        triggerDays: daysUntilApt,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `apt-${appointment.id}-t-${daysUntilApt}-${template.id}`,
      });
      
      logger.success('Cron', `Job adicionado: ${leadData.name} (${daysUntilApt} dias) - Template: ${template.name}`);
    }

  } catch (error) {
    logger.error('Cron', 'Erro fatal na varredura diária', error);
  }
}
