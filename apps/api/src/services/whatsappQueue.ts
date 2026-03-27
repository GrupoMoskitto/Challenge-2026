import { Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  console.error('[API] Redis connection error (WhatsApp Queue):', err);
});

export const WHATSAPP_QUEUE_NAME = 'whatsapp-reminders';

export const whatsappQueue = new Queue(WHATSAPP_QUEUE_NAME, {
  connection: redisConnection as any,
});

export const dispatchLeadWelcome = async (leadId: string, leadName: string, phone: string, procedure?: string) => {
  if (!phone) return;
  const { prisma } = await import('@crmed/database');
  const template = await prisma.messageTemplate.findFirst({ where: { triggerDays: -1 } });
  if (!template) return;

  let content = template.content.replace(/{nome}/g, leadName.split(' ')[0]);
  content = content.replace(/{procedimento}/g, procedure || 'seu procedimento');

  await whatsappQueue.add('lead-welcome', {
    leadId,
    patientName: leadName,
    phone,
    message: content,
    triggerDays: -1,
  }, {
    jobId: `lead-welcome-${leadId}`,
  });
};

export const dispatchLeadFollowup = async (leadId: string, leadName: string, phone: string, procedure?: string, days = 7) => {
  if (!phone) return;
  const { prisma } = await import('@crmed/database');
  const template = await prisma.messageTemplate.findFirst({ where: { triggerDays: days } });
  if (!template) return;

  let content = template.content.replace(/{nome}/g, leadName.split(' ')[0]);
  content = content.replace(/{procedimento}/g, procedure || 'seu procedimento');

  await whatsappQueue.add('lead-followup', {
    leadId,
    patientName: leadName,
    phone,
    message: content,
    triggerDays: days,
  }, {
    jobId: `lead-followup-${leadId}-${Date.now()}`,
    delay: days * 24 * 60 * 60 * 1000, 
  });
};
