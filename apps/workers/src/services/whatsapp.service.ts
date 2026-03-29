import axios from 'axios';
import { logger } from '../config/logger';

const isProduction = process.env.NODE_ENV === 'production';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || (isProduction ? (() => { throw new Error('EVOLUTION_API_KEY is required in production'); })() : 'dev-token-do-not-use-in-prod');
const DEV_ALLOWED_PHONE = process.env.DEV_ALLOWED_PHONE;

const api = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    apikey: EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
});

export const WhatsAppService = {
  async sendMessage(instanceName: string, phone: string, text: string) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    if (process.env.NODE_ENV !== 'production' && DEV_ALLOWED_PHONE) {
      const cleanDevPhone = DEV_ALLOWED_PHONE.replace(/[^0-9]/g, '');
      if (!number.includes(cleanDevPhone) && !cleanDevPhone.includes(number)) {
        logger.info('WhatsApp', `Mensagem bloqueada para ${number} (sandbox ativo)`);
        return { simulated: true, status: 'blocked_by_dev_sandbox' };
      }
    }

    try {
      logger.info('WhatsApp', `Enviando mensagem para ${number} via ${instanceName}...`);
      const response = await api.post(`/message/sendText/${instanceName}`, {
        number,
        options: {
          delay: 1200,
          presence: 'composing',
        },
        text: text,
      });

      logger.success('WhatsApp', `Mensagem enviada para ${number}`);
      return response.data;
    } catch (error: any) {
      logger.error('WhatsApp', `Falha ao enviar mensagem para ${number}`, error?.response?.data || error.message);
      throw error;
    }
  },

  async connectionState(instanceName: string) {
    try {
      const response = await api.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error('WhatsApp', `Falha ao obter estado da instância ${instanceName}`, error?.response?.data || error.message);
      return { instance: { state: 'disconnected' } };
    }
  }
};
