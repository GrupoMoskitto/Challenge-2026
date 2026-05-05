import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { redisConnection } from '../config/redis';
import { WhatsAppService } from '../services/whatsapp.service';
import { prisma } from '@crmed/database';
import { logger } from '../config/logger';

export const WHATSAPP_QUEUE_NAME = 'whatsapp-reminders';
export const WHATSAPP_DLQ_NAME = 'whatsapp-dead-letter';

// BullMQ Queue instance with default retry policy
export const whatsappQueue = new Queue(WHATSAPP_QUEUE_NAME, {
  connection: redisConnection as ConnectionOptions,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s → 10s → 20s → 40s → 80s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: false, // keep for DLQ inspection
  },
});

// Dead Letter Queue for permanently failed jobs
export const whatsappDLQ = new Queue(WHATSAPP_DLQ_NAME, {
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
    logger.info('Worker', `Processando job ${job.id}: ${job.name} (tentativa ${job.attemptsMade + 1}/${job.opts.attempts ?? 5})`);
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

    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      logger.error('Worker', `Falha ao enviar para ${phone}`, errMessage);
      
      // Still logging the failure for audit purposes
      await prisma.auditLog.create({
        data: {
          entityType: appointmentId ? 'Appointment' : 'Lead',
          entityId: appointmentId || leadId,
          action: 'WHATSAPP_FAILED',
          newValue: JSON.stringify({ error: errMessage, attempt: job.attemptsMade + 1 }),
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

whatsappWorker.on('failed', async (job, err) => {
  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 5;
  const attemptsLeft = maxAttempts - job.attemptsMade;

  if (attemptsLeft > 0) {
    logger.warn('Worker', `Job ${job.id} falhou (tentativa ${job.attemptsMade}/${maxAttempts}). Retry automático pendente...`);
    return;
  }

  // All retries exhausted → move to Dead Letter Queue
  logger.error('Worker', `Job ${job.id} esgotou ${maxAttempts} tentativas. Movendo para DLQ.`, err.message);

  try {
    await whatsappDLQ.add('dead-letter', {
      originalJobId: job.id,
      originalQueue: WHATSAPP_QUEUE_NAME,
      data: job.data,
      failedReason: err.message,
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
    });

    // RN06: Audit trail for DLQ event
    await prisma.auditLog.create({
      data: {
        entityType: job.data.appointmentId ? 'Appointment' : 'Lead',
        entityId: job.data.appointmentId || job.data.leadId,
        action: 'WHATSAPP_DLQ',
        newValue: JSON.stringify({
          jobId: job.id,
          error: err.message,
          attempts: job.attemptsMade,
          phone: job.data.phone,
        }),
        reason: `Job movido para DLQ após ${job.attemptsMade} tentativas falhadas`,
      },
    });

    logger.info('Worker', `Job ${job.id} movido para DLQ com sucesso`);
  } catch (dlqError) {
    logger.error('Worker', `Falha crítica ao mover job ${job.id} para DLQ`, dlqError);
  }
});
