import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { processDailyAppointments } from './jobs/dailyCron';
import './queues/whatsapp.processor';
import './queues/risk-score.processor';
import { CronJob } from 'cron';
import { logger } from './config/logger';
import { NotificationService } from './config/notification.service';

logger.info('System', 'CRMed Workers iniciando...');

import express from 'express';
import helmet from 'helmet';
import { ensureEvolutionReady } from './evolution/evolution.setup';
import { evoGoClient } from './evolution/evolution.client';
import { WhatsappChatbot } from './whatsapp/whatsapp.chatbot';
import { EvoGoWebhookEnvelope, EvoGoMessageWebhookData, EvoGoQRCodeWebhookData } from './evolution/evolution.types';

const PORT = process.env.WORKERS_PORT || 3002;

// Boot: ensure Evolution Go is ready
ensureEvolutionReady(evoGoClient);

logger.success('System', 'WhatsApp BullMQ Worker iniciado');

const job = new CronJob('0 8 * * *', async () => {
    logger.info('Cron', 'Executando tarefa agendada de agendamentos diários...');
    await processDailyAppointments();
    await NotificationService.processDailyReminders();
    await NotificationService.checkInactivity();
}, null, true, 'America/Sao_Paulo');

job.start();
logger.success('System', 'Cronjob diário agendado para 08:00 AM');

if (process.env.NODE_ENV !== 'production') {
    setTimeout(() => {
        logger.info('Dev', 'Executando agendamentos diários iniciais...');
        processDailyAppointments();
    }, 5000);
}

const app = express();

// Security headers
app.use(helmet());

// Limit payload size to prevent DoS
app.use(express.json({ limit: '50mb' }));

// Test endpoints for Confirmation Flow
app.post('/test/trigger-reminder', async (req, res) => {
    const { appointmentId, type } = req.body;
    if (!appointmentId || !type) {
        return res.status(400).json({ error: 'appointmentId e type são obrigatórios' });
    }
    try {
        await NotificationService.triggerReminder(appointmentId, type);
        res.json({ success: true, message: `Lembrete ${type} disparado` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/test/check-inactivity', async (req, res) => {
    try {
        await NotificationService.checkInactivity();
        res.json({ success: true, message: 'Verificação de inatividade concluída' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/test/trigger-postop', async (req, res) => {
    const { postOpId } = req.body;
    if (!postOpId) {
        return res.status(400).json({ error: 'postOpId é obrigatório' });
    }
    try {
        await NotificationService.triggerPostOpReminder(postOpId);
        res.json({ success: true, message: `Lembrete de Pós-Op disparado` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/webhook/evolution', async (req, res) => {
    try {
        const body = req.body as EvoGoWebhookEnvelope;
        const { event, data, instanceId } = body;

        switch (event) {
            case 'Message': {
                const msgData = data as unknown as EvoGoMessageWebhookData;
                const info = msgData?.Info;
                const message = msgData?.Message;

                if (!info || !message) break;
                
                // Ignore messages from self, status updates, groups, or broadcasts
                if (
                    info.IsFromMe || 
                    info.Chat === 'status@broadcast' || 
                    info.Chat.endsWith('@g.us') || 
                    info.Chat.endsWith('@broadcast')
                ) {
                    break;
                }

                const textMessage = (
                    message.conversation ||
                    message.extendedTextMessage?.text ||
                    ''
                ).trim();

                if (!textMessage) break;

                const pushName = info.PushName || 'Você';
                const logText = textMessage.replace(/\n/g, ' ').substring(0, 60);
                logger.info('Webhook', `[MESSAGE] De: ${pushName} | Chat: ${info.Chat} | Texto: ${logText}`);

                await WhatsappChatbot.handleRawMessage(
                    instanceId || process.env.EVOLUTION_INSTANCE_ID || '',
                    info.Chat,
                    pushName,
                    textMessage
                );
                break;
            }

            case 'Connected':
                logger.success('Webhook', `✅ Instância ${instanceId} conectada ao WhatsApp!`);
                break;

            case 'PairSuccess':
                logger.success('Webhook', `🔗 Pareamento concluído para instância ${instanceId}`);
                break;

            case 'QRCode': {
                const qrData = data as unknown as EvoGoQRCodeWebhookData;
                logger.info('Webhook', `📱 QR Code recebido para instância ${instanceId} (${qrData?.code ? 'válido' : 'sem código'})`);
                break;
            }

            case 'QRTimeout':
                logger.warn('Webhook', `⏰ QR Code expirou para instância ${instanceId}`);
                break;

            case 'LoggedOut':
                logger.warn('Webhook', `⚠️ Instância ${instanceId} foi desconectada do WhatsApp`);
                break;

            case 'OfflineSyncCompleted':
                logger.info('Webhook', `📥 Sincronização offline concluída para ${instanceId}`);
                break;

            default:
                logger.debug('Webhook', `Evento não tratado: ${event} (instância: ${instanceId})`);
                break;
        }

        res.status(200).json({ received: true });
    } catch (error: unknown) {
        logger.error('Webhook', 'Erro ao processar evento:', error);
        res.status(200).json({ received: true, error: true });
    }
});

app.listen(Number(PORT), '0.0.0.0', () => {
    logger.success('System', `Servidor HTTP rodando na porta ${PORT}`);
});
