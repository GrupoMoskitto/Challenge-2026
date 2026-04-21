import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { redisConnection } from '../config/redis';
import { WhatsAppService } from '../services/whatsapp.service';
import { prisma } from '@crmed/database';
import { logger } from '../config/logger';

export const WHATSAPP_QUEUE_NAME = 'whatsapp-reminders';

// BullMQ Queue instance
export const whatsappQueue = new Queue(WHATSAPP_QUEUE_NAME, {
  connection: redisConnection as ConnectionOptions,
});

interface WhatsAppJobData {
  appointmentId?: string;
  leadId: string;
  patientName: string;
  phone: string;
  message: string;
  triggerDays: number;
  instanceName?: string; // Optional custom instance
}

// BullMQ Worker to process the events
export const whatsappWorker = new Worker<WhatsAppJobData>(
  WHATSAPP_QUEUE_NAME,
  async (job: Job<WhatsAppJobData>) => {
    logger.info('Worker', `Processando job ${job.id}: ${job.name}`);
    const { appointmentId, leadId, phone, message, triggerDays, instanceName: jobInstanceName } = job.data;

    try {
      // 1. Send the WhatsApp message via Evolution API
      // Use the instance name from the job if provided, otherwise fallback to default
      const defaultInstance = process.env.EVOLUTION_INSTANCE_NAME || 'crmed-whatsapp';
      const instanceName = jobInstanceName || defaultInstance;
      await WhatsAppService.sendMessage(instanceName, phone, message);

      // 2. Fulfill RN06: Create an AuditLog representing the successful delivery
      await prisma.auditLog.create({
        data: {
          entityType: appointmentId ? 'Appointment' : 'Lead',
          entityId: appointmentId || leadId,
          action: 'WHATSAPP_SENT',
          newValue: JSON.stringify({ triggerDays, messageSnippet: message.substring(0, 50) }),
          reason: `Automação RN05: Lembrete/Mensagem de ${triggerDays} dia(s) enviado com sucesso`,
        }
      });

      return { success: true, deliveredAt: new Date() };

    } catch (error: any) {
      logger.error('Worker', `Falha ao enviar para ${phone}`, error?.message);
      
      // Still logging the failure for audit purposes
      await prisma.auditLog.create({
        data: {
          entityType: appointmentId ? 'Appointment' : 'Lead',
          entityId: appointmentId || leadId,
          action: 'WHATSAPP_FAILED',
          newValue: JSON.stringify({ error: error?.message }),
          reason: `Automação RN05: Falha ao enviar lembrete/mensagem de ${triggerDays} dia(s)`,
        }
      });
      
      throw error; // Let BullMQ handle retries
    }
  },
  {
    connection: redisConnection as ConnectionOptions,
    concurrency: 5, // Process up to 5 messages concurrently
  }
);

whatsappWorker.on('completed', (job) => {
  logger.success('Worker', `Job ${job.id} concluído`);
});

whatsappWorker.on('failed', (job, err) => {
  logger.error('Worker', `Job ${job?.id} falhou`, err.message);
});
