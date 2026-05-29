---
layout: home

hero:
  name: "CRMed"
  text: "Gestão Inteligente para Clínicas Médicas"
  tagline: "Automatize o ciclo de vida do seu paciente com análise preditiva, WhatsApp e segurança total."
  image:
    src: /logo.svg
    alt: CRMed Logo
  actions:
    - theme: brand
      text: Guia de Início Rápido
      link: /development
    - theme: alt
      text: Entenda a Arquitetura
      link: /architecture

features:
  - title: Automação WhatsApp
    details: Integração nativa com Evolution API para agendamentos, lembretes e confirmações automáticas com fallback inteligente para SLA humano.
  - title: Score de Risco No-Show
    details: Algoritmo que calcula a probabilidade de comparecimento baseada em comportamento histórico e variáveis contextuais.
  - title: Segurança & Compliance
    details: RBAC granular, Audit Log total e anonimização irreversível de dados sensíveis para conformidade estrita com a legislação.
  - title: Estrutura de Alta Performance
    details: Monorepo gerenciado por Turborepo com React, GraphQL, Node.js e BullMQ para processamento assíncrono resiliente.
---

<div class="quick-start-preview">

## Como executar o projeto

O CRMed utiliza **pnpm** e **Docker** para simplificar o ambiente local. Siga os passos abaixo:

```bash
# 1. Instale as dependências do monorepo
pnpm install

# 2. Suba o banco de dados e o Redis
docker-compose up -d

# 3. Configure o banco (migrations + seed)
pnpm --filter @crmed/database db:setup

# 4. Inicie todos os serviços em paralelo
pnpm dev
```

> **Nota:** O sistema estará acessível em `http://localhost:5173` (Web) e `http://localhost:3001` (API).

[Acesse o guia completo de desenvolvimento →](/development)

</div>

## Explore a Documentação

Navegue pelos módulos técnicos e de negócio para entender as entranhas do sistema:

- **[Regras de Negócio](/business-rules)**: O coração da solução, detalhando as regras de agendamento e automação.
- **[Arquitetura de Sistemas](/architecture)**: Diagramas C4, fluxos de dados e decisões tecnológicas.
- **[Segurança & Compliance](/security)**: Como protegemos os dados dos pacientes.
- **[API Reference](/api)**: Documentação técnica dos Schemas GraphQL.

<style>
.quick-start-preview {
  margin-top: 64px;
  padding: 40px;
  background-color: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
}

.quick-start-preview h2 {
  margin-top: 0;
  border-top: none;
}

@media (max-width: 640px) {
  .quick-start-preview {
    padding: 24px;
  }
}
</style>
