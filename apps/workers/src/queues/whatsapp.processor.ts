import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { WhatsAppService } from '../services/whatsapp.service';
import { prisma } from '@crmed/database';

export const WHATSAPP_QUEUE_NAME = 'whatsapp-reminders';

// BullMQ Queue instance
export const whatsappQueue = new Queue(WHATSAPP_QUEUE_NAME, {
  connection: redisConnection as any,
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
  async (job: Job) => {
    console.log(`[WhatsApp Worker] Processing job ${job.id} (Name: ${job.name})`);
    const { appointmentId, leadId, patientName, phone, message, triggerDays, instanceName: jobInstanceName } = job.data as any;

    try {
      // 1. Send the WhatsApp message via Evolution API
      // Use the instance name from the job if provided, otherwise fallback to default
      const defaultInstance = process.env.EVOLUTION_INSTANCE_NAME || 'crmed-whatsapp';
      const instanceName = jobInstanceName || defaultInstance;
      console.log(`[WhatsApp Worker] Sending message via ${instanceName} to ${phone}...`);
      const result = await WhatsAppService.sendMessage(instanceName, phone, message);
      console.log(`[WhatsApp Worker] API Response:`, JSON.stringify(result));

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
      console.error(`[WhatsApp Worker] Error sending message to ${phone}:`, error?.message);
      
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
    connection: redisConnection as any,
    concurrency: 5, // Process up to 5 messages concurrently
  }
);

whatsappWorker.on('completed', (job) => {
  console.log(`[WhatsApp Worker] Job ${job.id} has completed successfully`);
});

whatsappWorker.on('failed', (job, err) => {
  console.error(`[WhatsApp Worker] Job ${job?.id} has failed with ${err.message}`);
});
