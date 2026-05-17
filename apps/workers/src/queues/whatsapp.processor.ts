import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { redisConnection } from '../config/redis';
import { WhatsappSender } from '../whatsapp/whatsapp.sender';
import { prisma } from '@crmed/database';
import { riskScoreQueue } from './risk-score.processor';
import { logger } from '../config/logger';

export const WHATSAPP_QUEUE_NAME = 'whatsapp-reminders';
export const WHATSAPP_DLQ_NAME = 'whatsapp-dead-letter';

export const whatsappQueue = new Queue(WHATSAPP_QUEUE_NAME, {
  connection: redisConnection as ConnectionOptions,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, dobra a cada tentativa
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Dead Letter Queue (DLQ)
export const whatsappDLQ = new Queue(WHATSAPP_DLQ_NAME, {
  connection: redisConnection as ConnectionOptions,
});

interface WhatsAppJobData {
  appointmentId?: string;
  postOpId?: string;
  leadId: string;
  patientName: string;
  phone: string;
  message: string;
  triggerDays: number;
  instanceName?: string; // Optional custom instance
}

export const whatsappWorker = new Worker<WhatsAppJobData>(
  WHATSAPP_QUEUE_NAME,
  async (job: Job<WhatsAppJobData>) => {
    logger.info('Worker', `Processando job ${job.id}: ${job.name} (tentativa ${job.attemptsMade + 1}/${job.opts.attempts ?? 5})`);
    const { appointmentId, postOpId, leadId, phone, message, triggerDays, instanceName: jobInstanceName } = job.data;

    try {
      const defaultInstance = process.env.EVOLUTION_INSTANCE_NAME || 'crmed-whatsapp';
      const instanceName = jobInstanceName || defaultInstance;
      const result = await WhatsappSender.sendMessage(instanceName, phone, message, leadId);

      if (result.status === 'blocked_by_dev_sandbox') {
         logger.info('Worker', `Job ${job.id} processado (bloqueado pelo Sandbox)`);
      }

      // TRIGGER: Recalculate risk score if it's an appointment notification
      if (appointmentId) {
        await riskScoreQueue.add('recalculate', { appointmentId }, {
          delay: 5000, // Small delay to ensure DB is updated with WHATSAPP_SENT log
        });
      }

      // Determine notification type
      let notificationType: 'REMINDER_30D' | 'REMINDER_7D' | 'CONFIRMATION_48H' | 'POST_OP_CONFIRMATION' | 'NEW_LEAD' | 'LAST_ATTEMPT' = 'LAST_ATTEMPT';
      if (triggerDays === 30) notificationType = 'REMINDER_30D';
      else if (triggerDays === 7) notificationType = 'REMINDER_7D';
      else if (triggerDays === 2) notificationType = 'CONFIRMATION_48H';
      else if (triggerDays === -1) notificationType = 'POST_OP_CONFIRMATION';
      else if (triggerDays === 0) notificationType = 'NEW_LEAD';

      // Create SENT notification with the WhatsApp Message ID (Immediate visibility)
      if (result.messageId) {
        if (appointmentId) {
          await prisma.notification.create({
            data: {
              appointmentId,
              type: notificationType as any,
              status: 'SENT',
              externalMessageId: result.messageId,
              sentAt: new Date(),
            }
          });
        } else if (postOpId) {
          await prisma.notification.create({
            data: {
              postOpId,
              type: notificationType as any,
              status: 'SENT',
              externalMessageId: result.messageId,
              sentAt: new Date(),
            }
          });
        }
      }

      const entityId = appointmentId || postOpId || leadId;
      const entityType = appointmentId ? 'Appointment' : (postOpId ? 'PostOp' : 'Lead');

      // RN06: Successful delivery audit
      await prisma.auditLog.create({
        data: {
          entityType,
          entityId,
          action: 'WHATSAPP_SENT',
          newValue: JSON.stringify({ triggerDays, messageSnippet: message.substring(0, 50) }),
          reason: `Automação RN05: Lembrete/Mensagem de ${triggerDays} dia(s) enviado com sucesso`,
        }
      });

      return { success: true, deliveredAt: new Date() };

    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      logger.error('Worker', `Falha ao enviar para ${phone}`, errMessage);
      
      const entityId = appointmentId || postOpId || leadId;
      const entityType = appointmentId ? 'Appointment' : (postOpId ? 'PostOp' : 'Lead');

      await prisma.auditLog.create({
        data: {
          entityType,
          entityId,
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

    // RN06: DLQ audit
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
