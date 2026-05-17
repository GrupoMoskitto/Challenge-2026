# CRMed Documentation

Bem-vindo à documentação oficial do CRMed, um sistema completo de gestão de leads, pacientes e agendamentos para clínicas médicas.

## Visão Geral

O CRMed é um monorepo construído com tecnologias modernas para oferecer uma experiência robusta e escalável. O sistema automatiza o ciclo de vida do paciente — desde o primeiro contato como lead até o pós-operatório — integrando comunicações via WhatsApp e análise preditiva de risco de no-show.

```
Lead → Paciente → Agendamento → Notificação WhatsApp → Confirmação → Risk Score → Dashboard
```

## Navegação

- [Arquitetura](./architecture.md) — Visão técnica do sistema, fluxo de dados e diagrama de serviços.
- [Banco de Dados](./database.md) — Modelagem de dados e diagrama ER.
- [Regras de Negócio](./business-rules.md) — Documentação das RN01 a RN09.
- [Segurança](./security.md) — RBAC, OWASP Top 10, Rate Limit, JWT, XSS e LGPD.
- [API Reference](./api.md) — Documentação da API GraphQL (queries, mutations, enums, erros).
- [Desenvolvimento](./development.md) — Guia de início rápido e scripts.
- [Testes de Fluxo](./testing-flows.md) — Roteiro para validação manual de regras de negócio (E2E).

### Funcionalidades

- [Automação de WhatsApp](./features/whatsapp-automation.md)
- [Gestão de Leads](./features/lead-management.md)
- [Agendamento](./features/scheduling.md)
- [Score de Risco de No-Show](./features/no-show-risk-score.md)

## Decisões Arquiteturais

| # | Decisão | Motivo |
| :--- | :--- | :--- |
| 1 | **Monorepo com Turborepo** | Compartilhamento de código e tipos entre API, Web e Workers sem duplicação. Build incremental cacheado. |
| 2 | **GraphQL (Apollo Server)** | API flexível, tipada e auto-documentada. Data minimization nativa — o cliente busca exatamente o que precisa (LGPD). |
| 3 | **Prisma ORM** | Modelagem de dados segura, migrações versionadas e proteção nativa contra SQL Injection via prepared statements. |
| 4 | **BullMQ sobre Redis** | Filas persistentes com retry automático para notificações críticas de WhatsApp. |
| 5 | **Soft Delete + Audit Log** | Conformidade com LGPD, rastreabilidade total de alterações e preservação de histórico clínico. |
| 6 | **JWT em Cookies HttpOnly** | Tokens nunca acessíveis via JavaScript — proteção estrutural contra XSS por design. |
