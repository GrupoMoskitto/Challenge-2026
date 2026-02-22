import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function checkUniqueness(data: {
  cpf?: string;
  email?: string;
  phone?: string;
}) {
  const existing = await prisma.lead.findFirst({
    where: {
      OR: [
        data.cpf ? { cpf: data.cpf } : {},
        data.email ? { email: data.email } : {},
        data.phone ? { phone: data.phone } : {},
      ].filter((q) => Object.keys(q).length > 0),
    },
  });

  if (existing) {
    const field = existing.cpf === data.cpf ? 'CPF' : existing.email === data.email ? 'e-mail' : 'telefone';
    throw new Error(`RN01_VIOLATION: ${field} já cadastrado`);
  }

  return true;
}
