import { logger } from '../config/logger';
import { evoGoClient } from '../evolution/evolution.client';

export const WhatsAppService = {
  async sendMessage(instanceName: string, phone: string, text: string) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    if (process.env.NODE_ENV !== 'production') {
      const devPhone = process.env.DEV_ALLOWED_PHONE;
      if (devPhone) {
        const cleanDevPhone = devPhone.replace(/[^0-9]/g, '');
        if (!number.includes(cleanDevPhone) && !cleanDevPhone.includes(number)) {
          logger.info('WhatsApp', `[SANDBOX] Mensagem bloqueada para ${number}. Apenas ${process.env.DEV_ALLOWED_PHONE} permitido.`);
          return { simulated: true, status: 'blocked_by_dev_sandbox' };
        }
      }
    }

    try {
      logger.info('WhatsApp', `Enviando mensagem para ${number} via ${instanceName}...`);
      console.log('[WhatsAppService] Sending to:', number, 'text:', text.substring(0, 30));
      
      const response = await evoGoClient.sendText(number, text);
      console.log('[WhatsAppService] Response:', response);

      logger.success('WhatsApp', `Mensagem enviada para ${number}`);
      return response;
    } catch (error: any) {
      logger.error('WhatsApp', `Falha ao enviar mensagem para ${number}`, error?.message);
      throw error;
    }
  },

  async connectionState(instanceName: string) {
    try {
      const response = await evoGoClient.getStatus();
      return response;
    } catch (error: any) {
      logger.error('WhatsApp', `Falha ao obter estado da instância ${instanceName}`, error?.message);
      return { Connected: false, LoggedIn: false };
    }
  }
};

