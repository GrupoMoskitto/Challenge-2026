import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
import { prisma, AppointmentStatus } from '@crmed/database';

async function main() {
  console.log('🌱 Seeding cron test data...');

  const surgeon = await prisma.surgeon.findFirst();
  let patient = await prisma.patient.findFirst({
      where: { lead: { phone: process.env.DEV_ALLOWED_PHONE } },
      include: { lead: true }
  });

  if (!patient && process.env.DEV_ALLOWED_PHONE) {
     const lead = await prisma.lead.create({
         data: {
             name: 'Test Patient (Cron)',
             email: 'testcron@crmed.local',
             phone: process.env.DEV_ALLOWED_PHONE,
             cpf: '00000000000',
             status: 'CONVERTED',
             source: 'Test',
             whatsappActive: true,
         }
     });
     patient = await prisma.patient.create({
         data: {
             leadId: lead.id,
             dateOfBirth: new Date('1990-01-01'),
         },
         include: { lead: true }
     });
  }

  if (!surgeon || !patient) {
    console.error('❌ Base data (Surgeon or Patient) not found. Please run regular seed first.');
    process.exit(1);
  }

  const now = new Date();
  const createTestAppt = async (daysAhead: number, proc: string) => {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysAhead);
    targetDate.setHours(10, 0, 0, 0);

    const appt = await prisma.appointment.create({
        data: {
            patientId: patient!.id,
            surgeonId: surgeon.id,
            scheduledAt: targetDate,
            procedure: proc,
            status: AppointmentStatus.SCHEDULED,
        }
    });

    console.log(`✅ Created appointment for ${daysAhead} days ahead (ID: ${appt.id})`);
    return appt;
  };

  // Clean up any previous test appointments for this patient to avoid clutter
  await prisma.appointment.deleteMany({
      where: { patientId: patient.id, procedure: { contains: 'Test Cron' } }
  });

  await createTestAppt(30, 'Test Cron 30D (Lembrete 30 Dias)');
  await createTestAppt(7, 'Test Cron 7D (Orientações 7 Dias)');
  await createTestAppt(2, 'Test Cron 48H (Confirmação)');

  console.log('🎉 Seed complete. Run pnpm test:cron to test the notifications.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
