import { PrismaClient, LeadStatus, AppointmentStatus, UserRole, ContactType, ContactDirection, ContactStatus, DocumentType, DocumentStatus, PostOpType, PostOpStatus, MessageChannel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateValidCPF(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += digits[i] * (10 - i);
  }
  const rem1 = sum1 % 11;
  const vd1 = rem1 < 2 ? 0 : 11 - rem1;
  digits.push(vd1);
  
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += digits[i] * (11 - i);
  }
  const rem2 = sum2 % 11;
  const vd2 = rem2 < 2 ? 0 : 11 - rem2;
  digits.push(vd2);
  
  return `${digits[0]}${digits[1]}${digits[2]}.${digits[3]}${digits[4]}${digits[5]}.${digits[6]}${digits[7]}${digits[8]}-${digits[9]}${digits[10]}`;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.postOp.deleteMany();
  await prisma.document.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.surgeon.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing data');

  const adminPassword = await bcrypt.hash('admin123', 10);

  // Create Users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@hsr.com.br',
        name: 'Administrador',
        role: UserRole.ADMIN,
        password: adminPassword,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'recepcao@hsr.com.br',
        name: 'Recepção (Teste)',
        role: UserRole.RECEPTION,
        password: adminPassword,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'callcenter@hsr.com.br',
        name: 'Call Center (Teste)',
        role: UserRole.CALL_CENTER,
        password: adminPassword,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'vendas@hsr.com.br',
        name: 'Vendas (Teste)',
        role: UserRole.SALES,
        password: adminPassword,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'cirurgiao@hsr.com.br',
        name: 'Dr. Cirurgião (Teste)',
        role: UserRole.SURGEON,
        password: adminPassword,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'dr.matheus@hsr.com.br',
        name: 'Dr. Matheus Oliveira',
        role: UserRole.SURGEON,
        password: adminPassword,
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ Created ${users.length} users`);

  // Create Surgeons
  const surgeons = await Promise.all([
    prisma.surgeon.create({
      data: {
        name: 'Dr. Matheus Oliveira',
        specialty: 'Rinoplastia',
        crm: 'CRM/BA 12345',
        email: 'matheus.oliveira@hsr.com.br',
        phone: '(71) 99999-0001',
        isActive: true,
      },
    }),
    prisma.surgeon.create({
      data: {
        name: 'Dra. Larissa Costa',
        specialty: 'Lipoaspiração',
        crm: 'CRM/BA 23456',
        email: 'larissa.costa@hsr.com.br',
        phone: '(71) 99999-0002',
        isActive: true,
      },
    }),
    prisma.surgeon.create({
      data: {
        name: 'Dra. Sabrina Mendes',
        specialty: 'Abdominoplastia',
        crm: 'CRM/BA 34567',
        email: 'sabrina.mendes@hsr.com.br',
        phone: '(71) 99999-0003',
        isActive: true,
      },
    }),
    prisma.surgeon.create({
      data: {
        name: 'Dr. Sandro Lima',
        specialty: 'Mamoplastia',
        crm: 'CRM/BA 45678',
        email: 'sandro.lima@hsr.com.br',
        phone: '(71) 99999-0004',
        isActive: true,
      },
    }),
    prisma.surgeon.create({
      data: {
        name: 'Dra. Carla Souza',
        specialty: 'Blefaroplastia',
        crm: 'CRM/BA 56789',
        email: 'carla.souza@hsr.com.br',
        phone: '(71) 99999-0005',
        isActive: true,
      },
    }),
    prisma.surgeon.create({
      data: {
        name: 'Dr. Roberto Alves',
        specialty: 'Otoplastia',
        crm: 'CRM/BA 67890',
        email: 'roberto.alves@hsr.com.br',
        phone: '(71) 99999-0006',
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ Created ${surgeons.length} surgeons`);

  // Create Availability Slots for each surgeon
  for (const surgeon of surgeons) {
    await prisma.availabilitySlot.createMany({
      data: [
        { surgeonId: surgeon.id, dayOfWeek: 1, startTime: '08:00', endTime: '12:00', isActive: true },
        { surgeonId: surgeon.id, dayOfWeek: 1, startTime: '14:00', endTime: '18:00', isActive: true },
        { surgeonId: surgeon.id, dayOfWeek: 2, startTime: '08:00', endTime: '12:00', isActive: true },
        { surgeonId: surgeon.id, dayOfWeek: 2, startTime: '14:00', endTime: '18:00', isActive: true },
        { surgeonId: surgeon.id, dayOfWeek: 3, startTime: '08:00', endTime: '12:00', isActive: true },
        { surgeonId: surgeon.id, dayOfWeek: 3, startTime: '14:00', endTime: '18:00', isActive: true },
        { surgeonId: surgeon.id, dayOfWeek: 4, startTime: '08:00', endTime: '12:00', isActive: true },
        { surgeonId: surgeon.id, dayOfWeek: 4, startTime: '14:00', endTime: '18:00', isActive: true },
        { surgeonId: surgeon.id, dayOfWeek: 5, startTime: '08:00', endTime: '12:00', isActive: true },
      ],
    });
  }
  console.log('✅ Created availability slots');

  // Lead data
  const firstNames = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Fernando', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Leonardo', 'Marcos', 'Natalia', 'Octavio', 'Patricia', 'Ricardo', 'Sofia', 'Thiago', 'Ursula', 'Vinicius', 'William', 'Xavier', 'Yasmin', 'Zilda'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Almeida', 'Nascimento', 'Mendes', 'Ferreira', 'Rodrigues', 'Carvalho', 'Araujo', 'Monteiro', 'Barbosa'];
  const origins = ['Instagram', 'TikTok', 'Site', 'Indicação', 'Facebook'];
  const procedures = ['Rinoplastia', 'Lipoaspiração', 'Mamoplastia', 'Abdominoplastia', 'Blefaroplastia', 'Otoplastia', 'Lipo HD', 'Mamoplastia + Abdominoplastia', 'Rinoplastia + Otoplastia', 'Próteses'];
  const statuses = [LeadStatus.NEW, LeadStatus.NEW, LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.CONVERTED, LeadStatus.LOST];
  const notes = ['', '', '', 'Interessado(a) no procedimento há anos', 'Já fez avaliação em outra clínica', 'Indicação de amigo(a)', 'Quer agendar para o próximo mês', ' Orçamento solicitado', 'Ligação não atendida', 'Número incorreto'];

  // Create 60 leads
  const leads = [];
  for (let i = 0; i < 60; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const status = randomElement(statuses);
    
    const lead = await prisma.lead.create({
      data: {
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`,
        phone: `(71) 9${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`,
        cpf: generateValidCPF(),
        source: randomElement(origins),
        origin: randomElement(origins),
        procedure: randomElement(procedures),
        preferredDoctor: randomElement(surgeons).id,
        whatsappActive: Math.random() > 0.3,
        status: status,
        notes: randomElement(notes),
        createdAt: randomDate(new Date('2026-01-01'), new Date()),
      },
    });
    leads.push(lead);
  }
  console.log(`✅ Created ${leads.length} leads`);

  // Create 15 patients from converted leads
  const convertedLeads = leads.filter(l => l.status === LeadStatus.CONVERTED);
  const patientLeads = convertedLeads.slice(0, 15);
  
  const patients = [];
  const sexValues = ['Masculino', 'Feminino'];
  const howMetValues = ['Instagram', 'Facebook', 'Google', 'TikTok', 'Indicação', 'Google Ads', 'Facebook Ads'];

  for (const lead of patientLeads) {
    const patient = await prisma.patient.create({
      data: {
        leadId: lead.id,
        dateOfBirth: randomDate(new Date('1970-01-01'), new Date('2005-12-31')),
        medicalRecord: `PR-2026-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
        address: `Rua ${randomElement(['das Flores', 'das Acácias', 'do Sol', 'da Lua', 'das Estrelas'])}, ${Math.floor(Math.random() * 500) + 1} - ${randomElement(['Pituba', 'Barra', 'Rio Vermelho', 'Pelourinho', 'Brotas'])}, Salvador/BA`,
        sex: randomElement(sexValues),
        weight: Math.round((Math.random() * 50 + 50) * 10) / 10,
        height: Math.floor(Math.random() * 30 + 155),
        howMet: randomElement(howMetValues),
        documents: {
          create: [
            {
              name: 'Contrato de Prestação de Serviços',
              type: DocumentType.CONTRACT,
              date: randomDate(new Date('2026-01-01'), new Date('2026-03-01')),
              status: DocumentStatus.SIGNED,
            },
            {
              name: 'Termo de Ciência',
              type: DocumentType.TERM,
              date: randomDate(new Date('2026-01-01'), new Date('2026-03-01')),
              status: DocumentStatus.SIGNED,
            },
            {
              name: 'Exames Pré-Operatórios',
              type: DocumentType.EXAM,
              date: randomDate(new Date('2026-01-01'), new Date('2026-03-01')),
              status: Math.random() > 0.5 ? DocumentStatus.UPLOADED : DocumentStatus.PENDING,
            },
            {
              name: 'Laudo Médico',
              type: DocumentType.EXAM,
              date: randomDate(new Date('2026-01-15'), new Date('2026-02-15')),
              status: Math.random() > 0.3 ? DocumentStatus.UPLOADED : DocumentStatus.PENDING,
            },
          ],
        },
        postOps: {
          create: [
            {
              date: randomDate(new Date('2026-03-01'), new Date('2026-04-30')),
              type: PostOpType.RETURN,
              description: randomElement(['Retorno 7 dias', 'Retorno 15 dias', 'Retorno 30 dias']),
              status: PostOpStatus.SCHEDULED,
            },
            {
              date: randomDate(new Date('2026-04-01'), new Date('2026-05-31')),
              type: PostOpType.PHONE_CALL,
              description: 'Ligação de acompanhamento',
              status: Math.random() > 0.6 ? PostOpStatus.COMPLETED : PostOpStatus.SCHEDULED,
            },
          ],
        },
      },
    });
    patients.push(patient);

    // Create contacts for this lead
    await prisma.contact.createMany({
      data: [
        {
          leadId: lead.id,
          date: randomDate(new Date('2026-01-01'), new Date('2026-03-01')),
          type: randomElement([ContactType.WHATSAPP, ContactType.CALL, ContactType.EMAIL]),
          direction: ContactDirection.OUTBOUND,
          status: randomElement([ContactStatus.DELIVERED, ContactStatus.READ, ContactStatus.ANSWERED]),
          message: 'Olá! Gostaríamos de confirmar seu interesse no procedimento.',
        },
        {
          leadId: lead.id,
          date: randomDate(new Date('2026-01-01'), new Date('2026-03-01')),
          type: randomElement([ContactType.WHATSAPP, ContactType.CALL]),
          direction: Math.random() > 0.5 ? ContactDirection.INBOUND : ContactDirection.OUTBOUND,
          status: randomElement([ContactStatus.DELIVERED, ContactStatus.READ, ContactStatus.ANSWERED]),
          message: randomElement(['Sim, tenho interesse', 'Quero mais informações', 'Quando posso agendar?']),
        },
      ],
    });
  }
  console.log(`✅ Created ${patients.length} patients with contacts and documents`);

  // Create Appointments for patients
  const appointments = [];
  for (const patient of patients) {
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        surgeonId: randomElement(surgeons).id,
        procedure: randomElement(procedures),
        scheduledAt: randomDate(new Date('2026-03-01'), new Date('2026-06-30')),
        status: randomElement([AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED]),
        notes: Math.random() > 0.7 ? randomElement(['Avaliação inicial', 'Retorno', 'Pré-operatório', 'Pós-operatório']) : null,
      },
    });
    appointments.push(appointment);

    // Create audit log for patient creation
    await prisma.auditLog.create({
      data: {
        entityType: 'Patient',
        entityId: patient.id,
        action: 'CREATED',
        newValue: { createdAt: new Date() },
        reason: 'Seed - Created patient from converted lead',
        userId: users[0].id,
        patientId: patient.id,
      },
    });

    // Create audit log for appointment
    if (Math.random() > 0.5) {
      await prisma.auditLog.create({
        data: {
          entityType: 'Appointment',
          entityId: appointment.id,
          action: 'CREATED',
          newValue: { procedure: appointment.procedure, scheduledAt: appointment.scheduledAt },
          reason: 'Seed - Created appointment',
          userId: users[0].id,
          appointmentId: appointment.id,
          patientId: patient.id,
        },
      });
    }

    // Create notification for appointment
    if (Math.random() > 0.4) {
      await prisma.notification.create({
        data: {
          appointmentId: appointment.id,
          type: 'APPOINTMENT_REMINDER',
          status: 'PENDING',
          scheduledFor: new Date(appointment.scheduledAt.getTime() - 24 * 60 * 60 * 1000),
          message: `Lembrete: Consulta de ${procedures[0]} agendada para amanhã`,
        },
      });
    }
  }
  console.log(`✅ Created ${appointments.length} appointments`);

  // Create some NEW/CONTACTED leads with appointments scheduled
  // Now we need to create patients first, then appointments
  const newLeads = leads.filter(l => l.status === LeadStatus.NEW || l.status === LeadStatus.CONTACTED);
  const newLeadPatients = [];
  for (let i = 0; i < Math.min(5, newLeads.length); i++) {
    const patient = await prisma.patient.create({
      data: {
        leadId: newLeads[i].id,
        dateOfBirth: randomDate(new Date('1990-01-01'), new Date('2000-12-31')),
        medicalRecord: `PR-SEED-${i}`,
        address: 'Rua Teste, 123',
      },
    });
    newLeadPatients.push(patient);
    await prisma.appointment.create({
      data: {
        patientId: patient.id,
        surgeonId: randomElement(surgeons).id,
        procedure: randomElement(procedures),
        scheduledAt: randomDate(new Date('2026-03-10'), new Date('2026-04-30')),
        status: AppointmentStatus.SCHEDULED,
      },
    });
  }
  console.log('✅ Created additional appointments for new leads');

  // Create additional patients for today's appointments
  // Include all patients created so far
  const allPatients = [...patients, ...newLeadPatients];
  const leadsWithPatients = new Set(allPatients.map(p => p.leadId));
  const availableLeads = leads.filter(l => !leadsWithPatients.has(l.id));
  const todayLeads = availableLeads.slice(0, 5);
  const todayPatients = [];
  for (let i = 0; i < todayLeads.length; i++) {
    const patient = await prisma.patient.create({
      data: {
        leadId: todayLeads[i].id,
        dateOfBirth: randomDate(new Date('1980-01-01'), new Date('1995-12-31')),
        medicalRecord: `PR-TODAY-${i}`,
        address: 'Rua Hoje, 123',
      },
    });
    todayPatients.push(patient);
  }

  // Create TODAY appointments to populate the UI automatically
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = [
    {
      patientId: todayPatients[0]?.id,
      surgeonId: surgeons[0].id,
      procedure: 'Primeira Consulta',
      scheduledAt: new Date(`${todayStr}T09:00:00`),
      status: AppointmentStatus.SCHEDULED,
      notes: 'Paciente muito interessado'
    },
    {
      patientId: todayPatients[1]?.id,
      surgeonId: surgeons[1].id,
      procedure: 'Rinoplastia',
      scheduledAt: new Date(`${todayStr}T10:00:00`),
      status: AppointmentStatus.CONFIRMED,
      notes: 'Cirurgia agendada'
    },
    {
      patientId: todayPatients[2]?.id,
      surgeonId: surgeons[2].id,
      procedure: 'Retorno',
      scheduledAt: new Date(`${todayStr}T14:00:00`),
      status: AppointmentStatus.COMPLETED,
      notes: 'Tudo certo com a recuperação'
    },
    {
      patientId: todayPatients[3]?.id,
      surgeonId: surgeons[0].id,
      procedure: 'Avaliação',
      scheduledAt: new Date(`${todayStr}T15:00:00`),
      status: AppointmentStatus.CANCELLED,
      notes: 'Cancelou por imprevisto'
    },
    {
      patientId: todayPatients[4]?.id,
      surgeonId: surgeons[1].id,
      procedure: 'Lipoaspiração',
      scheduledAt: new Date(`${todayStr}T16:00:00`),
      status: AppointmentStatus.NO_SHOW,
      notes: 'Paciente não apareceu'
    }
  ];

  for (const apt of todayAppointments) {
    if (apt.patientId) {
      await prisma.appointment.create({ data: apt });
    }
  }
  console.log(`✅ Created ${todayAppointments.length} current-day appointments for UI display`);

  // Create Message Templates
  await Promise.all([
    prisma.messageTemplate.create({
      data: {
        name: 'Boas-vindas Lead',
        channel: MessageChannel.WHATSAPP,
        content: 'Olá {nome}! Bem-vindo(a) ao Hospital São Rafael. Recebemos seu interesse em {procedimento}. Em breve entraremos em contato!',
        triggerDays: -1, // Changed to not overlap with the 0-days appointment reminder
      },
    }),
    prisma.messageTemplate.create({
      data: {
        name: 'Dia da Consulta',
        channel: MessageChannel.WHATSAPP,
        content: 'Olá {nome}, hoje é o dia da sua consulta com {medico} às {hora}. Esperamos você!',
        triggerDays: 0,
      },
    }),
    prisma.messageTemplate.create({
      data: {
        name: 'Lembrete 4 dias',
        channel: MessageChannel.WHATSAPP,
        content: 'Olá {nome}! Lembramos que sua consulta está agendada para {data} às {hora} com {medico}.',
        triggerDays: 4,
      },
    }),
    prisma.messageTemplate.create({
      data: {
        name: 'Lembrete 2 dias',
        channel: MessageChannel.WHATSAPP,
        content: '{nome}, faltam apenas 2 dias para sua consulta! Não esqueça de trazer seus exames.',
        triggerDays: 2,
      },
    }),
    prisma.messageTemplate.create({
      data: {
        name: 'Lembrete 1 dia',
        channel: MessageChannel.WHATSAPP,
        content: 'Sua consulta é amanhã, {nome}! Estaremos esperando você às {hora}. Qualquer dúvida, estamos à disposição.',
        triggerDays: 1,
      },
    }),
    prisma.messageTemplate.create({
      data: {
        name: 'Obrigado pela visita',
        channel: MessageChannel.WHATSAPP,
        content: 'Obrigado pela visita, {nome}! Foi um prazer atendê-lo. Em breve enviaremos o orçamento para {procedimento}.',
        triggerDays: 1,
      },
    }),
    prisma.messageTemplate.create({
      data: {
        name: 'Follow-up 7 dias',
        channel: MessageChannel.WHATSAPP,
        content: 'Olá {nome}! Já decidiu sobre o procedimento? Estamos à disposição para esclarecer qualquer dúvida.',
        triggerDays: 7,
      },
    }),
  ]);
  console.log('✅ Created message templates');

  // Create Audit Logs
  await Promise.all([
    prisma.auditLog.create({
      data: {
        entityType: 'Lead',
        entityId: leads[0].id,
        action: 'STATUS_CHANGE',
        oldValue: JSON.stringify(LeadStatus.NEW),
        newValue: JSON.stringify(LeadStatus.CONTACTED),
        reason: 'Contato realizado via Call Center',
        userId: users[1].id,
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: 'Lead',
        entityId: leads[1].id,
        action: 'STATUS_CHANGE',
        oldValue: JSON.stringify(LeadStatus.CONTACTED),
        newValue: JSON.stringify(LeadStatus.QUALIFIED),
        reason: 'Paciente demonstrou interesse Real',
        userId: users[1].id,
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: 'Lead',
        entityId: leads[2].id,
        action: 'CONVERTED',
        oldValue: JSON.stringify(LeadStatus.QUALIFIED),
        newValue: JSON.stringify(LeadStatus.CONVERTED),
        reason: 'Paciente assinou contrato',
        userId: users[0].id,
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: 'Lead',
        entityId: leads[3].id,
        action: 'STATUS_CHANGE',
        oldValue: JSON.stringify(LeadStatus.NEW),
        newValue: JSON.stringify(LeadStatus.LOST),
        reason: 'Paciente não respondeu',
        userId: users[1].id,
      },
    }),
  ]);
  console.log('✅ Created audit logs');

  // Summary
  console.log('');
  console.log('📊 Seed Summary:');
  console.log(`   - ${users.length} usuários`);
  console.log(`   - ${surgeons.length} cirurgiões`);
  console.log(`   - ${leads.length} leads`);
  console.log(`   - ${patients.length} pacientes`);
  console.log(`   - ${appointments.length + 10} agendamentos`);
  console.log('');
  console.log('📧 Login credentials:');
  console.log('   Admin: admin@hsr.com.br');
  console.log('   Recepção: recepcao@hsr.com.br');
  console.log('   Call Center: callcenter@hsr.com.br');
  console.log('   Vendas: vendas@hsr.com.br');
  console.log('   Cirurgião: cirurgiao@hsr.com.br');
  console.log('   Password: admin123');
  console.log('');
  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
