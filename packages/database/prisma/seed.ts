import { PrismaClient, LeadStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays, addDays, setHours, setMinutes } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting MEGA-RICH seed process (30-day timeline)...');

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

  console.log('📈 Seeding 60 leads with historical data...');
  for (let i = 0; i < 60; i++) {
    const creationDate = subDays(new Date(), Math.floor(Math.random() * 30));
    const status = i < 10 ? LeadStatus.CONVERTED : 
                   i < 25 ? LeadStatus.QUALIFIED :
                   i < 45 ? LeadStatus.CONTACTED :
                   i < 55 ? LeadStatus.NEW : LeadStatus.LOST;
    
    const name = `Lead ${i + 1}`;
    const lead = await prisma.lead.create({
      data: {
        name,
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
                sex: Math.random() > 0.5 ? 'Feminino' : 'Masculino',
                height: 150 + Math.floor(Math.random() * 40),
                weight: 50 + Math.floor(Math.random() * 50),
                howMet: randomItem(origins),
                address: 'Rua Exemplo, 123',
                createdAt: lead.updatedAt
            }
        });

        let apptDate = addDays(patient.createdAt, 2 + Math.floor(Math.random() * 10));
        apptDate = setHours(setMinutes(apptDate, 0), 9 + Math.floor(Math.random() * 8)); // Entre 09:00 e 16:00

        await prisma.appointment.create({
            data: {
                patientId: patient.id,
                surgeonId: randomItem(surgeons).id,
                procedure: lead.procedure!,
                scheduledAt: apptDate,
                status: apptDate < new Date() ? 'COMPLETED' : 'SCHEDULED',
                createdAt: patient.createdAt
            }
        });

        await prisma.auditLog.create({
            data: {
                entityType: 'Lead',
                entityId: lead.id,
                action: 'STATUS_CHANGE',
                oldValue: 'QUALIFIED',
                newValue: 'CONVERTED',
                reason: 'Paciente aceitou o orçamento',
                userId: randomItem(users).id,
                createdAt: patient.createdAt
            }
        });
    }
  }

  console.log('🎯 Seeding special dashboard scenarios...');
  
  const patientVip = await prisma.patient.findFirst({ include: { lead: true } });
  if (patientVip) {
      await prisma.appointment.create({
          data: {
              patientId: patientVip.id,
              surgeonId: surgeons[0].id,
              procedure: 'Lipo HD Premium',
              scheduledAt: setHours(setMinutes(addDays(new Date(), 1), 0), 9),
              status: 'CONFIRMED'
          }
      });
  }

  const patients = await prisma.patient.findMany({ take: 3 });
  for (const p of patients) {
      await prisma.complaint.create({
          data: {
              patientId: p.id,
              area: 'Financeiro',
              description: 'Dúvida sobre parcelamento no boleto',
              status: 'OPEN'
          }
      });
  }

  console.log('📝 Seeding standard message templates...');
  await prisma.messageTemplate.createMany({
    data: [
      { 
        name: '30 Dias - Preparativos e Exames', 
        channel: 'WHATSAPP', 
        content: 'Olá, {{paciente}}! Tudo bem? ✨\n\nFaltam 30 dias para a sua cirurgia de *{{procedimento}}*. 🏥\n\nEste é o momento ideal para darmos início aos preparativos! Lembre-se de realizar todos os exames solicitados.\n\nComo podemos te ajudar hoje?\n1️⃣ Já realizei os exames\n2️⃣ Tenho dúvidas sobre o preparo\n3️⃣ Preciso reagendar', 
        triggerDays: 30 
      },
      { 
        name: '7 Dias - Orientações e Jejum', 
        channel: 'WHATSAPP', 
        content: 'Oi, {{paciente}}! Falta apenas uma semana para a sua transformação! ✨\n\nPara que tudo ocorra perfeitamente na sua {{procedimento}}, por favor, atente-se ao jejum e orientações.\n\nEstá tudo pronto?\n1️⃣ Sim, tudo certo!\n2️⃣ Preciso de orientações\n3️⃣ Preciso reagendar', 
        triggerDays: 7 
      },
      { 
        name: '48 Horas - Confirmação Crítica', 
        channel: 'WHATSAPP', 
        content: '🚨 *URGENTE: CONFIRMAÇÃO OBRIGATÓRIA* 🚨\n\nOlá, {{paciente}}. Sua cirurgia de {{procedimento}} com o Dr. {{medico}} é daqui a 48h!\n\nPrecisamos da sua confirmação imediata:\n1️⃣ *SIM, CONFIRMO MINHA PRESENÇA*\n2️⃣ *SOLICITAR REAGENDAMENTO*\n3️⃣ *CANCELAR CIRURGIA*', 
        triggerDays: 2 
      },
      { 
        name: 'Pós-Operatório - Acompanhamento', 
        channel: 'WHATSAPP', 
        content: 'Olá, {{paciente}}! Como está sua recuperação da {{procedimento}}? ✨\n\nLembrete da sua consulta de retorno:\n📅 Data: *{{data}}*\n\nPodemos confirmar?\n1️⃣ Sim, estarei lá!\n2️⃣ Preciso reagendar\n3️⃣ Falar com atendente', 
        triggerDays: -1 
      },
    ]
  });

  console.log('✅ MEGA-RICH dataset generated successfully.');
  console.log('🚀 Seed finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
