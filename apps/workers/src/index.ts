import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { processDailyAppointments } from './jobs/dailyCron';
import './queues/whatsapp.processor';
import { CronJob } from 'cron';
import { logger } from './config/logger';

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
app.use(express.json({ limit: '10mb' }));

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
                if (info.IsFromMe || info.Chat === 'status@broadcast') break;

                const textMessage = (
                    message.conversation ||
                    message.extendedTextMessage?.text ||
                    ''
                ).trim();

                if (!textMessage) break;

                const pushName = info.PushName || 'Você';
                logger.info('Webhook', `[MESSAGE] De: ${pushName} | Chat: ${info.Chat} | Texto: ${textMessage.substring(0, 60)}`);

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
