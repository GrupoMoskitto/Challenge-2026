import { redisConnection } from '../config/redis';
import { prisma, checkUniqueness } from '@crmed/database';
import { WhatsAppService } from './whatsapp.service';
import { logger } from '../config/logger';

const STATE_PREFIX = 'whatsapp_state:';
const STATE_TTL = 3600; // 1 hour

export interface ChatState {
    stage: string;
    userName?: string;
    interest?: string;
}

export const ChatbotService = {
    async handleMessage(instanceName: string, remoteJid: string, pushName: string, textMessage: string) {
        const stateKey = `${STATE_PREFIX}${remoteJid}`;
        const stateJSON = await redisConnection.get(stateKey);

        let state: ChatState = { stage: 'START' };
        if (stateJSON) {
            state = JSON.parse(stateJSON);
        }

        const phone = remoteJid.split('@')[0];

        try {
            // Check DB on first interaction
            if (state.stage === 'START') {
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                const lead = await prisma.lead.findFirst({
                    where: {
                        phone: {
                            contains: cleanPhone.substring(cleanPhone.length - 8)
                        }
                    }
                });

                if (lead) {
                    // EXISTING CLIENT
                    state.stage = 'EXISTING_MENU';
                    state.userName = lead.name;
                    await this.saveState(stateKey, state);
                    await this.sendExistingMenu(instanceName, remoteJid, lead.name);
                    return;
                } else {
                    // NEW CLIENT
                    state.stage = 'NEW_ASK_NAME';
                    await this.saveState(stateKey, state);
                    await this.sendGreetingAndAskName(instanceName, remoteJid, pushName);
                    return;
                }
            }

            // Message Handling based on State
            switch (state.stage) {
                // --- NEW CLIENT FLOW ---
                case 'NEW_ASK_NAME':
                    state.userName = textMessage.trim();
                    state.stage = 'NEW_ASK_INTEREST';
                    await this.saveState(stateKey, state);
                    await this.sendAskInterest(instanceName, remoteJid, state.userName);
                    break;

                case 'NEW_ASK_INTEREST': {
                    const choice = textMessage.trim();
                    let selectedInterest = '';

                    switch (choice) {
                        case '1': selectedInterest = 'Procedimentos Estéticos'; break;
                        case '2': selectedInterest = 'Cirurgias Plásticas'; break;
                        case '3': selectedInterest = 'Cirurgias Reparadoras'; break;
                        case '4': selectedInterest = 'Cirurgias Eletivas Gerais'; break;
                        case '5': selectedInterest = 'Outros'; break;
                        case '0':
                            await WhatsAppService.sendMessage(instanceName, remoteJid, `Compreendo, ${state.userName}. \n\nAgradeço muito pelo seu contato! Estaremos sempre de portas abertas caso precise de algo no futuro. Tenha um ótimo dia! 🏥💙`);
                            await redisConnection.del(stateKey);
                            return;
                        default:
                            await WhatsAppService.sendMessage(instanceName, remoteJid, `⚠️ Desculpe, não entendi a opção "${choice}".\n\nPor favor, digite apenas o número correspondente ao seu interesse (1 a 5, ou 0 para cancelar).`);
                            return; // Do not delete state, let them try again
                    }

                    state.interest = selectedInterest;
                    await this.createLead(state.userName!, phone, state.interest);
                    
                    const msg1 = `Que excelente, ${state.userName}! ✨\n\nRegistrei seu interesse em *${state.interest}*. Em breve, um de nossos especialistas da nossa equipe de acolhimento entrará em contato para tirar todas as suas dúvidas com muito carinho e empatia.`;
                    const msg2 = `Agradecemos o contato com o Hospital São Rafael! 💙`;
                    await WhatsAppService.sendMessage(instanceName, remoteJid, msg1);
                    await WhatsAppService.sendMessage(instanceName, remoteJid, msg2);

                    state.stage = 'EXISTING_MENU';
                    await this.saveState(stateKey, state);
                    await this.sendExistingMenuOptions(instanceName, remoteJid);
                    break;
                }

                // --- EXISTING CLIENT FLOW ---
                case 'EXISTING_MENU':
                    await this.handleExistingMenu(instanceName, remoteJid, stateKey, state, textMessage.trim());
                    break;

                case 'EXISTING_FAQ':
                case 'EXISTING_PROCEDURE':
                case 'EXISTING_SCHEDULE':
                    if (textMessage.trim() === '0') {
                        state.stage = 'EXISTING_MENU';
                        await this.saveState(stateKey, state);
                        await this.sendExistingMenu(instanceName, remoteJid, state.userName!);
                    } else {
                        await WhatsAppService.sendMessage(instanceName, remoteJid, `Por favor, digite *0* para voltar ao menu principal.`);
                    }
                    break;

                default:
                    await redisConnection.del(stateKey);
                    await WhatsAppService.sendMessage(instanceName, remoteJid, `Desculpe, não entendi. Vamos recomeçar o atendimento.`);
                    break;
            }

        } catch (error: any) {
            const status = error?.response?.status;
            const isAuthError = status === 401 || status === 403;
            
            if (!isAuthError) {
                logger.error('Chatbot', `Erro processando mensagem de ${pushName}`, error);
                try {
                    await WhatsAppService.sendMessage(instanceName, remoteJid, `Ocorreu um erro interno. Por favor, tente novamente mais tarde.`);
                } catch {
                    // Silently fail if can't send error message
                }
            }
        }
    },

    async saveState(key: string, state: ChatState) {
        await redisConnection.set(key, JSON.stringify(state), 'EX', STATE_TTL);
    },

    async sendGreetingAndAskName(instanceName: string, remoteJid: string, pushName: string) {
        const text = `Olá, ${pushName}! 👋 Seja muito bem-vindo(a) ao atendimento do *Hospital São Rafael*. 💙🏥\n\nNotei que ainda não temos o seu cadastro. Para iniciarmos um atendimento mais humanizado e com o respeito que você merece, *como gostaria de ser chamado(a)?* ✨`;
        await WhatsAppService.sendMessage(instanceName, remoteJid, text);
    },

    async sendAskInterest(instanceName: string, remoteJid: string, name: string) {
        const text1 = `É um prazer te conhecer, ${name}! 😊\n\nAqui no Hospital São Rafael, nossa prioridade é o seu bem-estar e o cuidado transparente em cada etapa. 🏥💙`;
        const text2 = `Você tem interesse em saber mais sobre qual de nossas áreas?\n\nDigite o número da opção desejada:\n\n1️⃣ - Procedimentos Estéticos\n2️⃣ - Cirurgias Plásticas\n3️⃣ - Cirurgias Reparadoras\n4️⃣ - Cirurgias Eletivas Gerais\n5️⃣ - Outros\n\n0️⃣ - Não tenho interesse no momento`;
        await WhatsAppService.sendMessage(instanceName, remoteJid, text1);
        await WhatsAppService.sendMessage(instanceName, remoteJid, text2);
    },

    async createLead(name: string, phone: string, procedureInterest: string) {
        try {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const uniqueId = `WPP_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            
            await checkUniqueness({ 
                cpf: `WPP.${uniqueId}`, 
                email: `wpp.${uniqueId}@local.lead`, 
                phone: cleanPhone 
            });
            
            await prisma.lead.create({
                data: {
                    name: name,
                    phone: cleanPhone,
                    cpf: `WPP.${uniqueId}`,
                    email: `wpp.${uniqueId}@local.lead`,
                    source: 'WHATSAPP',
                    origin: 'Whatsapp',
                    procedure: procedureInterest,
                    whatsappActive: true,
                    notes: 'Lead criado pelo atendimento automatizado do WhatsApp. Não foi informado o e-mail e CPF.'
                }
            });
        } catch (e: any) {
            if (e.code === 'P2002' || e.message?.includes('RN01_VIOLATION')) {
                logger.warn('Chatbot', 'Lead já existe para este telefone, ignorando criação');
            } else {
                logger.error('Chatbot', 'Erro ao criar lead', e);
            }
        }
    },

    async sendExistingMenu(instanceName: string, remoteJid: string, name: string) {
        const greetingMsg = `Olá ${name}! 👋 Seja bem-vindo(a) de volta ao canal de atendimento do Hospital São Rafael via WhatsApp. 🏥💙`;
        await WhatsAppService.sendMessage(instanceName, remoteJid, greetingMsg);
        await this.sendExistingMenuOptions(instanceName, remoteJid);
    },

    async sendExistingMenuOptions(instanceName: string, remoteJid: string) {
        const menuMsg = `Como podemos ajudar hoje?\n\nDigite uma das opções abaixo para continuar:\n\n1️⃣ - Agendamentos\n2️⃣ - Reagendamento\n3️⃣ - Procedimentos e Cirurgias\n4️⃣ - Dúvidas Frequentes (FAQ)\n5️⃣ - Falar com um Atendente\n\n0️⃣ - Encerrar atendimento`;
        await WhatsAppService.sendMessage(instanceName, remoteJid, menuMsg);
    },

    async handleExistingMenu(instanceName: string, remoteJid: string, stateKey: string, state: ChatState, choice: string) {
        switch (choice) {
            case '1':
                state.stage = 'EXISTING_SCHEDULE';
                await this.saveState(stateKey, state);
                await WhatsAppService.sendMessage(instanceName, remoteJid, `📅 *Agendamentos*\n\nNossa equipe de recepção precisa acessar nossos calendários atualizados para agendar consultas ou procedimentos. 🗓️\n\nPara o dia do seu agendamento presencial, lembre-se que é necessário chegar com 1 hora de antecedência portando seu RG, carteirinha do convênio e guia médica aprovada. ⏱️📄\n\nPor favor, aguarde um momento que um de nossos recepcionistas irá te auxiliar em breve pelo chat. 👩‍💼💬\n\n_(Digite 0 a qualquer momento para voltar ao menu principal)_`);
                break;
            case '2':
                state.stage = 'EXISTING_SCHEDULE';
                await this.saveState(stateKey, state);
                await WhatsAppService.sendMessage(instanceName, remoteJid, `🔄 *Reagendamento*\n\nEntendemos que imprevistos acontecem! Nosso time vai buscar a melhor nova data para você. 🤝\n\nLembre-se: em caso de cancelamento e solicitação de reembolso, nossa equipe financeira irá conduzir o processo no prazo acordado de até 30 dias com total transparência. 💳\n\nUm de nossos atendentes continuará este atendimento em instantes. 👩‍💻\n\n_(Digite 0 a qualquer momento para voltar ao menu principal)_`);
                break;
            case '3':
                state.stage = 'EXISTING_PROCEDURE';
                await this.saveState(stateKey, state);
                await WhatsAppService.sendMessage(instanceName, remoteJid, `🏥 *Procedimentos e Cirurgias*\n\nO Hospital São Rafael foca exclusivamente em cirurgias eletivas, plásticas e estéticas, com internações de curta permanência. ✨ Informamos que não possuímos Pronto-Atendimento (Emergência). ⚠️\n\nNossa infraestrutura conta com 46 leitos, UTI própria e centro de diagnósticos (Raio-x e ultrassom) para o seu conforto. 🛏️🔬\n\nPara orçamento e detalhes de procedimentos específicos, nosso setor Financeiro/Comercial assumirá este atendimento em instantes. 💼\n\n_(Digite 0 para voltar ao menu)_`);
                break;
            case '4':
                state.stage = 'EXISTING_FAQ';
                await this.saveState(stateKey, state);
                await WhatsAppService.sendMessage(instanceName, remoteJid, `❓ *Dúvidas Frequentes (FAQ)*\n\nAqui estão as principais informações sobre o nosso processo:\n\n1️⃣ *Acompanhantes e Visitas*\nA presença de 1 acompanhante é obrigatória para menores de 18 ou maiores de 60 anos, e permitida apenas nos quartos do tipo Apartamento. É permitida 1 troca de turno por dia, até as 21h. 👥\n\n2️⃣ *Obras de Melhoria*\nEstamos reformando nossas dependências para garantir mais conforto aos pacientes e acompanhantes. Pedimos desculpas por eventuais ruídos diurnos dessas modernizações. 🚧🛠️\n\n3️⃣ *Altas Médicas*\nApós receber a alta médica oficial, o quarto deve ser desocupado em até 1 hora, para evitar a cobrança extra de nova diária. ⏱️\n\n4️⃣ *Convênios Aceitos*\nAceitamos Amil, Bradesco Saúde, Allianz, Care Plus, NotreDame, Porto Seguro, Sompo Seguros, Unimed Nacional, entre outros. 🏥🤝\n\n_(Digite 0 para voltar ao menu principal)_`);
                break;
            case '5':
                await redisConnection.del(stateKey);
                await WhatsAppService.sendMessage(instanceName, remoteJid, `👤 *Falar com um Atendente*\n\nCompreendido, ${state.userName}! 👍\n\nVocê também pode nos contatar pelo email sac@hsaorafael.com.br ou comercial@hsaorafael.com.br. 📧\n\nEstou transferindo seu atendimento para nossa equipe humana neste exato momento. Por favor, aguarde um instante. 👩‍💻⏳\n\n(O atendimento automático foi encerrado)`);
                break;
            case '0':
                await redisConnection.del(stateKey);
                await WhatsAppService.sendMessage(instanceName, remoteJid, `Tudo bem, ${state.userName}. O atendimento automático foi encerrado. ✅\n\nO Hospital São Rafael agradece o seu contato! Se precisar, basta nos enviar uma nova mensagem. Tenha um excelente dia! 💙👋`);
                break;
            default:
                await WhatsAppService.sendMessage(instanceName, remoteJid, `⚠️ Desculpe, não entendi a opção "${choice}".\n\nPor favor, digite apenas o número correspondente no menu (1, 2, 3, 4, 5 ou 0).\n\n_(Exemplo: digite 1 para Agendamentos)_`);
                break;
        }
    }
};
