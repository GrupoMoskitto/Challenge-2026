import { PrismaClient, LeadStatus, AppointmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating test patient and appointments...');

  // 1. Create a Lead
  const lead = await prisma.lead.upsert({
    where: { email: 'test.patient@example.com' },
    update: {},
    create: {
      name: 'Paciente de Teste LGPD',
      email: 'test.patient@example.com',
      phone: '5511963252226', // Use your phone for WhatsApp testing
      cpf: '999.888.777-00',
      source: 'TEST',
      status: LeadStatus.QUALIFIED,
      whatsappActive: true,
    },
  });

  // 2. Create a Patient
  const patient = await prisma.patient.upsert({
    where: { leadId: lead.id },
    update: {
        dateOfBirth: new Date('1985-05-15T12:00:00Z'),
    },
    create: {
      leadId: lead.id,
      dateOfBirth: new Date('1985-05-15T12:00:00Z'),
      medicalRecord: 'TEST-001',
    },
  });

  // 3. Get a Surgeon
  const surgeon = await prisma.surgeon.findFirst();
  if (!surgeon) {
    console.error('❌ No surgeon found. Please run regular seed first.');
    return;
  }

  // 4. Create Appointments
  const appt1Date = new Date();
  appt1Date.setDate(appt1Date.getDate() + 2); // 48h from now

  const appt2Date = new Date();
  appt2Date.setDate(appt2Date.getDate() + 30); // 30d from now

  await prisma.appointment.createMany({
    data: [
      {
        patientId: patient.id,
        surgeonId: surgeon.id,
        procedure: 'Cirurgia Plástica',
        scheduledAt: appt1Date,
        status: AppointmentStatus.SCHEDULED,
      },
      {
        patientId: patient.id,
        surgeonId: surgeon.id,
        procedure: 'Procedimento Estético',
        scheduledAt: appt2Date,
        status: AppointmentStatus.SCHEDULED,
      },
    ],
  });

  console.log('✅ Test data created successfully!');
  console.log(`Lead ID: ${lead.id}`);
  console.log(`Phone: ${lead.phone}`);
  console.log(`DOB: 15/05/1985`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
