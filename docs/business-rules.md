# Regras de Negócio

O CRMed implementa rigorosamente as seguintes regras de negócio (RN01 a RN09) para garantir a integridade dos dados e a eficiência operacional. Estas regras são **imutáveis** — nunca devem ser contornadas.

## Tabela Geral

| ID | Regra | Descrição | Camada |
| :--- | :--- | :--- | :--- |
| **RN01** | **Unicidade de Lead** | Não permitir duplicidade de CPF ou E-mail. Ao importar CSV, leads duplicados devem ser ignorados (upsert). | DB / API |
| **RN02** | **Conversão de Lead** | Um Lead só pode ser convertido em Paciente se possuir CPF e Telefone válidos. | API |
| **RN03** | **Hierarquia de Acesso** | Somente usuários com role `ADMIN` ou `SURGEON` podem ver prontuários médicos. Roles bloqueados não podem setar status críticos. | API (RBAC) |
| **RN04** | **Conflito de Agenda** | Não permitir dois agendamentos no mesmo horário para o mesmo Cirurgião. | API / DB |
| **RN05** | **Régua de Notificação** | Disparar lembretes via WhatsApp com 30d, 7d e confirmação com 48h de antecedência. | Worker |
| **RN06** | **Rastreabilidade (Audit)** | Toda alteração de status ou deleção deve gerar um registro no `AuditLog` com `userId`, `oldValue`, `newValue` e `ip`. | API / Worker |
| **RN07** | **LGPD / Proteção** | Dados sensíveis (CPF, Endereço, Telefone) devem ser mascarados para usuários com role `CALL_CENTER`. | UI / API |
| **RN08** | **Horário de Expediente** | Agendamentos só podem ser realizados entre 08h e 18h, exceto para role `ADMIN`. | API |
| **RN09** | **SLA Crítico** | Se uma confirmação de 48h não for respondida em 24h úteis, o status muda para `ATTENTION_REQUIRED`. | Worker |

---

## Detalhamento de Implementação

### RN01 — Unicidade de Lead
- **Enforcement**: Constraint `UNIQUE` no PostgreSQL nos campos `email` e `cpf`.
- **Comportamento em CSV**: A mutation `importLeads` realiza `upsert` ou ignora registros existentes, gerando um relatório com `imported`, `skipped` e `errors` por linha.
- **Erro Semântico**: Violações lançam `RN01_VIOLATION:` como prefixo para rastreamento nos logs.

### RN02 — Conversão de Lead
- **Validação**: A mutation `createPatient` (que faz a conversão do lead) valida CPF via algoritmo de dígitos verificadores e formato de telefone antes de criar o `Patient`.
- **Atomicidade**: A criação do `Patient` e a atualização do `Lead.status` para `CONVERTED` ocorrem em uma única transação Prisma.

### RN03 — Hierarquia de Acesso
- **Implementação**: Centralizado em `enforceStatusChange()` em `apps/api/src/config/rbac.ts`.
- **Erro Semântico**: Violações lançam `RN03_VIOLATION:` nos logs com `userId`, `role` e `statusAttempted`.

```typescript
// Exemplo: CALL_CENTER não pode marcar como COMPLETED ou NO_SHOW
await enforceStatusChange({
  blockedRoles: ['CALL_CENTER', 'SALES'],
  criticalStatuses: ['COMPLETED', 'NO_SHOW'],
  ...
});
```

### RN04 — Conflito de Agenda
- **Validação**: O resolver verifica sobreposição de horários considerando a `appointmentDuration` do cirurgião antes de confirmar a criação ou atualização.
- **Timezone**: Todas as comparações de data usam offset `-03:00` (America/Sao_Paulo) para evitar bugs de boundary.

### RN05 — Régua de Notificação
- **Enfileiramento Automático (Cron)**: Jobs de lembretes (30d, 7d, 48h) são enfileirados no BullMQ no momento da avaliação pelo `Daily Cron` (08:00 AM).
- **Disparo Ativo (Reagendamento)**: Se a recepção alterar a data/hora de uma consulta, um gatilho envia imediatamente a nova data via WhatsApp.
- **Template**: O conteúdo das mensagens vem do banco de dados via `TemplateParser`. Nunca hardcoded.

### RN06 — Rastreabilidade (Audit)
- **Dados registrados**: `entityType`, `entityId`, `action`, `oldValue`, `newValue`, `userId`, `reason`, `createdAt`.
- **Trigger**: Interceptadores nos Resolvers via `enforceStatusChange()` garantem o registro antes do commit final da transação.
- **Cobertura**: Status de `Appointment`, `Lead`, `Patient`, orçamentos, queixas e deleções lógicas.

### RN07 — LGPD / Proteção de Dados
- **Mascaramento**: `CALL_CENTER` vê CPF como `***.XXX.XXX-**` e telefone como `(XX) *****-**XX`.
- **Verificação**: O desafio `VERIFY_DOB_CHALLENGE` no chatbot WhatsApp exige confirmação de data de nascimento antes de exibir agendamentos ao paciente.

### RN08 — Horário de Expediente
- **Cálculo**: Baseado no horário local de Brasília (`America/Sao_Paulo`), 08:00–18:00, Seg–Sex.
- **Exceção**: Usuários com role `ADMIN` podem criar agendamentos fora do expediente para casos de emergência.

### RN09 — SLA Crítico
- **Cálculo**: Baseado em **horas úteis** (Seg-Sex, 08h-18h), não em tempo corrido.
- **Fluxo**:
  1. Confirmação de 48h enviada → status `AWAITING_CONFIRMATION` no chatbot.
  2. `Daily Cron` verifica notificações enviadas há mais de 24h úteis sem resposta.
  3. Status do agendamento atualizado para `ATTENTION_REQUIRED`.
  4. Risk Score recalculado (penalidade de -30 pontos por SLA violado).
  5. Dashboard exibe o agendamento na seção "Requer Atenção".
