# CRMed Documentation

Bem-vindo à documentação oficial do CRMed, um sistema completo de gestão de leads, pacientes e agendamentos para clínicas médicas.

## Visão Geral

O CRMed é um monorepo construído com tecnologias modernas para oferecer uma experiência robusta e escalável. O sistema automatiza o ciclo de vida do paciente, desde o primeiro contato como lead até o pós-operatório, integrando comunicações via WhatsApp e análise de risco de no-show.

## Navegação

- [Arquitetura](./architecture.md) — Visão técnica do sistema e fluxo de dados.
- [Banco de Dados](./database.md) — Modelagem de dados e diagrama ER.
- [Regras de Negócio](./business-rules.md) — Documentação das RN01 a RN09.
- [Segurança](./security.md) — Modelo RBAC, LGPD e autenticação.
- [API Reference](./api.md) — Documentação da API GraphQL.
- [Desenvolvimento](./development.md) — Guia de início rápido e scripts.

### Funcionalidades

- [Automação de WhatsApp](./features/whatsapp-automation.md)
- [Gestão de Leads](./features/lead-management.md)
- [Agendamento](./features/scheduling.md)
- [Score de Risco de No-Show](./features/no-show-risk-score.md)

## Decisões Arquiteturais

1. **Monorepo com Turborepo**: Facilita o compartilhamento de código entre API, Web e Workers.
2. **GraphQL**: Camada de API flexível e tipada.
3. **Prisma ORM**: Modelagem de dados segura e migrações versionadas.
4. **BullMQ**: Processamento de filas robusto para notificações e tarefas de background.
5. **Soft Delete & Audit Log**: Conformidade com LGPD e rastreabilidade total de alterações.
