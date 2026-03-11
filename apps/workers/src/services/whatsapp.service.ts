import axios from 'axios';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '***REMOVED***';
const INSTANCE_NAME = 'crmed-whatsapp';

const api = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    apikey: EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
});

export const WhatsAppService = {
  /**
   * Envia uma mensagem de texto via The Evolution API.
   * IMPORTANTE: A instância precisa estar conectada no WhatsApp.
   */
  async sendMessage(phone: string, text: string) {
    // Evolution API expects numbers to have the country code usually without +, but we ensure it strips non-numeric cars
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    // Defaulting to Brasil +55 if it's missing
    const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

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

  /**
   * Verifica o status da Conexão. Util no processo de debug/dashboard se necessario
   */
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
