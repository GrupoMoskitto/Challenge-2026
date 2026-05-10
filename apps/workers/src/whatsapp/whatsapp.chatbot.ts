import { prisma, checkUniqueness } from '@crmed/database';
import { logger } from '../config/logger';
import { WhatsappSession, ChatState } from './whatsapp.session';
import { WhatsappSender } from './whatsapp.sender';
import { IdentityService } from '../services/identity.service';
import { AppointmentService } from '../services/appointment.service';

const recentMessages = new Set<string>();

export class WhatsappChatbot {
  static async handleRawMessage(
    instanceId: string,
    remoteJid: string,
    pushName: string,
    textMessage: string
  ) {
    console.log(`[DEBUG] handleRawMessage called for ${remoteJid} with message: ${textMessage}`);
    const urgentKeywords = ['emergencia', 'dor', 'atrasado', 'atraso', 'hospital', 'acidente', 'sangue', 'urgente'];
    if (urgentKeywords.some(k => textMessage.toLowerCase().includes(k))) {
      logger.warn('WhatsApp:Chatbot', `Urgência detectada de ${remoteJid}: ${textMessage}`);
      await WhatsappSender.sendMessage(instanceId, remoteJid, `Entendi que se trata de uma situação urgente/imprevista. Estou conectando você agora mesmo com nossa equipe de acolhimento humana. Por favor, aguarde um instante.`);
      await WhatsappSession.clear(remoteJid);
      return;
    }

    const messageFingerprint = `${remoteJid}:${textMessage}:${Math.floor(Date.now() / 10000)}`;
    if (recentMessages.has(messageFingerprint)) {
      logger.debug('WhatsApp:Chatbot', `Ignorando mensagem duplicada de ${remoteJid}`);
      return;
    }
    recentMessages.add(messageFingerprint);
    setTimeout(() => recentMessages.delete(messageFingerprint), 10000);

    await this.processIncoming(instanceId, remoteJid, pushName, textMessage);
  }

  private static async processIncoming(
    instanceId: string,
    remoteJid: string,
    pushName: string,
    textMessage: string
  ) {
    const phone = remoteJid.split('@')[0];
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const logText = textMessage.replace(/\n/g, ' ').substring(0, 50);
    logger.info('WhatsApp:Chatbot', `[INBOUND] Mensagem de ${pushName} (${cleanPhone}): ${logText}...`);

    const state = await WhatsappSession.get(remoteJid);

    if (state.appointmentId) {
      const appt = await prisma.appointment.findUnique({ where: { id: state.appointmentId } });
      if (!appt || appt.status !== 'SCHEDULED' || appt.scheduledAt < new Date()) {
        logger.info('WhatsApp:Chatbot', `Contexto obsoleto para ${remoteJid} (appt: ${state.appointmentId})`);
        state.appointmentId = undefined;
        state.stage = 'START';
        if (/^\d$/.test(textMessage.trim())) {
          await WhatsappSender.sendMessage(instanceId, remoteJid, `Olá! Notei que você tentou responder a uma notificação de uma consulta que já não está mais ativa. Como posso te ajudar hoje?`);
          await WhatsappSession.clear(remoteJid);
          return;
        }
      }
    }

    const previousStage = state.stage;

    if (state.leadId) {
      prisma.contact.create({
        data: {
          leadId: state.leadId,
          date: new Date(),
          type: 'WHATSAPP',
          direction: 'INBOUND',
          status: 'DELIVERED',
          message: textMessage,
        }
      }).catch(err => logger.warn('WhatsApp:Chatbot', 'Erro ao salvar inbound contact', err));
    }

    try {
      await this.processStage(instanceId, remoteJid, pushName, cleanPhone, textMessage, state);
      
      if (state.stage !== previousStage) {
        logger.debug('WhatsApp:Chatbot', `Transição de estado para ${remoteJid}: ${previousStage} -> ${state.stage}`);
      }
    } catch (error) {
      logger.error('WhatsApp:Chatbot', `Erro processando estágio ${state.stage} para ${remoteJid}`, error);
      await WhatsappSender.sendMessage(instanceId, remoteJid, `Ocorreu um erro interno. Por favor, tente novamente mais tarde.`, state.leadId);
    }
  }

  private static async processStage(
    instanceId: string, 
    remoteJid: string, 
    pushName: string, 
    phone: string, 
    textMessage: string, 
    state: ChatState
  ) {
    if (state.stage === 'START') {
      const lead = await prisma.lead.findFirst({
        where: { phone: { contains: phone.substring(phone.length - 8) } }
      });

      if (lead) {
        state.stage = 'EXISTING_MENU';
        state.userName = lead.name;
        state.leadId = lead.id;
        await WhatsappSession.save(remoteJid, state);
        
        const greetingMsg = `Olá, ${lead.name}. Seja bem-vindo(a) de volta ao canal de atendimento do Hospital São Rafael.`;
        await WhatsappSender.sendMessage(instanceId, remoteJid, greetingMsg, state.leadId);
        await this.sendExistingMenuOptions(instanceId, remoteJid, state.leadId);
        return;
      } else {
        state.stage = 'NEW_ASK_NAME';
        await WhatsappSession.save(remoteJid, state);
        
        const text = `Olá. Seja bem-vindo(a) ao atendimento do *Hospital São Rafael*.\n\nPara iniciarmos o seu atendimento de forma personalizada, por favor, informe: *como gostaria de ser chamado(a)?*`;
        await WhatsappSender.sendMessage(instanceId, remoteJid, text);
        return;
      }
    }

    switch (state.stage) {
      case 'CONFIRM_APPOINTMENT':
        if (textMessage === '1') {
          if (state.appointmentId) {
            await prisma.appointment.update({
              where: { id: state.appointmentId },
              data: { status: 'CONFIRMED' }
            });
          } else if (state.postOpId) {
            await prisma.postOp.update({
              where: { id: state.postOpId },
              data: { status: 'CONFIRMED' }
            });
          }
          await WhatsappSender.sendMessage(instanceId, remoteJid, `Perfeito! Sua presença está confirmada. Ficamos muito felizes em cuidar de você. Em caso de dúvidas, estamos à disposição. ✨`);
          await WhatsappSession.clear(remoteJid);
        } else if (textMessage === '2') {
          state.stage = 'EXISTING_SCHEDULE';
          await WhatsappSession.save(remoteJid, state);
          await WhatsappSender.sendMessage(instanceId, remoteJid, `Entendido. Vamos buscar uma nova data para você. Um de nossos atendentes especializados entrará em contato em instantes para verificar a melhor disponibilidade. 👩‍💻`);
        } else if (textMessage === '3') {
          if (state.appointmentId) {
            await prisma.appointment.update({
              where: { id: state.appointmentId },
              data: { status: 'CANCELLED' }
            });
          } else if (state.postOpId) {
             // Nota: PostOp não tem status CANCELLED no enum original, 
             // mas podemos manter como SCHEDULED ou adicionar se necessário.
             // Para o MVP de PostOp, apenas notificamos a recepção via inatividade se não confirmar.
          }
          await WhatsappSender.sendMessage(instanceId, remoteJid, `Compreendemos. Sua solicitação foi registrada em nosso sistema. Caso mude de ideia, sinta-se à vontade para nos procurar novamente. O Hospital São Rafael agradece.`);
          await WhatsappSession.clear(remoteJid);
        } else {
          await WhatsappSender.sendMessage(instanceId, remoteJid, `⚠️ Desculpe, não entendi. Por favor, digite *1* para confirmar, *2* para reagendar ou *3* para falar com um atendente.`);
        }
        break;

      case 'VERIFY_DOB_ENRICH':
      case 'VERIFY_DOB_CHALLENGE': {
        const isEnrichment = state.stage === 'VERIFY_DOB_ENRICH';
        const result = await IdentityService.validateDOB(remoteJid, textMessage);

        if (result.isValid || (isEnrichment && result.error === 'MISMATCH')) {
          // No enriquecimento, MISMATCH é esperado (já que não há data no banco), 
          // mas o formato deve ser válido.
          if (isEnrichment) {
            // Parsing robusto para salvar
            const cleanInput = textMessage.trim().replace(/\s/g, '');
            const formats = ['dd/MM/yyyy', 'dd-MM-yyyy', 'ddMMyyyy'];
            let dateObj: Date | null = null;
            
            const { parse, isValid, startOfDay } = await import('date-fns');
            for (const f of formats) {
              const d = parse(cleanInput, f, new Date());
              if (isValid(d)) {
                dateObj = startOfDay(d);
                break;
              }
            }

            if (dateObj) {
              const phoneStr = remoteJid.split('@')[0].replace(/[^0-9]/g, '');
              const lead = await prisma.lead.findFirst({ where: { phone: { contains: phoneStr.substring(phoneStr.length - 8) } } });
              if (lead) {
                await prisma.patient.update({
                  where: { leadId: lead.id },
                  data: { dateOfBirth: dateObj }
                });
                logger.success('WhatsApp:Chatbot', `Perfil enriquecido com DOB: ${dateObj.toISOString()} para ${remoteJid}`);
              }
            }
          }
          state.lastVerificationAt = Date.now();
          await this.listAppointmentsFlow(instanceId, remoteJid, state);
        } else {
          const errorMsg = result.error === 'INVALID_FORMAT'
            ? `⚠️ O formato da data parece estar incorreto. Por favor, use o padrão *DD/MM/AAAA* (Ex: 15/05/1990):`
            : `⚠️ A data informada não confere com nossos registros. Por favor, verifique e tente novamente:`;
          await WhatsappSender.sendMessage(instanceId, remoteJid, errorMsg);
        }
        break;
      }

      case 'APPOINTMENT_LIST': {
        const appts = await AppointmentService.listPatientAppointments(remoteJid);
        const index = parseInt(textMessage) - 1;
        if (isNaN(index) || index < 0 || index >= appts.length) {
          if (textMessage === '0') {
            state.stage = 'EXISTING_MENU';
            await WhatsappSession.save(remoteJid, state);
            await this.sendExistingMenuOptions(instanceId, remoteJid, state.leadId);
          } else {
            await WhatsappSender.sendMessage(instanceId, remoteJid, `⚠️ Opção inválida. Digite o número da consulta ou 0 para voltar.`);
          }
          return;
        }

        const selected = appts[index];
        state.appointmentId = selected.id;
        state.selectedApptIndex = index;
        state.stage = 'APPOINTMENT_CANCEL_CONFIRM';
        await WhatsappSession.save(remoteJid, state);

        const dateStr = selected.scheduledAt.toLocaleDateString('pt-BR');
        const hourStr = selected.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        await WhatsappSender.sendFormattedButtons(
          instanceId,
          remoteJid,
          `Gerenciar Agendamento`,
          `O que deseja fazer com sua consulta de ${selected.procedure} em ${dateStr} às ${hourStr}?`,
          [
            { id: 'appt_confirm', title: 'Confirmar Presença' },
            { id: 'appt_reschedule', title: 'Reagendar' },
            { id: 'appt_cancel', title: 'Cancelar Consulta' }
          ]
        );
        break;
      }

      case 'APPOINTMENT_CANCEL_CONFIRM':
        if (textMessage === '1' || textMessage.toLowerCase().includes('confirmar')) {
          await prisma.appointment.update({
            where: { id: state.appointmentId },
            data: { status: 'CONFIRMED' }
          });
          await WhatsappSender.sendMessage(instanceId, remoteJid, `✅ *Confirmado!* Sua presença para o dia ${new Date().toLocaleDateString('pt-BR')} foi registrada com sucesso. Estamos te aguardando! ✨`);
          await WhatsappSession.clear(remoteJid);
        } else if (textMessage === '2' || textMessage.toLowerCase().includes('reagendar')) {
          state.stage = 'EXISTING_SCHEDULE';
          await WhatsappSession.save(remoteJid, state);
          await WhatsappSender.sendMessage(instanceId, remoteJid, `🔄 *Solicitação de Reagendamento*\n\nEntendido. Um de nossos atendentes entrará em contato em instantes para buscar uma nova data que seja ideal para você.`);
        } else if (textMessage === '3' || textMessage.toLowerCase().includes('cancelar')) {
           await AppointmentService.cancelAppointment(state.appointmentId!);
          await WhatsappSender.sendMessage(instanceId, remoteJid, `A sua consulta foi cancelada conforme solicitado. Caso precise agendar novamente no futuro, estaremos à disposição. 🏥`);
          await WhatsappSession.clear(remoteJid);
        } else {
          state.stage = 'APPOINTMENT_LIST';
          await this.listAppointmentsFlow(instanceId, remoteJid, state);
        }
        break;

      case 'NEW_ASK_NAME':
        state.userName = textMessage;
        state.stage = 'NEW_CONFIRM_NAME';
        await WhatsappSession.save(remoteJid, state);
        
        await WhatsappSender.sendFormattedButtons(
          instanceId,
          remoteJid,
          `Confirmação de Nome`,
          `Entendido! Devo te chamar de ${state.userName}?`,
          [
            { id: 'confirm_name_yes', title: 'Sim, está correto' },
            { id: 'confirm_name_no', title: 'Não, quero alterar' },
            { id: 'confirm_name_exit', title: 'Encerrar' }
          ]
        );
        break;

      case 'NEW_CONFIRM_NAME':
        if (textMessage === '0' || textMessage === '3' || textMessage.toLowerCase().includes('encerrar') || textMessage.toLowerCase().includes('sair')) {
          await WhatsappSession.clear(remoteJid);
          await WhatsappSender.sendMessage(instanceId, remoteJid, `Atendimento encerrado. O Hospital São Rafael agradece o seu contato. Desejamos um excelente dia e permanecemos à disposição.`);
          return;
        }

        if (textMessage === '2' || textMessage.toLowerCase().includes('não') || textMessage.toLowerCase().includes('alterar')) {
          state.stage = 'NEW_ASK_NAME';
          await WhatsappSession.save(remoteJid, state);
          await WhatsappSender.sendMessage(instanceId, remoteJid, `Perfeito. Por favor, digite novamente como gostaria de ser chamado(a):`);
          return;
        }

        if (textMessage === '1' || textMessage.toLowerCase().includes('sim') || textMessage.toLowerCase().includes('confirmar')) {
          state.stage = 'NEW_ASK_EMAIL';
          await WhatsappSession.save(remoteJid, state);
          
          const text1 = `Obrigado, ${state.userName}.\n\nPara garantir a segurança dos seus dados e facilitar o envio de futuros exames e confirmações de agendamentos, qual é o seu melhor e-mail?\n\n_(Este passo é opcional. Caso prefira não informar agora, basta digitar *Pular*.)_`;
          await WhatsappSender.sendMessage(instanceId, remoteJid, text1);
        } else {
           await WhatsappSender.sendMessage(instanceId, remoteJid, `⚠️ Desculpe, não entendi a resposta. Por favor, digite *1* para confirmar ou *2* para alterar o nome.`);
        }
        break;

      case 'NEW_ASK_EMAIL': {
        const isSkip = textMessage.toLowerCase().includes('pular');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!isSkip && !emailRegex.test(textMessage)) {
           await WhatsappSender.sendMessage(instanceId, remoteJid, `⚠️ Formato de e-mail inválido. Por favor, informe um endereço válido (ex: nome@email.com) ou digite *Pular* para continuar.`);
           return;
        }

        if (!isSkip) {
          state.email = textMessage.trim();
        } else {
          state.email = undefined;
        }

        state.stage = 'NEW_ASK_INTEREST';
        await WhatsappSession.save(remoteJid, state);
        
        await WhatsappSender.sendFormattedList(
          instanceId,
          remoteJid,
          `Triagem Inicial`,
          `Agradecemos por compartilhar. Como podemos ajudar você hoje? Selecione a área do seu interesse para direcionarmos o seu atendimento:`,
          `Áreas de Interesse`,
          [
            {
              title: 'Opções de Atendimento',
              rows: [
                { id: 'int_estetica', title: 'Procedimentos Estéticos', description: 'Tratamentos faciais e corporais' },
                { id: 'int_plastica', title: 'Cirurgias Plásticas', description: 'Fins estéticos' },
                { id: 'int_reparadora', title: 'Cirurgias Reparadoras', description: 'Procedimentos reparadores' },
                { id: 'int_eletiva', title: 'Cirurgias Eletivas Gerais', description: 'Outras cirurgias programadas' },
                { id: 'int_outros', title: 'Outros Assuntos', description: 'Dúvidas e informações gerais' },
                { id: 'int_nenhum', title: 'Encerrar', description: 'Finalizar agora' }
              ]
            }
          ]
        );
        break;
      }

      case 'NEW_ASK_INTEREST': {
        let selectedInterest = '';
        switch (textMessage) {
          case '1': selectedInterest = 'Procedimentos Estéticos'; break;
          case '2': selectedInterest = 'Cirurgias Plásticas'; break;
          case '3': selectedInterest = 'Cirurgias Reparadoras'; break;
          case '4': selectedInterest = 'Cirurgias Eletivas Gerais'; break;
          case '5': selectedInterest = 'Outros Assuntos'; break;
          case '0':
          case '6':
            await WhatsappSender.sendMessage(instanceId, remoteJid, `Compreendo. O Hospital São Rafael agradece o seu contato. Desejamos um excelente dia e permanecemos à disposição.`);
            await WhatsappSession.clear(remoteJid);
            return;
          default:
            await WhatsappSender.sendMessage(instanceId, remoteJid, `⚠️ Desculpe, não entendi a opção. Por favor, digite o *número* correspondente (1 a 6).`);
            return;
        }

        state.interest = selectedInterest;
        const newLeadId = await this.createLead(state.userName!, phone, state.interest, state.email);
        state.leadId = newLeadId;
        
        const msg1 = `Agradecemos o seu interesse, ${state.userName}. Registramos a sua solicitação para a área de *${state.interest}*.`;
        const msg2 = `Um de nossos especialistas da equipe de acolhimento entrará em contato em breve para seguir com o seu atendimento de forma personalizada.\n\n*Enquanto aguarda nosso especialista, deseja adiantar algum outro assunto no menu abaixo? Caso contrário, basta aguardar.*`;
        await WhatsappSender.sendMessage(instanceId, remoteJid, msg1, state.leadId);
        await WhatsappSender.sendMessage(instanceId, remoteJid, msg2, state.leadId);

        state.stage = 'EXISTING_MENU';
        await WhatsappSession.save(remoteJid, state);
        await this.sendExistingMenuOptions(instanceId, remoteJid, state.leadId);
        break;
      }

      case 'EXISTING_MENU':
        await this.handleExistingMenu(instanceId, remoteJid, state, textMessage);
        break;

      case 'EXISTING_FAQ':
      case 'EXISTING_PROCEDURE':
      case 'EXISTING_SCHEDULE':
        if (textMessage === '0') {
          state.stage = 'EXISTING_MENU';
          await WhatsappSession.save(remoteJid, state);
          await this.sendExistingMenuOptions(instanceId, remoteJid, state.leadId);
        } else {
          await WhatsappSender.sendMessage(instanceId, remoteJid, `Por favor, digite *0* para voltar ao menu principal.`, state.leadId);
        }
        break;

      default:
        await WhatsappSession.clear(remoteJid);
        await WhatsappSender.sendMessage(instanceId, remoteJid, `Desculpe, não entendi. Vamos recomeçar o atendimento.`);
        break;
    }
  }

  private static async createLead(name: string, phone: string, procedureInterest: string, email?: string): Promise<string | undefined> {
    try {
      const uniqueId = `WPP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      
      const leadEmail = email || `wpp.${uniqueId}@local.lead`;

      await checkUniqueness({ 
        cpf: `WPP.${uniqueId}`, 
        email: leadEmail, 
        phone 
      });
      
      const lead = await prisma.lead.create({
        data: {
          name,
          phone,
          cpf: `WPP.${uniqueId}`,
          email: leadEmail,
          source: 'WHATSAPP',
          origin: 'Whatsapp',
          procedure: procedureInterest,
          whatsappActive: true,
          notes: 'Lead criado pelo atendimento automatizado do WhatsApp.'
        }
      });
      return lead.id;
    } catch (e: unknown) {
      logger.error('WhatsApp:Chatbot', 'Erro ao criar lead no fluxo NEW', e);
      const existing = await prisma.lead.findFirst({ where: { phone } });
      return existing?.id;
    }
  }

  private static async sendExistingMenuOptions(instanceId: string, remoteJid: string, leadId?: string) {
    await WhatsappSender.sendFormattedList(
      instanceId,
      remoteJid,
      `Menu Principal`,
      `Como podemos ajudar você hoje? Selecione uma das opções abaixo:`,
      `Opções de Atendimento`,
      [
        {
          title: 'Serviços',
          rows: [
            { id: 'menu_schedule', title: 'Agendamentos', description: 'Consultas e procedimentos' },
            { id: 'menu_reschedule', title: 'Reagendamento', description: 'Alteração de datas' },
            { id: 'menu_procedure', title: 'Procedimentos e Cirurgias', description: 'Informações detalhadas' }
          ]
        },
        {
          title: 'Ajuda e Suporte',
          rows: [
            { id: 'menu_faq', title: 'Dúvidas Frequentes (FAQ)', description: 'Convênios e visitas' },
            { id: 'menu_agent', title: 'Falar com um Atendente', description: 'Suporte humanizado' },
            { id: 'menu_exit', title: 'Encerrar', description: 'Finalizar atendimento' }
          ]
        }
      ],
      leadId
    );
  }

  private static async handleExistingMenu(instanceId: string, remoteJid: string, state: ChatState, choice: string) {
    const leadId = state.leadId;

    switch (choice) {
      case '1': {
        // Fluxo de Identidade LGPD
        const { verified, nextStage } = await IdentityService.checkIdentity(remoteJid);
        if (!verified) {
          state.stage = nextStage as any;
          await WhatsappSession.save(remoteJid, state);
          if (nextStage === 'VERIFY_DOB_ENRICH') {
            await WhatsappSender.sendMessage(instanceId, remoteJid, `Entendido! Para que você possa acessar seus agendamentos com total segurança, precisamos concluir seu cadastro.\n\nPor favor, informe sua *data de nascimento* (Ex: DD/MM/AAAA):`);
          } else {
            await WhatsappSender.sendMessage(instanceId, remoteJid, `Certo, ${state.userName}. Por segurança e para protegermos seus dados médicos conforme a LGPD, preciso confirmar sua identidade.\n\nPor favor, informe sua *Data de Nascimento* (Ex: 15/05/1985):`);
          }
          return;
        }
        
        await this.listAppointmentsFlow(instanceId, remoteJid, state);
        break;
      }
      case '2': {
        // Reagendamento também exige validação se for paciente
        const { verified: v2, nextStage: ns2 } = await IdentityService.checkIdentity(remoteJid);
        if (!v2) {
            state.stage = ns2 as any;
            await WhatsappSession.save(remoteJid, state);
            await WhatsappSender.sendMessage(instanceId, remoteJid, `Para prosseguir com o reagendamento seguro, informe sua *Data de Nascimento*:`);
            return;
        }
        state.stage = 'EXISTING_SCHEDULE';
        await WhatsappSession.save(remoteJid, state);
        await WhatsappSender.sendMessage(instanceId, remoteJid, `🔄 *Reagendamento*\n\nEntendemos que imprevistos acontecem! Nosso time vai buscar a melhor nova data para você. 🤝\n\nUm de nossos atendentes continuará este atendimento em instantes. 👩‍💻`, leadId);
        break;
      }
      case '3':
        state.stage = 'EXISTING_PROCEDURE';
        await WhatsappSession.save(remoteJid, state);
        await WhatsappSender.sendMessage(instanceId, remoteJid, `🏥 *Procedimentos e Cirurgias*\n\nO Hospital São Rafael foca exclusivamente em cirurgias eletivas, plásticas e estéticas, com internações de curta permanência. ✨ Informamos que não possuímos Pronto-Atendimento (Emergência). ⚠️\n\nNossa infraestrutura conta com 46 leitos, UTI própria e centro de diagnósticos (Raio-x e ultrassom) para o seu conforto. 🛏️🔬\n\nPara orçamento e detalhes de procedimentos específicos, nosso setor Financeiro/Comercial assumirá este atendimento em instantes. 💼\n\n_(Digite 0 para voltar ao menu)_`, leadId);
        break;
      case '4':
        state.stage = 'EXISTING_FAQ';
        await WhatsappSession.save(remoteJid, state);
        await WhatsappSender.sendMessage(instanceId, remoteJid, `❓ *Dúvidas Frequentes (FAQ)*\n\nAqui estão as principais informações sobre o nosso processo:\n\n1️⃣ *Acompanhantes e Visitas*\nA presença de 1 acompanhante é obrigatória para menores de 18 ou maiores de 60 anos, e permitida apenas nos quartos do tipo Apartamento. É permitida 1 troca de turno por dia, até as 21h. 👥\n\n2️⃣ *Obras de Melhoria*\nEstamos reformando nossas dependências para garantir mais conforto aos pacientes e acompanhantes. Pedimos desculpas por eventuais ruídos diurnos dessas modernizações. 🚧🛠️\n\n3️⃣ *Altas Médicas*\nApós receber a alta médica oficial, o quarto deve ser desocupado em até 1 hora, para evitar a cobrança extra de nova diária. ⏱️\n\n4️⃣ *Convênios Aceitos*\nAceitamos Amil, Bradesco Saúde, Allianz, Care Plus, NotreDame, Porto Seguro, Sompo Seguros, Unimed Nacional, entre outros. 🏥🤝\n\n_(Digite 0 para voltar ao menu principal)_`, leadId);
        break;
      case '5':
        await WhatsappSession.clear(remoteJid);
        await WhatsappSender.sendMessage(instanceId, remoteJid, `👤 *Falar com um Atendente*\n\nCompreendido, ${state.userName}! 👍\n\nVocê também pode nos contatar pelo email sac@hsaorafael.com.br ou comercial@hsaorafael.com.br. 📧\n\nEstou transferindo seu atendimento para nossa equipe humana neste exato momento. Por favor, aguarde um instante. 👩‍💻⏳\n\n(O atendimento automático foi encerrado)`, leadId);
        break;
      case '0':
        await WhatsappSession.clear(remoteJid);
        await WhatsappSender.sendMessage(instanceId, remoteJid, `Atendimento encerrado. O Hospital São Rafael agradece o seu contato. Desejamos um excelente dia e permanecemos à disposição para cuidar de você e da sua saúde.`, leadId);
        break;
      default:
        await WhatsappSender.sendMessage(instanceId, remoteJid, `⚠️ Desculpe, não entendi a opção "${choice}".\n\nPor favor, digite o *número* correspondente à opção desejada.\n\n_(Exemplo: digite 1 para Agendamentos)_`, leadId);
        break;
    }
  }

  private static async listAppointmentsFlow(instanceId: string, remoteJid: string, state: ChatState) {
    const appts = await AppointmentService.listPatientAppointments(remoteJid);
    
    if (appts.length === 0) {
      await WhatsappSender.sendMessage(instanceId, remoteJid, `Não localizei agendamentos futuros em seu CPF. Deseja realizar um novo agendamento?\n\n1️⃣ Sim, por favor\n0️⃣ Voltar ao menu`);
      return;
    }

    let text = `Localizei *${appts.length}* procedimento(s) em sua agenda:\n\n`;
    appts.forEach((appt, i) => {
      const dateStr = appt.scheduledAt.toLocaleDateString('pt-BR');
      const hourStr = appt.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      text += `*${i + 1}. ${appt.procedure}*\n👨‍⚕️ Dr. ${appt.surgeon.name}\n📅 ${dateStr} às ${hourStr}\n\n`;
    });

    text += `Para gerenciar um agendamento, digite o *número* correspondente.`;
    state.stage = 'APPOINTMENT_LIST';
    await WhatsappSession.save(remoteJid, state);
    await WhatsappSender.sendMessage(instanceId, remoteJid, text);
  }
}
