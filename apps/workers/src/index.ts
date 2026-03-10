import { processDailyAppointments } from './jobs/dailyCron';
import { whatsappWorker } from './queues/whatsapp.processor';
import { CronJob } from 'cron';

console.log('CRMed Workers starting...');

// The WhatsApp Worker automatically connects and starts listening to the Redis queue
console.log('✅ WhatsApp BullMQ Worker Initialized');

// Schedule the daily varredura de agendamentos (Por padrão: Todo dia às 08:00h da manhã)
// The cron expression '0 8 * * *' specifies to run at 8:00 AM every single day.
const job = new CronJob('0 8 * * *', async () => {
    console.log('[Cron] Running scheduled Daily Appointments task...');
    await processDailyAppointments();
}, null, true, 'America/Sao_Paulo');

job.start();
console.log('✅ Daily Cronjob Scheduled for 08:00 AM');

// For development/initialization purposes, we trigger it right away
if (process.env.NODE_ENV !== 'production') {
    setTimeout(() => {
        console.log('[Dev] Firing initial run of daily appointments...');
        processDailyAppointments();
    }, 5000);
}
