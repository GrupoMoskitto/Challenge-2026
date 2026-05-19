import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { TemplateParser } from '@crmed/database';

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
  const template = await prisma.messageTemplate.findFirst({ where: { name: 'Boas-Vindas' } });
  
  if (!template) {
    console.warn(`[API] Aviso: Template de Boas-Vindas não encontrado. Nenhuma mensagem de boas-vindas enviada para o lead ${leadId}.`);
    return;
  }

  const content = TemplateParser.parse(template.content, {
    paciente: leadName.split(' ')[0],
    procedimento: procedure,
  });

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
  
  if (!template) {
    console.error(`[API] Erro: Template para ${days} dias não encontrado.`);
    return;
  }

  const content = TemplateParser.parse(template.content, {
    paciente: leadName.split(' ')[0],
    procedimento: procedure,
  });

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

export const dispatchAppointmentReschedule = async (
  appointmentId: string, 
  leadId: string,
  patientName: string, 
  phone: string, 
  procedure: string, 
  surgeonName: string,
  scheduledAt: Date
) => {
  if (!phone) return;
  const { prisma } = await import('@crmed/database');
  const template = await prisma.messageTemplate.findFirst({ where: { name: 'Reagendamento de Consulta' } });
  
  if (!template) {
    console.error(`[API] Erro: Template de 'Reagendamento de Consulta' não encontrado.`);
    return;
  }

  const content = TemplateParser.parse(template.content, {
    paciente: patientName.split(' ')[0],
    procedimento: procedure,
    medico: surgeonName,
    data: scheduledAt.toLocaleDateString('pt-BR'),
    hora: scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  await whatsappQueue.add('send-reschedule', {
    appointmentId,
    leadId,
    patientName,
    phone,
    message: content,
    triggerDays: 999,
  }, {
    jobId: `send-reschedule-${appointmentId}-${Date.now()}`,
  });
};

export const dispatchTemplateTest = async (templateId: string, instanceName: string, _userId: string) => {
  const { prisma } = await import('@crmed/database');
  const template = await prisma.messageTemplate.findUnique({ 
    where: { id: templateId } 
  });
  if (!template) throw new Error('Template não encontrado');

  const testPhone = process.env.DEV_ALLOWED_PHONE;
  if (!testPhone) {
    throw new Error('DEV_ALLOWED_PHONE não configurado no ambiente');
  }

  const content = TemplateParser.parse(template.content, {
    paciente: 'Usuário de Teste',
    medico: 'Dr. Arnaldo (Teste)',
    procedimento: 'Procedimento de Teste',
    data: new Date().toLocaleDateString('pt-BR'),
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  });

  const jobParameters = {
    leadId: 'test-user',
    patientName: 'Usuário de Teste (Admin)',
    phone: testPhone,
    message: content,
    triggerDays: template.triggerDays,
    instanceName,
  };

  try {
    const job = await whatsappQueue.add('template-test', jobParameters, {
      jobId: `test-${templateId}-${instanceName}-${Date.now()}`,
    });
    console.log(`[API] Job de teste adicionado com sucesso! ID: ${job.id}`);
  } catch (error: any) {
    console.error(`[API] Falha ao adicionar job na fila: ${error.message}`);
    throw error;
  }
};

