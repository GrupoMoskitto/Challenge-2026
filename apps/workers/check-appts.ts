import { prisma } from '@crmed/database';

async function main() {
  const appointments = await prisma.appointment.findMany({
    include: { notifications: true }
  });
  console.log(JSON.stringify(appointments, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
