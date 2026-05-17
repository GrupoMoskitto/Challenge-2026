import { logger } from '../config/logger';
import { prisma } from '@crmed/database';
import { evoGoClient, EvolutionApiError } from '../evolution/evolution.client';

export class WhatsappSender {
  private static sanitizePhone(phone: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  }

  private static isBlockedBySandbox(number: string): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    
    const devPhone = process.env.DEV_ALLOWED_PHONE;
    if (!devPhone) return false;

    const cleanDevPhone = devPhone.replace(/[^0-9]/g, '');
    return !number.includes(cleanDevPhone) && !cleanDevPhone.includes(number);
  }

  private static async logOutboundContact(leadId: string, message: string): Promise<void> {
    try {
      await prisma.contact.create({
        data: {
          leadId,
          date: new Date(),
          type: 'WHATSAPP',
          direction: 'OUTBOUND',
          status: 'SENT',
          message,
        }
      });
    } catch (dbError) {
      logger.warn('WhatsApp:Sender', `Não foi possível registrar o contato no DB para o lead ${leadId}`, dbError);
    }
  }

  /**
   * Envia mensagem de texto via WhatsApp (Evolution Go).
   */
  static async sendMessage(instanceId: string, phone: string, text: string, leadId?: string) {
    const number = this.sanitizePhone(phone);

    if (this.isBlockedBySandbox(number)) {
      logger.debug('WhatsApp:Sender', `[SANDBOX] Mensagem bloqueada para ${number}. Apenas ${process.env.DEV_ALLOWED_PHONE} permitido.`);
      return { delivered: false, status: 'blocked_by_dev_sandbox' };
    }

    try {
      logger.info('WhatsApp:Sender', `Enviando mensagem para ${number}...`);
      const response = await evoGoClient.sendText(number, text, 1200, instanceId || undefined);
      logger.success('WhatsApp:Sender', `Mensagem entregue para ${number}`);

      if (leadId) {
        await this.logOutboundContact(leadId, text);
      }

      return { delivered: true, messageId: response.Info?.ID };
    } catch (error: unknown) {
      const errMsg = error instanceof EvolutionApiError ? error.message : (error as Error).message;
      logger.error('WhatsApp:Sender', `Erro ao enviar mensagem para ${number}: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Envia um menu formatado com emojis numerados.
   */
  static async sendFormattedButtons(
    instanceId: string,
    phone: string,
    title: string,
    description: string,
    buttons: Array<{ id: string; title: string }>,
    leadId?: string,
    _footer?: string
  ) {
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    const optionsText = buttons
      .map((b, i) => `${numberEmojis[i] || `${i + 1}.`} *${b.title}*`)
      .join('\n');

    const message = [
      `*${title}*`,
      `_${description}_`,
      '',
      optionsText,
      '',
      '_Digite o número da opção desejada_',
    ].join('\n');

    if (leadId) {
      await this.logOutboundContact(leadId, `[Menu: ${buttons.map(b => b.title).join(' | ')}] ${title} - ${description}`);
    }

    return this.sendMessage(instanceId, phone, message);
  }

  /**
   * Envia um menu em lista formatado com seções.
   */
  static async sendFormattedList(
    instanceId: string,
    phone: string,
    title: string,
    description: string,
    _buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    leadId?: string,
    _footerText?: string
  ) {
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    let globalIndex = 0;

    const sectionsText = sections.map(section => {
      const header = `*━━━ ${section.title} ━━━*`;
      const rows = section.rows.map(row => {
        const emoji = numberEmojis[globalIndex] || `${globalIndex + 1}.`;
        globalIndex++;
        const desc = row.description ? ` — ${row.description}` : '';
        return `${emoji} *${row.title}*${desc}`;
      }).join('\n');
      return `${header}\n${rows}`;
    }).join('\n\n');

    const message = [
      `*📋 ${title}*`,
      `_${description}_`,
      '',
      sectionsText,
      '',
      `0️⃣ *Encerrar atendimento*`,
      '',
      '_Digite o número da opção desejada_',
    ].join('\n');

    if (leadId) {
      await this.logOutboundContact(leadId, `[Lista: ${title}]`);
    }

    return this.sendMessage(instanceId, phone, message);
  }

  /**
   * Retorna o status da conexão da instância.
   */
  static async connectionState(instanceId?: string) {
    return evoGoClient.getStatus(instanceId);
  }
}
