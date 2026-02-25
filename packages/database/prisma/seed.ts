import { PrismaClient, LeadStatus, AppointmentStatus, UserRole, ContactType, ContactDirection, ContactStatus, DocumentType, DocumentStatus, PostOpType, PostOpStatus, MessageChannel } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

  // Create Users
  const adminPassword = await bcrypt.hash('admin123', 10);
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
        email: 'callcenter@hsr.com.br',
        name: 'Maria Souza',
        role: UserRole.CALL_CENTER,
        password: adminPassword,
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'recepcao@hsr.com.br',
        name: 'João Silva',
        role: UserRole.RECEPTION,
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

  // Create Leads
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        name: 'Micaele Silva',
        email: 'micaele@email.com',
        phone: '(71) 99123-4567',
        cpf: '123.456.789-00',
        source: 'Instagram',
        origin: 'Instagram',
        procedure: 'Rinoplastia',
        preferredDoctor: surgeons[0].id,
        whatsappActive: true,
        status: LeadStatus.NEW,
        notes: 'Interesse em rinoplastia estrutural',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Carlos Santos',
        email: 'carlos@email.com',
        phone: '(71) 98234-5678',
        cpf: '234.567.890-11',
        source: 'Google Ads',
        origin: 'Google Ads',
        procedure: 'Lipoaspiração',
        preferredDoctor: surgeons[1].id,
        whatsappActive: true,
        status: LeadStatus.CONTACTED,
        notes: 'Já realizou consulta em outra clínica',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Ana Beatriz Rocha',
        email: 'ana@email.com',
        phone: '(71) 97345-6789',
        cpf: '345.678.901-22',
        source: 'TikTok',
        origin: 'TikTok',
        procedure: 'Abdominoplastia',
        preferredDoctor: surgeons[2].id,
        whatsappActive: false,
        status: LeadStatus.QUALIFIED,
        notes: '',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Roberto Almeida',
        email: 'roberto@email.com',
        phone: '(71) 96456-7890',
        cpf: '456.789.012-33',
        source: 'Indicação',
        origin: 'Indicação',
        procedure: 'Blefaroplastia',
        preferredDoctor: surgeons[0].id,
        whatsappActive: true,
        status: LeadStatus.CONVERTED,
        notes: 'Indicação do Dr. Sandro',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Juliana Ferreira',
        email: 'juliana@email.com',
        phone: '(71) 95567-8901',
        cpf: '567.890.123-44',
        source: 'Instagram',
        origin: 'Instagram',
        procedure: 'Mamoplastia',
        preferredDoctor: surgeons[3].id,
        whatsappActive: true,
        status: LeadStatus.CONVERTED,
        notes: 'Contrato assinado',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Pedro Henrique Lima',
        email: 'pedro@email.com',
        phone: '(71) 94678-9012',
        cpf: '678.901.234-55',
        source: 'Google Ads',
        origin: 'Google Ads',
        procedure: 'Rinoplastia',
        preferredDoctor: surgeons[0].id,
        whatsappActive: false,
        status: LeadStatus.NEW,
        notes: '',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Fernanda Dias',
        email: 'fernanda@email.com',
        phone: '(71) 93789-0123',
        cpf: '789.012.345-66',
        source: 'Site',
        origin: 'Site',
        procedure: 'Lipo HD',
        preferredDoctor: surgeons[1].id,
        whatsappActive: true,
        status: LeadStatus.CONTACTED,
        notes: 'Quer agendar para março',
      },
    }),
    prisma.lead.create({
      data: {
        name: 'Marcos Vinícius',
        email: 'marcos@email.com',
        phone: '(71) 92890-1234',
        cpf: '890.123.456-77',
        source: 'TikTok',
        origin: 'TikTok',
        procedure: 'Otoplastia',
        preferredDoctor: surgeons[2].id,
        whatsappActive: true,
        status: LeadStatus.QUALIFIED,
        notes: '',
      },
    }),
  ]);
  console.log(`✅ Created ${leads.length} leads`);

  // Create Patients with documents and postOps
  const patient = await prisma.patient.create({
    data: {
      leadId: leads[4].id,
      dateOfBirth: new Date('1990-05-15'),
      medicalRecord: 'PR-2026-0001',
      address: 'Rua das Flores, 123 - Pituba, Salvador/BA',
      documents: {
        create: [
          {
            name: 'Contrato de Prestação de Serviços',
            type: DocumentType.CONTRACT,
            date: new Date('2026-02-15'),
            status: DocumentStatus.SIGNED,
          },
          {
            name: 'Termo de Ciência - Peso',
            type: DocumentType.TERM,
            date: new Date('2026-02-15'),
            status: DocumentStatus.SIGNED,
          },
          {
            name: 'Exames Pré-Operatórios',
            type: DocumentType.EXAM,
            date: new Date('2026-02-20'),
            status: DocumentStatus.UPLOADED,
          },
        ],
      },
      postOps: {
        create: [
          {
            date: new Date('2026-03-10'),
            type: PostOpType.RETURN,
            description: 'Retorno 15 dias pós-cirurgia',
            status: PostOpStatus.SCHEDULED,
          },
          {
            date: new Date('2026-04-25'),
            type: PostOpType.RETURN,
            description: 'Retorno 2 meses',
            status: PostOpStatus.PENDING,
          },
        ],
      },
    },
    include: {
      lead: true,
      documents: true,
      postOps: true,
    },
  });

  // Create Contacts for the lead associated with the patient
  await prisma.contact.createMany({
    data: [
      {
        leadId: leads[4].id,
        date: new Date('2026-02-10T10:30:00'),
        type: ContactType.WHATSAPP,
        direction: ContactDirection.OUTBOUND,
        status: ContactStatus.READ,
        message: 'Olá Juliana! Aqui é do Hospital São Rafael. Confirmamos seu interesse em Mamoplastia.',
      },
      {
        leadId: leads[4].id,
        date: new Date('2026-02-11T14:00:00'),
        type: ContactType.CALL,
        direction: ContactDirection.OUTBOUND,
        status: ContactStatus.ANSWERED,
        message: 'Ligação de 8min. Paciente confirmou interesse e agendou avaliação.',
      },
      {
        leadId: leads[4].id,
        date: new Date('2026-02-13T09:00:00'),
        type: ContactType.WHATSAPP,
        direction: ContactDirection.OUTBOUND,
        status: ContactStatus.DELIVERED,
        message: 'Lembrete: sua avaliação é amanhã às 14h com Dr. Sandro Lima.',
      },
      {
        leadId: leads[4].id,
        date: new Date('2026-02-15T16:00:00'),
        type: ContactType.WHATSAPP,
        direction: ContactDirection.INBOUND,
        status: ContactStatus.READ,
        message: 'Gostaria de confirmar o procedimento. Quando posso assinar o contrato?',
      },
    ],
  });
  console.log('✅ Created patient with contacts, documents, and postOps');

  // Create Appointments
  const appointments = await Promise.all([
    prisma.appointment.create({
      data: {
        patientId: leads[2].id,
        surgeonId: surgeons[2].id,
        procedure: 'Abdominoplastia',
        scheduledAt: new Date('2026-02-24T08:00:00'),
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: leads[7].id,
        surgeonId: surgeons[2].id,
        procedure: 'Otoplastia',
        scheduledAt: new Date('2026-02-24T10:00:00'),
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: leads[3].id,
        surgeonId: surgeons[0].id,
        procedure: 'Blefaroplastia',
        scheduledAt: new Date('2026-02-24T09:00:00'),
        status: AppointmentStatus.SCHEDULED,
        notes: 'Avaliação final',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: leads[4].id,
        surgeonId: surgeons[3].id,
        procedure: 'Mamoplastia',
        scheduledAt: new Date('2026-02-25T14:00:00'),
        status: AppointmentStatus.SCHEDULED,
        notes: 'Pré-operatório',
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: leads[0].id,
        surgeonId: surgeons[0].id,
        procedure: 'Rinoplastia',
        scheduledAt: new Date('2026-02-25T08:00:00'),
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    prisma.appointment.create({
      data: {
        patientId: leads[1].id,
        surgeonId: surgeons[1].id,
        procedure: 'Lipoaspiração',
        scheduledAt: new Date('2026-02-26T10:00:00'),
        status: AppointmentStatus.SCHEDULED,
      },
    }),
  ]);
  console.log(`✅ Created ${appointments.length} appointments`);

  // Create Message Templates
  await Promise.all([
    prisma.messageTemplate.create({
      data: {
        name: 'Boas-vindas Lead',
        channel: MessageChannel.WHATSAPP,
        content: 'Olá {nome}! Bem-vindo(a) ao Hospital São Rafael. Recebemos seu interesse em {procedimento}. Em breve entraremos em contato!',
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
  ]);
  console.log('✅ Created message templates');

  // Create Audit Logs
  await Promise.all([
    prisma.auditLog.create({
      data: {
        entityType: 'Appointment',
        entityId: appointments[0].id,
        action: 'STATUS_CHANGE',
        oldValue: JSON.stringify(AppointmentStatus.SCHEDULED),
        newValue: JSON.stringify(AppointmentStatus.CONFIRMED),
        reason: 'Paciente confirmou presença',
        userId: users[1].id,
        appointmentId: appointments[0].id,
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: 'Lead',
        entityId: leads[1].id,
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
        entityId: leads[3].id,
        action: 'CONVERTED',
        oldValue: JSON.stringify(LeadStatus.QUALIFIED),
        newValue: JSON.stringify(LeadStatus.CONVERTED),
        reason: 'Paciente assinou contrato',
        userId: users[0].id,
      },
    }),
  ]);
  console.log('✅ Created audit logs');

  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('📧 Login credentials:');
  console.log('   Email: admin@hsr.com.br');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
