import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.lead.updateMany({
    where: {
      origin: 'Whatsapp'
    },
    data: {
      origin: 'WhatsApp'
    }
  });

  console.log(`Atualizados ${result.count} leads de 'Whatsapp' para 'WhatsApp'`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
