import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { processDailyAppointments } from './jobs/dailyCron';
import './queues/whatsapp.processor';
import { CronJob } from 'cron';
import { logger } from './config/logger';

logger.info('System', 'CRMed Workers iniciando...');

import express from 'express';
import helmet from 'helmet';
import { webhookSecurityMiddleware } from './config/webhook-security';

const PORT = process.env.WORKERS_PORT || 3002;

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
app.use(express.json({ limit: '1mb' }));

// Apply webhook security middleware (HMAC + IP allowlist)
app.post('/webhook/evolution', webhookSecurityMiddleware({
    requireSecret: process.env.NODE_ENV === 'production',
    enforceIpAllowlist: true,
}), async (req, res) => {
    try {
        const body = req.body as Record<string, unknown>;
        
        if (body.event !== 'messages.upsert') {
            return res.status(200).send('OK');
        }

        const data = body.data as Record<string, unknown>;
        const messageRaw = (data as Record<string, unknown>).message;
        const messageInfo = Array.isArray(messageRaw) ? messageRaw[0] as Record<string, unknown> : messageRaw as Record<string, unknown>;
        
        if (!messageInfo) {
            return res.status(200).send('No message found');
        }

        const key = (data as Record<string, unknown>).key as Record<string, unknown> | undefined;
        if (key?.fromMe || key?.remoteJid === 'status@broadcast') {
            return res.status(200).send('Ignored');
        }

        // Ignore old messages (e.g. older than 10 seconds) to avoid processing backlogs
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const messageTimestamp = (messageInfo as Record<string, unknown>).messageTimestamp as number | undefined;
        const pushName = ((data as Record<string, unknown>).pushName as string) || 'Você';
        if (messageTimestamp && (currentTimestamp - messageTimestamp > 10)) {
            logger.info('Webhook', `Ignorando mensagem antiga de ${pushName} (${currentTimestamp - messageTimestamp}s atrás)`);
            return res.status(200).send('Ignored old message');
        }

        const remoteJid = key?.remoteJid as string | undefined;
        const instanceName = body.instance as string;
        
        const conversation = (messageInfo as Record<string, unknown>).conversation as string | undefined;
        const extendedText = (messageInfo as Record<string, unknown>).extendedTextMessage as Record<string, unknown> | undefined;
        const textMessage = conversation || extendedText?.text as string | undefined;

        if (textMessage) {
            logger.info('Webhook', `Mensagem de ${pushName}: ${textMessage.substring(0, 50)}${textMessage.length > 50 ? '...' : ''}`);
            
            const { ChatbotService } = await import('./services/chatbot.service');
            await ChatbotService.handleMessage(instanceName, remoteJid, pushName, textMessage);
        }

        res.status(200).send('OK');
    } catch (error: unknown) {
        const err = error as Record<string, unknown>;
        const response = err?.response as Record<string, unknown> | undefined;
        const status = response?.status as number | undefined;
        const isAuthError = status === 401 || status === 403;
        
        if (!isAuthError) {
            logger.error('Webhook', 'Erro processando hook da Evolution API', error);
        }
        res.status(200).send('OK'); // Still respond OK to avoid retries
    }
});

app.listen(Number(PORT), '0.0.0.0', () => {
    logger.success('System', `Servidor HTTP rodando na porta ${PORT}`);
});
