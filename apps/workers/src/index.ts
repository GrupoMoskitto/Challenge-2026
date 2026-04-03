import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { processDailyAppointments } from './jobs/dailyCron';
import './queues/whatsapp.processor';
import { CronJob } from 'cron';
import { logger } from './config/logger';

logger.info('System', 'CRMed Workers iniciando...');

import express from 'express';
import bodyParser from 'body-parser';

const PORT = process.env.PORT || 3002;

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
app.use(bodyParser.json());

app.post('/webhook/evolution', async (req, res) => {
    try {
        const body = req.body;
        
        if (body.event !== 'messages.upsert') {
            return res.status(200).send('OK');
        }

        const data = body.data;
        const messageInfo = Array.isArray(data.message) ? data.message[0] : data.message;
        
        if (!messageInfo) {
            return res.status(200).send('No message found');
        }

        if (data.key?.fromMe || data.key?.remoteJid === 'status@broadcast') {
            return res.status(200).send('Ignored');
        }

        // Ignore old messages (e.g. older than 10 seconds) to avoid processing backlogs
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const messageTimestamp = messageInfo.messageTimestamp;
        const pushName = data.pushName || 'Você';
        if (messageTimestamp && (currentTimestamp - messageTimestamp > 10)) {
            logger.info('Webhook', `Ignorando mensagem antiga de ${pushName} (${currentTimestamp - messageTimestamp}s atrás)`);
            return res.status(200).send('Ignored old message');
        }

        const remoteJid = data.key?.remoteJid;
        const instanceName = body.instance;
        
        const textMessage = messageInfo.conversation || messageInfo.extendedTextMessage?.text;

        if (textMessage) {
            logger.info('Webhook', `Mensagem de ${pushName}: ${textMessage.substring(0, 50)}${textMessage.length > 50 ? '...' : ''}`);
            
            const { ChatbotService } = await import('./services/chatbot.service');
            await ChatbotService.handleMessage(instanceName, remoteJid, pushName, textMessage);
        }

        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook', 'Erro processando hook da Evolution API', error);
        res.status(500).send('Error');
    }
});

app.listen(Number(PORT), '0.0.0.0', () => {
    logger.success('System', `Servidor HTTP rodando na porta ${PORT}`);
});
