import { format, differenceInDays, startOfDay, addDays } from 'date-fns';
import { prisma } from '@crmed/database';
import { whatsappQueue } from '../queues/whatsapp.processor';

/**
 * RN05:
 * O envio de mensagens via WhatsApp deve seguir a cronologia exata:
 * • 4 dias antes da consulta (Mensagem de confirmação)
 * • 2 dias antes (Lembrete)
 * • 1 dia antes (Ligação/Mensagem para não confirmados)
 * • Dia da consulta (Última tentativa)
 */
export async function processDailyAppointments() {
  console.log(`[Cron] Executando varredura diária de consultas: ${new Date().toISOString()}`);

  try {
    // Buscar todos os templates do banco para fazer cache em memória local
    const templates = await prisma.messageTemplate.findMany();
    
    // Configurar o range de busca de consultas.
    // Queremos consultas de hoje (0) até 4 dias no futuro.
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 5); 

    // Buscar consultas que estão AGENDADAS ou CONFIRMADAS neste range
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

    console.log(`[Cron] Found ${appointments.length} upcoming appointments in the 4-day window`);

    for (const appointment of appointments) {
      // TypeScript safety checks for included relation fields
      const leadData = appointment.patient as any;
      if (!leadData || !leadData.phone) continue;

      const surgeonData = appointment.surgeon as any;

      const aptDate = startOfDay(new Date(appointment.scheduledAt));
      const daysUntilApt = differenceInDays(aptDate, today);

      // Verificamos se o daysUntilApt coincide exatamente com os gatilhos da RN05
      const validTriggers = [4, 2, 1, 0];
      if (!validTriggers.includes(daysUntilApt)) {
        continue;
      }

      // Procurar o Template correto no banco correspondente ao número de dias
      // The templates should have triggerDays aligned. 
      // i.e: triggerDays = 4 for "Lembrete 4 dias", triggerDays = 0 for "Dia da consulta"
      const template = templates.find(t => t.triggerDays === daysUntilApt);
      
      if (!template) {
        console.warn(`[Cron] No template found for triggerDays = ${daysUntilApt}`);
        continue;
      }

      // Evitar disparo duplicado (RN06)
      // Procurar se já criamos um AuditLog de WHATSAPP_SENT para esta consulta neste exato trigger
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
        console.log(`[Cron] Skipping... message for ${daysUntilApt} days already sent to Appointment ${appointment.id}`);
        continue;
      }

      // Fazer o Parse das variáveis: {nome}, {data}, {hora}, {medico}, {procedimento}
      let content = template.content;
      content = content.replace(/{nome}/g, leadData.name.split(' ')[0]);
      content = content.replace(/{data}/g, format(new Date(appointment.scheduledAt), 'dd/MM/yyyy'));
      content = content.replace(/{hora}/g, format(new Date(appointment.scheduledAt), 'HH:mm'));
      content = content.replace(/{medico}/g, surgeonData?.name || 'seu médico');
      content = content.replace(/{procedimento}/g, appointment.procedure);

      // Inserir na fila do BullMQ
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
      
      console.log(`[Cron] Added job to queue: ${leadData.name} -> trigger ${daysUntilApt}`);
    }

  } catch (error) {
    console.error(`[Cron] Fatal script error:`, error);
  }
}
