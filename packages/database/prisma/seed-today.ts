import { PrismaClient, AppointmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding some appointments specifically for TODAY...');

  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch some patients and surgeons
  const patients = await prisma.patient.findMany({ take: 5, include: { lead: true } });
  const surgeons = await prisma.surgeon.findMany({ take: 5 });

  if (patients.length === 0 || surgeons.length === 0) {
    console.log('No patients or surgeons found. Run regular seed first.');
    return;
  }

  // Create some appointments for today
  const newAppointments = [
    {
      patientId: patients[0].leadId,
      surgeonId: surgeons[0].id,
      procedure: 'Primeira Consulta',
      scheduledAt: new Date(`${todayStr}T09:00:00`),
      status: AppointmentStatus.SCHEDULED,
      notes: 'Paciente muito interessado'
    },
    {
      patientId: patients[1].leadId,
      surgeonId: surgeons[1].id,
      procedure: 'Rinoplastia',
      scheduledAt: new Date(`${todayStr}T10:00:00`),
      status: AppointmentStatus.CONFIRMED,
      notes: 'Cirurgia agendada'
    },
    {
      patientId: patients[2].leadId,
      surgeonId: surgeons[2].id,
      procedure: 'Retorno',
      scheduledAt: new Date(`${todayStr}T14:00:00`),
      status: AppointmentStatus.COMPLETED,
      notes: 'Tudo certo com a recuperação'
    },
    {
      patientId: patients[3].leadId,
      surgeonId: surgeons[0].id,
      procedure: 'Avaliação',
      scheduledAt: new Date(`${todayStr}T15:00:00`),
      status: AppointmentStatus.CANCELLED,
      notes: 'Cancelou por imprevisto'
    },
    {
      patientId: patients[4].leadId,
      surgeonId: surgeons[1].id,
      procedure: 'Lipoaspiração',
      scheduledAt: new Date(`${todayStr}T16:00:00`),
      status: AppointmentStatus.NO_SHOW,
      notes: 'Paciente não apareceu'
    }
  ];

  for (const apt of newAppointments) {
    await prisma.appointment.create({ data: apt });
  }

  console.log(`✅ Adicionado ${newAppointments.length} agendamentos para o dia atual (${todayStr})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
