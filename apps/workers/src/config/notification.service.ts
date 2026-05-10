import { prisma } from '@crmed/database';
import { logger } from './logger';
import { WhatsappSender } from '../whatsapp/whatsapp.sender';
import { WhatsappSession } from '../whatsapp/whatsapp.session';
import { TemplateParser } from '../services/template-parser.service';

export class NotificationService {
  /**
   * Dispara um lembrete específico para um agendamento (usado em Cron e Testes)
   */
  static async triggerReminder(appointmentId: string, type: 'REMINDER_30D' | 'REMINDER_7D' | 'CONFIRMATION_48H') {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { lead: true } },
        surgeon: true
      }
    });

    if (!appointment || !appointment.patient.lead.phone) {
      logger.error('NotificationService', `Agendamento ${appointmentId} não encontrado ou sem telefone`);
      return;
    }

    const { patient, surgeon, procedure, scheduledAt } = appointment;
    const name = patient.lead.name;
    const dateStr = scheduledAt.toLocaleDateString('pt-BR');
    const hourStr = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const phone = patient.lead.phone;

    // 1. Busca Template no Banco
    const template = await prisma.messageTemplate.findUnique({ where: { name: type } });
    
    let body = '';
    let optionsSuffix = '';

    // 2. Define Fallbacks e Opções da State Machine
    switch (type) {
      case 'REMINDER_30D':
        body = template?.content || `Olá, {{paciente}}. Aqui é do Hospital São Rafael. 🏥\n\nPassando para lembrar que sua cirurgia de *{{procedimento}}* com o Dr. *{{medico}}* está agendada para o dia *{{data}}*.\n\nVocê ainda tem alguma dúvida sobre os preparativos?`;
        optionsSuffix = `\n\n1️⃣ Está tudo certo!\n2️⃣ Tenho dúvidas\n3️⃣ Preciso reagendar`;
        break;
      case 'REMINDER_7D':
        body = template?.content || `Olá, {{paciente}}. Falta apenas uma semana para sua cirurgia de *{{procedimento}}* em *{{data}}*! ✨\n\nJá está com os exames em mãos e seguiu as orientações?`;
        optionsSuffix = `\n\n1️⃣ Sim, tudo pronto!\n2️⃣ Preciso de ajuda\n3️⃣ Preciso reagendar`;
        break;
      case 'CONFIRMATION_48H':
        body = template?.content || `🚨 *CONFIRMAÇÃO CRÍTICA*\n\nOlá, {{paciente}}. Sua cirurgia de *{{procedimento}}* em *{{data}}* está confirmada em nosso sistema.\n\nPodemos contar com sua presença?`;
        optionsSuffix = `\n\n1️⃣ *SIM, CONFIRMAR*\n2️⃣ *REAGENDAR AGORA*\n3️⃣ *CANCELAR*`;
        break;
    }

    // 3. Parse das Variáveis (Com Graceful Degradation)
    const finalMessage = TemplateParser.parse(body, {
      paciente: name,
      procedimento: procedure,
      medico: surgeon.name,
      data: dateStr,
      hora: hourStr
    }) + optionsSuffix;

    // 4. Registra a notificação no banco
    await prisma.notification.create({
      data: {
        appointmentId,
        type,
        status: 'SENT',
        sentAt: new Date()
      }
    });

    // 5. Atualiza a sessão do WhatsApp
    await WhatsappSession.save(phone, {
      stage: 'CONFIRM_APPOINTMENT',
      appointmentId,
      userName: name,
      lastInteraction: Date.now()
    });

    // 6. Envia a mensagem
    const instanceId = process.env.EVOLUTION_INSTANCE_ID || '';
    await WhatsappSender.sendMessage(instanceId, phone, finalMessage);
    
    logger.info('NotificationService', `Lembrete ${type} enviado para ${name} (${phone}) ${template ? '(Usando Template DB)' : '(Usando Padrão)'}`);
  }

  /**
   * Dispara um lembrete para Pós-Operatório
   */
  static async triggerPostOpReminder(postOpId: string) {
    const postOp = await prisma.postOp.findUnique({
      where: { id: postOpId },
      include: { patient: { include: { lead: true } } }
    });

    if (!postOp || !postOp.patient.lead.phone) {
      logger.error('NotificationService', `Pós-Op ${postOpId} não encontrado ou sem telefone`);
      return;
    }

    const { patient, description, date } = postOp;
    const name = patient.lead.name;
    const dateStr = date.toLocaleDateString('pt-BR');
    const phone = patient.lead.phone;

    const template = await prisma.messageTemplate.findUnique({ where: { name: 'POST_OP_CONFIRMATION' } });
    
    const body = template?.content || `Olá, {{paciente}}. Seu retorno pós-operatório de *{{procedimento}}* está agendada para o dia *{{data}}*. Sua presença é fundamental para garantirmos sua plena recuperação! ✨\n\nPodemos confirmar?`;
    const optionsSuffix = `\n\n1️⃣ Sim, confirmado!\n2️⃣ Preciso reagendar\n3️⃣ Falar com atendente`;

    const finalMessage = TemplateParser.parse(body, {
      paciente: name,
      procedimento: description,
      data: dateStr
    }) + optionsSuffix;

    await prisma.notification.create({
      data: {
        postOpId,
        type: 'POST_OP_CONFIRMATION',
        status: 'SENT',
        sentAt: new Date()
      }
    });

    await WhatsappSession.save(phone, {
      stage: 'CONFIRM_APPOINTMENT', // Reutiliza estágio mas com flag postOpId
      postOpId,
      userName: name,
      lastInteraction: Date.now()
    });

    const instanceId = process.env.EVOLUTION_INSTANCE_ID || '';
    await WhatsappSender.sendMessage(instanceId, phone, finalMessage);
    
    logger.info('NotificationService', `Lembrete Pós-Op enviado para ${name} (${phone})`);
  }

  /**
   * Processa lembretes pendentes (Cronjob diário)
   */
  static async processDailyReminders() {
    const now = new Date();
    
    // 30 dias: exatos 30 dias a partir de amanhã
    const t30 = new Date(now);
    t30.setDate(now.getDate() + 30);
    
    // 7 dias
    const t7 = new Date(now);
    t7.setDate(now.getDate() + 7);
    
    // 48h (2 dias)
    const t2 = new Date(now);
    t2.setDate(now.getDate() + 2);

    const checkAndTrigger = async (targetDate: Date, type: any) => {
        const startOfDay = new Date(targetDate.setHours(0,0,0,0));
        const endOfDay = new Date(targetDate.setHours(23,59,59,999));

        const appointments = await prisma.appointment.findMany({
            where: {
                scheduledAt: { gte: startOfDay, lte: endOfDay },
                status: 'SCHEDULED',
                notifications: {
                    none: { type }
                }
            }
        });

        for (const appt of appointments) {
            await this.triggerReminder(appt.id, type);
        }
    };

    await checkAndTrigger(t30, 'REMINDER_30D');
    await checkAndTrigger(t7, 'REMINDER_7D');
    await checkAndTrigger(t2, 'CONFIRMATION_48H');

    // Processa Pós-Op (sempre 48h antes)
    await this.processDailyPostOpReminders();
  }

  static async processDailyPostOpReminders() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2); // 48h antes

    const startOfDay = new Date(targetDate.setHours(0,0,0,0));
    const endOfDay = new Date(targetDate.setHours(23,59,59,999));

    const postOps = await prisma.postOp.findMany({
        where: {
            date: { gte: startOfDay, lte: endOfDay },
            status: 'SCHEDULED',
            notifications: {
                none: { type: 'POST_OP_CONFIRMATION' }
            }
        }
    });

    for (const po of postOps) {
        await this.triggerPostOpReminder(po.id);
    }
  }

  /**
   * Verifica inatividade de confirmações críticas (24h de expediente sem resposta)
   */
  static async checkInactivity() {
    const notifications = await prisma.notification.findMany({
        where: {
            type: { in: ['CONFIRMATION_48H', 'POST_OP_CONFIRMATION'] },
            status: 'SENT',
            OR: [
              { appointment: { status: 'SCHEDULED' } },
              { postOp: { status: 'SCHEDULED' } }
            ]
        },
        include: { appointment: true, postOp: true }
    });

    for (const notification of notifications) {
        if (!notification.sentAt) continue;

        const workMinutes = this.calculateWorkMinutes(notification.sentAt, new Date());
        
        // 24 horas de expediente = 1440 minutos
        if (workMinutes >= 1440) {
            if (notification.appointmentId) {
                await prisma.appointment.update({
                    where: { id: notification.appointmentId },
                    data: { status: 'ATTENTION_REQUIRED' }
                });
            } else if (notification.postOpId) {
                await prisma.postOp.update({
                    where: { id: notification.postOpId },
                    data: { status: 'ATTENTION_REQUIRED' }
                });
            }
            
            logger.warn('NotificationService', `Inatividade detectada (24h úteis): Notificação ${notification.id} marcada como ATTENTION_REQUIRED`);
        }
    }
  }

  /**
   * Calcula minutos de expediente decorridos entre duas datas
   * Regra: Seg-Sex, 08:00 - 18:00
   */
  private static calculateWorkMinutes(start: Date, end: Date): number {
    let minutes = 0;
    const current = new Date(start);

    while (current < end) {
        const day = current.getDay();
        const hour = current.getHours();

        // 0 = Domingo, 6 = Sábado
        const isWeekday = day !== 0 && day !== 6;
        const isBusinessHour = hour >= 8 && hour < 18;

        if (isWeekday && isBusinessHour) {
            minutes++;
        }
        current.setMinutes(current.getMinutes() + 1);
    }
    return minutes;
  }
}
