import { redisConnection } from '../config/redis';
import { prisma } from '@crmed/database';
import { logger } from '../config/logger';

const STATE_PREFIX = 'whatsapp_state:';
const STATE_TTL = 3600; // 1 hour in seconds

export type ChatStage = 
  | 'START' 
  | 'NEW_ASK_NAME' 
  | 'NEW_CONFIRM_NAME'
  | 'NEW_ASK_EMAIL'
  | 'NEW_ASK_INTEREST' 
  | 'EXISTING_MENU' 
  | 'EXISTING_FAQ' 
  | 'EXISTING_PROCEDURE' 
  | 'EXISTING_SCHEDULE'
  | 'CONFIRM_APPOINTMENT'
  | 'RESCHEDULE_SEARCH'
  | 'HUMAN_HANDOVER'
  | 'VERIFY_DOB_ENRICH'
  | 'VERIFY_DOB_CHALLENGE'
  | 'APPOINTMENT_LIST'
  | 'APPOINTMENT_CANCEL_CONFIRM';

export interface ChatState {
  stage: ChatStage;
  userName?: string;
  email?: string;
  interest?: string;
  leadId?: string;
  appointmentId?: string;
  postOpId?: string;
  lastInteraction?: number;
  lastVerificationAt?: number;
  selectedApptIndex?: number;
}

export class WhatsappSession {
  /**
   * Obtém a sessão ativa de um número
   */
  static async get(jid: string): Promise<ChatState> {
    const key = `${STATE_PREFIX}${jid}`;
    
    const stateJSON = await redisConnection.get(key);
    if (stateJSON) {
      try {
        return JSON.parse(stateJSON) as ChatState;
      } catch (e) {
        logger.warn('WhatsApp:Session', `Invalid JSON in Redis for ${jid}, resetting`);
      }
    }

    try {
      const session = await prisma.whatsappSession.findUnique({
        where: { jid }
      });

      if (session && session.expiresAt > new Date()) {
        const state = session.data as unknown as ChatState;
        await redisConnection.set(key, JSON.stringify(state), 'EX', STATE_TTL);
        return state;
      } else if (session) {
        await prisma.whatsappSession.delete({ where: { jid } }).catch(() => {});
      }
    } catch (e) {
    }

    return { stage: 'START' };
  }

  /**
   * Salva a sessão
   */
  static async save(jid: string, state: ChatState): Promise<void> {
    const key = `${STATE_PREFIX}${jid}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + STATE_TTL * 1000);

    await redisConnection.set(key, JSON.stringify(state), 'EX', STATE_TTL);

    try {
      await prisma.whatsappSession.upsert({
        where: { jid },
        update: {
          stage: state.stage,
          data: state as any,
          expiresAt
        },
        create: {
          jid,
          stage: state.stage,
          data: state as any,
          expiresAt
        }
      });
    } catch (e) {
      // Fail-safe: Redis já garantiu o estado temporário
      logger.warn('WhatsApp:Session', `Não foi possível persistir sessão no banco para ${jid}`, e);
    }
  }

  /**
   * Limpa a sessão
   */
  static async clear(jid: string): Promise<void> {
    const key = `${STATE_PREFIX}${jid}`;
    await redisConnection.del(key);
    
    try {
      await prisma.whatsappSession.delete({ where: { jid } }).catch(() => {});
    } catch (e) {
    }
  }
}
