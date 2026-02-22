# CRMed - Sistema Inteligente de Relacionamento e Performance Clínica

O **CRMed** é uma solução interna desenvolvida para o **Hospital São Rafael** (especializado em cirurgias eletivas e plásticas), com o objetivo de centralizar a jornada do paciente e automatizar processos que hoje dependem de múltiplas ferramentas manuais.

## Escopo do Produto

O sistema atua como o cérebro operacional do hospital, gerenciando desde a entrada do lead até o acompanhamento pós-operatório, garantindo eficiência para as equipes de Call Center, Vendas e Recepção.

### Funcionalidades Principais

- **Centralização de Leads:** Captura automática de redes sociais e canais digitais.
- **Gestão de Agendas:** Controle em tempo real da disponibilidade dos cirurgiões.
- **Automação de Contatos:** Disparos automáticos via WhatsApp para confirmações e lembretes.
- **Inteligência de Dados:** Dashboards de conversão e ociosidade médica.

### Escopo Externo

- Não substitui o ERP completo (Tasy).
- Não realiza processamento de pagamentos diretamente.
- Não é uma interface voltada para o paciente final (contato apenas via WhatsApp).

## Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Backend** | Node.js + TypeScript |
| **API** | GraphQL & RESTful API |
| **Frontend** | React / Next.js (Interface Interna) |
| **Banco de Dados** | PostgreSQL + Prisma ORM |
| **Mensageria/Jobs** | Redis + BullMQ |
| **WhatsApp** | Evolution API + Typebot |
| **Infraestrutura** | Docker & LocalStack (Simulação AWS) |
| **Autenticação** | Clerk / Auth0 |

## Regras de Negócio Críticas (RNs)

Para suprir as necessidades do hospsital, o código deve obrigatoriamente seguir estas diretrizes extraídas dos manuais operacionais:

| RN | Descrição | Prioridade |
| :--- | :--- | :--- |
| **RN01** | **Unicidade:** Proibido cadastrar pacientes ou leads com dados duplicados (CPF, e-mail ou telefone). | Crítica |
| **RN03** | **Hierarquia:** Mudanças de status crítico só podem ser realizadas por colaboradores autorizados via sistema. | Alta |
| **RN05** | **Ciclo de Notificações:** O envio de mensagens via WhatsApp deve seguir a cronologia exata: | Crítica |
| | • 4 dias antes da consulta (Mensagem de confirmação) | |
| | • 2 dias antes (Lembrete) | |
| | • 1 dia antes (Ligação/Mensagem para não confirmados) | |
| | • Dia da consulta (Última tentativa) | |
| **RN06** | **Registro de Auditoria:** Todas as tentativas de contato e alterações de status devem ser logadas com data, hora e responsável. | Alta |

## Configuração de Desenvolvimento

### Pré-requisitos

- Docker e Docker Compose instalados.
- Node.js v20+.

### Instalação

1. Clone o repositório.
2. Configure o arquivo `.env` com as chaves da Evolution API e do Clerk.
3. Suba o ambiente de infraestrutura local:
   ```bash
   docker-compose up -d
   ```
4. Execute as migrações do banco de dados:
   ```bash
   npx prisma migrate dev
   ```

---

Projeto desenvolvido pelo Grupo Moskitto para o Challenge FIAP / Hospital São Rafael.