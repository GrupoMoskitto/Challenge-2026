import axios from 'axios';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'crmed_evolution_api_token_123';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'crmed-whatsapp';
const DEV_ALLOWED_PHONE = process.env.DEV_ALLOWED_PHONE;

const api = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    apikey: EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
});

export const WhatsAppService = {
  async sendMessage(phone: string, text: string) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    if (process.env.NODE_ENV !== 'production' && DEV_ALLOWED_PHONE) {
      const cleanDevPhone = DEV_ALLOWED_PHONE.replace(/[^0-9]/g, '');
      if (!number.includes(cleanDevPhone) && !cleanDevPhone.includes(number)) {
        console.log(`[DEV MODE] 🛡️ Mensagem bloqueada para ${number}. O sistema está restrito para enviar apenas para: ${DEV_ALLOWED_PHONE}`);
        return { simulated: true, status: 'blocked_by_dev_sandbox' };
      }
    }

    try {
      const response = await api.post(`/message/sendText/${INSTANCE_NAME}`, {
        number,
        options: {
          delay: 1200,
          presence: 'composing',
        },
        text: text,
      });

      return response.data;
    } catch (error: any) {
      console.error('Failed to send WhatsApp message via Evolution API:', error?.response?.data || error.message);
      throw error;
    }
  },

  async connectionState() {
    try {
      const response = await api.get(`/instance/connectionState/${INSTANCE_NAME}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get instance state:', error?.response?.data || error.message);
      return { instance: { state: 'disconnected' } };
    }
  }
};
