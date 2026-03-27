import 'dotenv/config';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// Inicializa a Queue simulando o disparo que o Cron Faria
const WHATSAPP_QUEUE_NAME = 'whatsapp-reminders';
const whatsappQueue = new Queue(WHATSAPP_QUEUE_NAME, {
  connection: redisConnection as any,
});

async function runTest() {
  const testPhone = process.env.DEV_ALLOWED_PHONE;
  
  if (!testPhone) {
    console.error("❌ ERRO: Por favor defina DEV_ALLOWED_PHONE=551199999999 no seu .env para testar.");
    process.exit(1);
  }

  console.log(`🚀 Adicionando mensagem de teste para a fila do Whatsapp (${testPhone})...`);

  const patientName = 'Usuário de Testes';

  // Adiciona o job na fila do BullMQ
  await whatsappQueue.add('send-test-reminder', {
    leadId: 'test-123',
    patientName,
    phone: testPhone,
    message: `Olá ${patientName.split(' ')[0]}, este é um Teste do Sandbox de Crons e Disparos Automáticos do CRMed gerado via BullMQ! ✅`,
    triggerDays: 0,
  });

  console.log("✅ Job adicionado à fila com sucesso!");
  console.log("⚠️ Verifique os logs do seu Worker (pnpm --filter @crmed/workers dev) para ver a execução.");
  
  // Fecha a conexão com o Redis para sair do script
  setTimeout(() => process.exit(0), 1000);
}

runTest();
