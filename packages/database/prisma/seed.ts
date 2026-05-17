import { PrismaClient, LeadStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays, addDays, setHours, setMinutes } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting seed process...');

  await prisma.whatsappSession.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.budgetFollowUp.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.document.deleteMany();
  await prisma.postOp.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.scheduleBlock.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.extraAvailabilitySlot.deleteMany();
  await prisma.surgeon.deleteMany();
  await prisma.user.deleteMany();
  await prisma.messageTemplate.deleteMany();

  console.log('🧹 Database is clean.');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const users = await Promise.all([
    prisma.user.create({ data: { email: 'admin@hsr.com.br', name: 'Dr. Arthur (Diretor)', role: UserRole.ADMIN, password: hashedPassword } }),
    prisma.user.create({ data: { email: 'recepcao@hsr.com.br', name: 'Beatriz Maria (Recepção)', role: UserRole.RECEPTION, password: hashedPassword } }),
    prisma.user.create({ data: { email: 'vendas@hsr.com.br', name: 'Daniela Comercial', role: UserRole.SALES, password: hashedPassword } }),
  ]);

  const surgeons = await Promise.all([
    prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { email: 'sergio.v@hsr.com.br', name: 'Dr. Sérgio Vasconcelos', role: UserRole.SURGEON, password: hashedPassword } });
      return tx.surgeon.create({ data: { name: 'Dr. Sérgio Vasconcelos', specialty: 'Cirurgia Plástica', crm: '123456-SP', email: 'sergio.v@hsr.com.br', phone: '5511999991111', cpf: '111.111.111-11', rg: '11.111.111-1', address: 'Av. Paulista, 1000' } });
    }),
    prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { email: 'helena.m@hsr.com.br', name: 'Dra. Helena Mendes', role: UserRole.SURGEON, password: hashedPassword } });
      return tx.surgeon.create({ data: { name: 'Dra. Helena Mendes', specialty: 'Dermatologia', crm: '654321-SP', email: 'helena.m@hsr.com.br', phone: '5511999992222', cpf: '222.222.222-22', rg: '22.222.222-2', address: 'Av. Faria Lima, 2000' } });
    }),
    prisma.$transaction(async (tx) => {
      await tx.user.create({ data: { email: 'beatriz.m@hsr.com.br', name: 'Dra. Beatriz Matos', role: UserRole.SURGEON, password: hashedPassword } });
      return tx.surgeon.create({ data: { name: 'Dra. Beatriz Matos', specialty: 'Cirurgia Geral', crm: '112233-SP', email: 'beatriz.m@hsr.com.br', phone: '5511999993333', cpf: '333.333.333-33', rg: '33.333.333-3', address: 'Rua Augusta, 3000' } });
    }),
  ]);

  const origins = ['Instagram', 'TikTok', 'Google Ads', 'Indicação', 'Site', 'Facebook'];
  const procedures = ['Rinoplastia', 'Lipoaspiração', 'Mamoplastia', 'Abdominoplastia', 'Blefaroplastia', 'Otoplastia', 'Lipo HD'];
  const generateCpf = () => `${Math.floor(100+Math.random()*899)}.${Math.floor(100+Math.random()*899)}.${Math.floor(100+Math.random()*899)}-${Math.floor(10+Math.random()*89)}`;
  const randomItem = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

  console.log('📈 Seeding 60 leads...');
  for (let i = 0; i < 60; i++) {
    const creationDate = subDays(new Date(), Math.floor(Math.random() * 30));
    const status = i < 10 ? LeadStatus.CONVERTED : 
                   i < 25 ? LeadStatus.QUALIFIED :
                   i < 45 ? LeadStatus.CONTACTED :
                   i < 55 ? LeadStatus.NEW : LeadStatus.LOST;
    
    const lead = await prisma.lead.create({
      data: {
        name: `Lead ${i + 1}`,
        email: `lead${i + 1}@example.com`,
        phone: `55119${Math.floor(70000000 + Math.random() * 29999999)}`,
        cpf: generateCpf(),
        source: randomItem(origins),
        origin: randomItem(origins),
        status,
        procedure: randomItem(procedures),
        whatsappActive: Math.random() > 0.3,
        createdAt: creationDate,
        updatedAt: status === LeadStatus.CONVERTED ? addDays(creationDate, 5) : creationDate,
      }
    });

    if (status !== LeadStatus.NEW) {
        const contactDate = addDays(creationDate, Math.random() * 0.5);
        await prisma.contact.create({
            data: {
                leadId: lead.id,
                date: contactDate,
                type: 'WHATSAPP',
                direction: 'OUTBOUND',
                status: 'READ',
                message: 'Olá! Como posso ajudar?',
                createdAt: contactDate
            }
        });
    }

    if (status === LeadStatus.CONVERTED) {
        const patient = await prisma.patient.create({
            data: {
                leadId: lead.id,
                dateOfBirth: new Date(1980 + Math.floor(Math.random() * 25), Math.floor(Math.random() * 12), 1),
                medicalRecord: `HSR-26-${100 + i}`,
                createdAt: lead.updatedAt
            }
        });

        let apptDate = addDays(patient.createdAt, 2 + Math.floor(Math.random() * 10));
        apptDate = setHours(setMinutes(apptDate, 0), 9 + Math.floor(Math.random() * 8));

        // Simplified risk distribution for demo
        const apptStatus = i % 3 === 0 ? 'ATTENTION_REQUIRED' : (i % 2 === 0 ? 'CONFIRMED' : 'SCHEDULED');

        await prisma.appointment.create({
            data: {
                patientId: patient.id,
                surgeonId: randomItem(surgeons).id,
                procedure: lead.procedure!,
                scheduledAt: apptDate,
                status: apptStatus as any,
                riskScore: apptStatus === 'ATTENTION_REQUIRED' ? 40 : (apptStatus === 'CONFIRMED' ? 100 : 80),
                riskLevel: apptStatus === 'ATTENTION_REQUIRED' ? 'HIGH' : (apptStatus === 'CONFIRMED' ? 'LOW' : 'LOW'),
                createdAt: patient.createdAt
            }
        });
    }
  }

  console.log('🎯 Seeding special dashboard scenarios...');
  
  const patients = await prisma.patient.findMany({ take: 3 });
  for (const p of patients) {
      await prisma.complaint.create({
          data: {
              patientId: p.id,
              area: 'Financeiro',
              description: 'Dúvida sobre parcelamento',
              status: 'OPEN'
          }
      });
  }

  console.log('📝 Seeding message templates...');
  await prisma.messageTemplate.createMany({
    data: [
      {
        name: '30 Dias - Preparativos',
        channel: 'WHATSAPP',
        triggerDays: 30,
        content: `Olá, *{{paciente}}*! 👋

Estamos entrando em contato para lembrar que seu procedimento de *{{procedimento}}* com o *{{medico}}* está agendado para o dia *{{data}}* às *{{horario}}*.

Faltam *30 dias*! Seguem algumas orientações iniciais:

📋 *Preparativos gerais:*
• Agende seus exames pré-operatórios o quanto antes
• Informe-nos sobre qualquer medicação de uso contínuo
• Mantenha uma alimentação equilibrada

Em caso de dúvidas, estamos à disposição! 😊

_Hospital São Rafael — Cuidando de você._`
      },
      {
        name: '7 Dias - Orientações',
        channel: 'WHATSAPP',
        triggerDays: 7,
        content: `Oi, *{{paciente}}*! Falta apenas *1 semana* para o seu procedimento de *{{procedimento}}* com o *{{medico}}* no dia *{{data}}*. 🗓️

📋 *Checklist pré-operatório:*
• Confirme que todos os exames foram entregues à recepção
• Suspenda medicações conforme orientação médica
• Organize um acompanhante para o dia do procedimento
• Mantenha jejum de *8 horas* antes do horário agendado

⏰ Seu horário: *{{horario}}*
📍 Local: Hospital São Rafael — Recepção Cirúrgica

Precisa de algo? Responda esta mensagem! 💬

_Hospital São Rafael — Cuidando de você._`
      },
      {
        name: '48 Horas - Confirmação',
        channel: 'WHATSAPP',
        triggerDays: 2,
        content: `🚨 *CONFIRMAÇÃO OBRIGATÓRIA* 🚨

Olá, *{{paciente}}*!

Seu procedimento de *{{procedimento}}* com o *{{medico}}* está agendado para *{{data}}* às *{{horario}}*.

Por favor, confirme sua presença respondendo com uma das opções abaixo:

1️⃣ *Confirmo* minha presença
2️⃣ *Preciso remarcar* o procedimento
3️⃣ *Desejo cancelar*

⚠️ _Caso não responda em até 24 horas, nossa equipe entrará em contato por telefone._

_Hospital São Rafael — Cuidando de você._`
      },
      {
        name: 'Pós-Op - Acompanhamento',
        channel: 'WHATSAPP',
        triggerDays: -1,
        content: `Olá, *{{paciente}}*! 💚

Esperamos que sua recuperação após o procedimento de *{{procedimento}}* esteja indo bem!

Gostaríamos de saber como você está. Por favor, responda com uma das opções:

1️⃣ Estou *bem*, recuperação normal
2️⃣ Tenho *dúvidas* sobre a recuperação
3️⃣ Preciso de *ajuda urgente*

Lembre-se de seguir todas as orientações médicas e comparecer às consultas de retorno agendadas. 🩺

_Hospital São Rafael — Cuidando de você._`
      },
      {
        name: 'Boas-Vindas',
        channel: 'WHATSAPP',
        triggerDays: 0,
        content: `Olá, *{{paciente}}*! 👋\n\nBem-vindo(a) ao Hospital São Rafael. Recebemos o seu contato com sucesso!\n\nEm breve, um de nossos especialistas de atendimento falará com você por aqui para tirar todas as suas dúvidas e auxiliar no seu agendamento.\n\n_Hospital São Rafael — Cuidando de você._`
      },
    ]
  });

  console.log('✅ Seed finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
