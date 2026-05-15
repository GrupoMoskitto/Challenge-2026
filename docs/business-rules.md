# Regras de Negócio

O CRMed implementa rigorosamente as seguintes regras de negócio (RN01 a RN09) para garantir a integridade dos dados e a eficiência operacional.

| ID | Regra | Descrição | Camada |
| :--- | :--- | :--- | :--- |
| **RN01** | **Unicidade de Lead** | Não permitir duplicidade de CPF ou E-mail. Ao importar CSV, leads duplicados devem ser ignorados ou atualizados. | DB / API |
| **RN02** | **Conversão de Lead** | Um Lead só pode ser convertido em Paciente se possuir CPF e Telefone válidos. | API |
| **RN03** | **Hierarquia de Acesso** | Somente usuários com role `ADMIN` ou `SURGEON` podem ver prontuários médicos. | API (RBAC) |
| **RN04** | **Conflito de Agenda** | Não permitir dois agendamentos no mesmo horário para o mesmo Cirurgião. | API / DB |
| **RN05** | **Régua de Notificação** | Disparar lembretes via WhatsApp com 30d, 7d e confirmação com 48h de antecedência. | Worker |
| **RN06** | **Rastreabilidade (Audit)** | Toda alteração de status ou deleção deve gerar um registro no `AuditLog` com o `userId`. | API / Worker |
| **RN07** | **LGPD / Proteção** | Dados sensíveis (CPF, Endereço) devem ser mascarados para usuários com role `CALL_CENTER`. | UI / API |
| **RN08** | **Horário de Expediente** | Agendamentos só podem ser realizados entre 08h e 18h, exceto plantões autorizados. | API |
| **RN09** | **SLA Crítico** | Se uma confirmação de 48h não for respondida em 24h úteis, o status do agendamento muda para `ATTENTION_REQUIRED`. | Worker |

## Detalhamento de Implementação

### RN01 — Unicidade de Lead
- **Enforcement**: Constraint `UNIQUE` no PostgreSQL nos campos `email` e `cpf`.
- **Comportamento**: A mutation `importLeads` realiza um `upsert` ou ignora registros existentes para evitar erros de transação.

### RN06 — Rastreabilidade (Audit)
- **Implementação**: O serviço de Audit registra `oldValue` e `newValue` como JSON.
- **Trigger**: Interceptadores nos Resolvers e Jobs garantem que a ação seja registrada antes do commit final.

### RN09 — SLA Crítico
- **Cálculo**: Baseado em horas úteis (Seg-Sex, 08h-18h).
- **Ação**: O `Daily Cron` verifica notificações enviadas há mais de 24h úteis sem resposta e atualiza o agendamento, disparando também o recálculo do Risk Score.
