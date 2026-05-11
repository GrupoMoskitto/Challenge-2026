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
    prisma.surgeon.create({ data: { name: 'Dr. Sérgio Vasconcelos', specialty: 'Cirurgia Plástica', crm: '123456-SP', email: 'sergio.v@hsr.com.br', phone: '5511999991111' } }),
    prisma.surgeon.create({ data: { name: 'Dra. Helena Mendes', specialty: 'Dermatologia', crm: '654321-SP', email: 'helena.m@hsr.com.br', phone: '5511999992222' } }),
    prisma.surgeon.create({ data: { name: 'Dra. Beatriz Matos', specialty: 'Cirurgia Geral', crm: '112233-SP', email: 'beatriz.m@hsr.com.br', phone: '5511999993333' } }),
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
        phone: `55119${Math.floor(10000000+Math.random()*89999999)}`,
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
      { name: 'REMINDER_30D', channel: 'WHATSAPP', content: 'Olá {{paciente}}, passando para lembrar que sua cirurgia de {{procedimento}} está agendada para o dia {{data}}. Tem alguma dúvida?', triggerDays: 30 },
      { name: 'REMINDER_7D', channel: 'WHATSAPP', content: 'Oi {{paciente}}! ✨ Falta apenas uma semana para cuidarmos de você em sua {{procedimento}}. Já está com tudo pronto?', triggerDays: 7 },
      { name: 'CONFIRMATION_48H', channel: 'WHATSAPP', content: '🚨 {{paciente}}, precisamos da sua confirmação final para a {{procedimento}} com o Dr. {{medico}} em {{data}}.', triggerDays: 2 },
      { name: 'POST_OP_CONFIRMATION', channel: 'WHATSAPP', content: 'Olá {{paciente}}. Seu retorno pós-operatório de *{{procedimento}}* está agendada para o dia *{{data}}*. Sua presença é fundamental para garantirmos sua plena recuperação! ✨', triggerDays: 2 },
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
