import 'dotenv/config';
import { processDailyAppointments } from './jobs/dailyCron';
import { whatsappWorker } from './queues/whatsapp.processor';
import { CronJob } from 'cron';

console.log('CRMed Workers starting...');

import express from 'express';
import bodyParser from 'body-parser';

const PORT = process.env.PORT || 3002;

console.log('✅ WhatsApp BullMQ Worker Initialized');

const job = new CronJob('0 8 * * *', async () => {
    console.log('[Cron] Running scheduled Daily Appointments task...');
    await processDailyAppointments();
}, null, true, 'America/Sao_Paulo');

job.start();
console.log('✅ Daily Cronjob Scheduled for 08:00 AM');

if (process.env.NODE_ENV !== 'production') {
    setTimeout(() => {
        console.log('[Dev] Firing initial run of daily appointments...');
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

        const remoteJid = data.key?.remoteJid;
        const pushName = data.pushName || 'Você';
        
        const textMessage = messageInfo.conversation || messageInfo.extendedTextMessage?.text;

        if (textMessage) {
            console.log(`[Webhook] Nova mensagem de ${pushName} (${remoteJid}): ${textMessage}`);
            
            const { WhatsAppService } = await import('./services/whatsapp.service');
            
            const replyText = `Olá ${pushName}! 👋 Você mandou: "${textMessage}".\n\n_Esta é uma mensagem automática de boas-vindas do sistema de desenvolvimento CRMed._`;
            
            console.log(`[Webhook] Respondendo automaticamente para ${remoteJid}...`);
            await WhatsAppService.sendMessage(remoteJid, replyText);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('[Webhook] Erro processando hook da Evolution API:', error);
        res.status(500).send('Error');
    }
});

app.listen(PORT, () => {
    console.log(`✅ Workers HTTP Webhook Server listening on port ${PORT}`);
});
