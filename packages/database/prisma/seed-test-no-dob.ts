import { PrismaClient, LeadStatus, AppointmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating test patient WITHOUT DOB (Unique Phone)...');

  const phone = '5511988887777';
  const email = 'unique.no.dob@example.com';

  // 1. Create a Lead
  const lead = await prisma.lead.upsert({
    where: { email },
    update: { phone },
    create: {
      name: 'Paciente Sem Data',
      email,
      phone,
      cpf: '111.222.333-44',
      source: 'TEST',
      status: LeadStatus.QUALIFIED,
      whatsappActive: true,
    },
  });

  // 2. Create a Patient (NO DOB)
  const patient = await prisma.patient.upsert({
    where: { leadId: lead.id },
    update: {
        dateOfBirth: null,
    },
    create: {
      leadId: lead.id,
      dateOfBirth: null,
      medicalRecord: 'TEST-UNIQUE-NO-DOB',
    },
  });

  // 3. Get a Surgeon
  const surgeon = await prisma.surgeon.findFirst();
  if (!surgeon) return;

  // 4. Create an Appointment (Future)
  await prisma.appointment.create({
    data: {
      patientId: patient.id,
      surgeonId: surgeon.id,
      procedure: 'Consulta VIP',
      scheduledAt: new Date(Date.now() + 86400000 * 10), // 10 days from now
      status: AppointmentStatus.SCHEDULED,
    },
  });

  console.log('✅ Test data created successfully!');
  console.log(`Lead ID: ${lead.id}`);
  console.log(`Phone: ${phone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
