import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { NotificationService } from '../config/notification.service';
import { logger } from '../config/logger';
import { redisConnection } from '../config/redis';
import { ensureEvolutionReady } from '../evolution/evolution.setup';
import { evoGoClient } from '../evolution/evolution.client';

async function runCron() {
  logger.info('Test', 'Executando disparo manual do Cronjob Diário...');
  
  try {
    await ensureEvolutionReady(evoGoClient);
    
    await NotificationService.processDailyReminders();
    logger.success('Test', 'Varredura de agendamentos concluída com sucesso!');
    
    // Aguardar alguns segundos para dar tempo do BullMQ processar caso haja mensagens
    logger.info('Test', 'Aguardando 5 segundos para o processamento da fila...');
    setTimeout(() => {
      logger.info('Test', 'Encerrando script manual.');
      redisConnection.quit();
      process.exit(0);
    }, 5000);
  } catch (error) {
    logger.error('Test', 'Erro ao executar Cronjob manual', error);
    process.exit(1);
  }
}

runCron();
