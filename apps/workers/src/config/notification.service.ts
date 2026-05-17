import { prisma, TemplateParser } from '@crmed/database';
import { logger } from './logger';
import { WhatsappSender } from '../whatsapp/whatsapp.sender';
import { WhatsappSession } from '../whatsapp/whatsapp.session';

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

    // 1. Busca Template no Banco por triggerDays (Single Source of Truth)
    const triggerDaysMap = {
      'REMINDER_30D': 30,
      'REMINDER_7D': 7,
      'CONFIRMATION_48H': 2
    };
    const days = triggerDaysMap[type];
    const template = await prisma.messageTemplate.findFirst({ where: { triggerDays: days } });
    
    if (!template) {
      logger.error('NotificationService', `Template para ${type} (${days} dias) não encontrado no banco de dados. Abortando envio.`);
      return;
    }

    // 2. Parse das Variáveis (Sem fallbacks hardcoded conforme requisitos)
    const finalMessage = TemplateParser.parse(template.content, {
      paciente: name,
      procedimento: procedure,
      medico: surgeon.name,
      data: dateStr,
      hora: hourStr,
      horario: hourStr,
    });

    // 4. Atualiza a sessão do WhatsApp (JID completo para matching correto no webhook)
    const sanitizedPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${sanitizedPhone.startsWith('55') ? sanitizedPhone : `55${sanitizedPhone}`}@s.whatsapp.net`;
    await WhatsappSession.save(jid, {
      stage: 'CONFIRM_APPOINTMENT',
      appointmentId,
      leadId: patient.lead.id,
      userName: name,
      lastInteraction: Date.now()
    });

    // 5. Enfileira o envio de mensagem para o BullMQ (Robustez e Retries)
    try {
      const { whatsappQueue } = require('../queues/whatsapp.processor');
      await whatsappQueue.add('send-reminder', {
        appointmentId,
        leadId: patient.lead.id,
        patientName: name,
        phone,
        message: finalMessage,
        triggerDays: days,
      });
      logger.info('NotificationService', `Lembrete ${type} enfileirado para ${name} (${phone}) - BullMQ`);
    } catch (error) {
      logger.error('NotificationService', `Falha ao enfileirar lembrete ${type} para ${appointmentId}`, error);
    }
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

    const template = await prisma.messageTemplate.findFirst({ where: { triggerDays: -1 } });
    
    if (!template) {
      logger.error('NotificationService', `Template para Pós-Op (-1 dias) não encontrado no banco de dados. Abortando envio.`);
      return;
    }

    const finalMessage = TemplateParser.parse(template.content, {
      paciente: name,
      procedimento: description,
      data: dateStr,
    });

    // JID completo para matching correto no webhook
    const sanitizedPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${sanitizedPhone.startsWith('55') ? sanitizedPhone : `55${sanitizedPhone}`}@s.whatsapp.net`;
    await WhatsappSession.save(jid, {
      stage: 'CONFIRM_APPOINTMENT',
      postOpId,
      leadId: patient.lead.id,
      userName: name,
      lastInteraction: Date.now()
    });

    try {
      const { whatsappQueue } = require('../queues/whatsapp.processor');
      await whatsappQueue.add('send-post-op', {
        postOpId,
        leadId: patient.lead.id,
        patientName: name,
        phone,
        message: finalMessage,
        triggerDays: -1,
      });
      logger.info('NotificationService', `Lembrete Pós-Op enfileirado para ${name} (${phone}) - BullMQ`);
    } catch (error) {
      logger.error('NotificationService', `Falha ao enfileirar lembrete Pós-Op para ${postOpId}`, error);
    }
  }

  /**
   * Processa lembretes pendentes (Cronjob diário)
   */
  static async processDailyReminders() {
    const now = new Date();
    logger.info('NotificationService', 'Iniciando processamento diário de lembretes...');
    
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

        // Busca todos os SCHEDULED no range para logarmos quem foi ignorado
        const allInWindow = await prisma.appointment.findMany({
            where: {
                scheduledAt: { gte: startOfDay, lte: endOfDay },
                status: 'SCHEDULED',
            },
            include: { notifications: true }
        });

        const eligible = allInWindow.filter(appt => !appt.notifications.some(n => n.type === type));
        const skipped = allInWindow.filter(appt => appt.notifications.some(n => n.type === type));

        logger.info('NotificationService', `[${type}] Janela: ${startOfDay.toISOString()} até ${endOfDay.toISOString()}`);
        logger.info('NotificationService', `[${type}] Avaliados: ${allInWindow.length} | Elegíveis: ${eligible.length} | Ignorados: ${skipped.length}`);

        for (const appt of skipped) {
            logger.debug('NotificationService', `[${type}] Agendamento ${appt.id} ignorado: Notificação já existente.`);
        }

        for (const appt of eligible) {
            await this.triggerReminder(appt.id, type);
        }
    };

    await checkAndTrigger(t30, 'REMINDER_30D');
    await checkAndTrigger(t7, 'REMINDER_7D');
    await checkAndTrigger(t2, 'CONFIRMATION_48H');

    // Processa Pós-Op (sempre 48h antes)
    await this.processDailyPostOpReminders();
    
    logger.info('NotificationService', 'Processamento diário de lembretes concluído.');
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
   * RN: Monitoramento de SLA de 24 horas úteis (Seg-Sex, 08:00 - 18:00)
   */
  static async checkInactivity() {
    logger.info('NotificationService', 'Iniciando verificação de SLA de inatividade...');
    
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
            // Verifica se já existe uma notificação de erro/inatividade para evitar duplicados
            const alreadyAlerted = await prisma.notification.findFirst({
              where: {
                type: 'NO_RESPONSE_48H',
                appointmentId: notification.appointmentId,
                postOpId: notification.postOpId,
              }
            });

            if (alreadyAlerted) continue;

            if (notification.appointmentId) {
                const appt = notification.appointment as any; // Cast to bypass strict types if needed or just use current status
                
                await prisma.appointment.update({
                    where: { id: notification.appointmentId },
                    data: { status: 'ATTENTION_REQUIRED' }
                });

                // Create AuditLog for the status change
                await prisma.auditLog.create({
                    data: {
                        entityType: 'Appointment',
                        entityId: notification.appointmentId,
                        action: 'STATUS_CHANGE',
                        oldValue: appt.status || 'SCHEDULED',
                        newValue: 'ATTENTION_REQUIRED',
                        reason: 'SLA de 24h úteis para confirmação de 48h violado',
                        userId: 'system', // Indicates automated action
                        appointmentId: notification.appointmentId
                    }
                });

                // Enqueue risk score recalculation since status changed
                try {
                    const { riskScoreQueue } = require('../queues/risk-score.processor');
                    await riskScoreQueue.add('recalculate', { appointmentId: notification.appointmentId });
                    logger.info('NotificationService', `Enqueued risk score recalculation for ${notification.appointmentId}`);
                } catch (e: any) {
                    logger.error('NotificationService', `Failed to enqueue risk score recalculation`, e);
                }

                // Cria notificação crítica para o TopBar UI
                await prisma.notification.create({
                  data: {
                    type: 'NO_RESPONSE_48H',
                    status: 'PENDING',
                    appointmentId: notification.appointmentId,
                    sentAt: new Date()
                  }
                });
            } else if (notification.postOpId) {
                await prisma.postOp.update({
                    where: { id: notification.postOpId },
                    data: { status: 'ATTENTION_REQUIRED' }
                });

                await prisma.notification.create({
                  data: {
                    type: 'NO_RESPONSE_48H',
                    status: 'PENDING',
                    postOpId: notification.postOpId,
                    sentAt: new Date()
                  }
                });
            }
            
            logger.warn('NotificationService', `🚨 SLA VIOLADO (24h úteis): Notificação ${notification.id} gerou alerta crítico NO_RESPONSE_48H`);
        }
    }
  }

  /**
   * Calcula minutos de expediente decorridos entre duas datas
   * Regra: Seg-Sex, 08:00 - 18:00 (10 horas por dia = 600 min/dia)
   */
  private static calculateWorkMinutes(start: Date, end: Date): number {
    if (start > end) return 0;

    let totalMinutes = 0;
    const current = new Date(start);

    // Ajusta o início para o primeiro minuto válido de expediente se necessário
    if (current.getHours() >= 18) {
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
    } else if (current.getHours() < 8) {
      current.setHours(8, 0, 0, 0);
    }

    while (current < end) {
      const day = current.getDay();
      const isWeekend = day === 0 || day === 6;

      if (isWeekend) {
        current.setDate(current.getDate() + 1);
        current.setHours(8, 0, 0, 0);
        continue;
      }

      const businessEnd = new Date(current);
      businessEnd.setHours(18, 0, 0, 0);

      const nextStart = new Date(current);
      nextStart.setDate(nextStart.getDate() + 1);
      nextStart.setHours(8, 0, 0, 0);

      if (end <= businessEnd) {
        // O período termina hoje dentro do expediente
        totalMinutes += Math.floor((end.getTime() - current.getTime()) / 60000);
        break;
      } else {
        // O período ultrapassa o expediente de hoje
        totalMinutes += Math.floor((businessEnd.getTime() - current.getTime()) / 60000);
        current.setTime(nextStart.getTime());
      }
    }

    return totalMinutes;
  }
}
