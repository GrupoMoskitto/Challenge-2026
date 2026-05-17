import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.messageTemplate.findFirst({ where: { name: 'Boas-Vindas' } });
  
  if (!existing) {
    await prisma.messageTemplate.create({
      data: {
        name: 'Boas-Vindas',
        channel: 'WHATSAPP',
        triggerDays: 0,
        content: `Olá, *{{paciente}}*! 👋\n\nBem-vindo(a) ao Hospital São Rafael. Recebemos o seu contato com sucesso!\n\nEm breve, um de nossos especialistas de atendimento falará com você por aqui para tirar todas as suas dúvidas sobre o procedimento de *{{procedimento}}* e realizar o seu agendamento.\n\n_Hospital São Rafael — Cuidando de você._`
      }
    });
    console.log("Boas-Vindas template created.");
  } else {
    console.log("Boas-Vindas template already exists.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
