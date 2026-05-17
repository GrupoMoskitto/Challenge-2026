import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sanitizedSearch = 'a';
  try {
    const patients = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        OR: [
          { lead: { name: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { lead: { cpf: { contains: sanitizedSearch, mode: 'insensitive' } } },
          { lead: { phone: { contains: sanitizedSearch, mode: 'insensitive' } } },
        ]
      }
    });
    console.log(`Found ${patients.length} patients.`);
  } catch (error) {
    console.error('Error fetching patients:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
