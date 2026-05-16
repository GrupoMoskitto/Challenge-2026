# Automação de WhatsApp

A automação de comunicações via WhatsApp é um dos pilares de eficiência do CRMed, reduzindo o no-show e automatizando o acompanhamento pós-operatório. A infraestrutura utiliza exclusivamente a **Evolution Go API** (versão Golang do Evolution API).

## Régua de Notificações (RN05)

| Evento | Gatilho | Objetivo |
| :--- | :--- | :--- |
| **Lembrete 30d** | 30 dias antes do agendamento | Manter o agendamento no radar do paciente. |
| **Lembrete 7d** | 7 dias antes do agendamento | Iniciar preparativos para o procedimento. |
| **Confirmação 48h** | 48 horas antes do agendamento | Confirmar presença ou solicitar remarcação. |
| **Pós-Op** | Data definida no registro de Post-Op | Acompanhamento de recuperação do paciente. |

Os jobs são enfileirados no **BullMQ (Redis)** no momento do agendamento e executados pelo `Daily Cron` às 08:00 (America/Sao_Paulo).

---

## Máquina de Estados do Chatbot

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> NEW_ASK_NAME: Novo contato desconhecido
    NEW_ASK_NAME --> NEW_ASK_EMAIL: Nome recebido
    NEW_ASK_EMAIL --> IDLE: Lead criado no CRM

    IDLE --> VERIFY_DOB_CHALLENGE: Paciente pede agendamentos
    VERIFY_DOB_CHALLENGE --> APPOINTMENT_LIST: Data de nascimento correta (LGPD)
    VERIFY_DOB_CHALLENGE --> IDLE: Falha na verificação

    IDLE --> AWAITING_CONFIRMATION: Confirmação 48h enviada
    AWAITING_CONFIRMATION --> CONFIRMED: Paciente responde "Sim"
    AWAITING_CONFIRMATION --> RESCHEDULING: Paciente responde "Não"
    AWAITING_CONFIRMATION --> IDLE: Timeout → RN09 → ATTENTION_REQUIRED

    CONFIRMED --> [*]
    RESCHEDULING --> IDLE: Call Center assume
    APPOINTMENT_LIST --> [*]: Autoatendimento concluído
```

### Estados do Chatbot

| Estado | Descrição |
| :--- | :--- |
| `NEW_ASK_NAME` | Captação de leads: solicita nome ao contato desconhecido. |
| `NEW_ASK_EMAIL` | Captação de leads: solicita email e cria `Lead` no CRM. |
| `VERIFY_DOB_CHALLENGE` | Desafio LGPD: valida data de nascimento antes de exibir dados clínicos. |
| `VERIFY_DOB_ENRICH` | Progressive Profiling: captura data de nascimento ausente no perfil do paciente. |
| `AWAITING_CONFIRMATION` | Aguardando resposta à confirmação de 48h do agendamento. |
| `APPOINTMENT_LIST` | Autoatendimento: lista e permite gerenciar agendamentos do paciente. |

---

## Sistema de Templates

O conteúdo das mensagens é gerenciado **exclusivamente pelo banco de dados** — nunca hardcoded no backend. Isso permite que a equipe clínica edite mensagens sem deploys.

### TemplateParser

O `TemplateParser` do pacote `@crmed/database` realiza a interpolação de variáveis:

```typescript
// Exemplo de template no banco:
"Olá *{{paciente}}*! Seu procedimento *{{procedimento}}* com o Dr. {{medico}} está agendado para {{data}}."

// Resultado após parse:
"Olá *João Silva*! Seu procedimento *Rinoplastia* com o Dr. Carlos está agendado para 20/06/2026."
```

- Suporta sintaxe `{{ }}` (duplas chaves).
- Suporta formatação nativa do WhatsApp: `*negrito*`, `_itálico_`.
- **Graceful Degradation**: Tags não encontradas são substituídas por termos genéricos (ex: `"nosso especialista"`), evitando mensagens quebradas.

---

## Integração Técnica

### Arquitetura do Fluxo de Mensagem

```mermaid
sequenceDiagram
    participant C as Cron Job (08:00)
    participant BQ as BullMQ (Redis)
    participant W as Worker Processor
    participant EG as Evolution Go
    participant WA as WhatsApp Network
    participant P as Paciente

    C->>BQ: Enfileira jobs (30d/7d/48h)
    BQ->>W: Job processado
    W->>W: Carrega template do banco
    W->>W: TemplateParser.render()
    W->>EG: POST /message/sendText
    EG->>WA: Envia mensagem
    WA->>P: Notificação recebida
    P->>WA: Responde "1" (Confirmar)
    WA->>EG: Webhook evento Message
    EG->>W: POST /webhook/evolution
    W->>W: Fingerprint check (deduplicação)
    W->>W: WhatsappChatbot.handleRawMessage()
    W->>W: Atualiza status Appointment → CONFIRMED
    W->>W: Dispara recálculo Risk Score
```

### Deduplicação de Mensagens (Fingerprint)

O webhook processa eventos com uma verificação de `fingerprint` em memória (`Set<string>`) com lock natural de 10 segundos, prevenindo que a mesma mensagem seja processada duas vezes em caso de retentativas da Evolution Go.

### Autenticação com Evolution Go

- **Global Key**: Header `apikey` com a chave global da instância.
- **Instance Token**: Header `Authorization: Bearer <instanceToken>` para operações instance-scoped.
- Respostas são envelopadas no formato `{ data: T, message: string }` e desembrulhadas via `EvoGoClient.unwrap()`.

---

## Sandbox Mode (Desenvolvimento)

Em ambiente de desenvolvimento e staging, as mensagens são bloqueadas para evitar spam em números reais.

- **Variável**: `DEV_ALLOWED_PHONE` (definida no `.env` raiz).
- **Comportamento**: O `WhatsappSender` verifica se o número de destino é igual ao `DEV_ALLOWED_PHONE`. Caso contrário, a mensagem é logada como `blocked_by_dev_sandbox` e **não enviada**.
- **Garantia**: Em produção, esta variável deve estar vazia ou não definida.

---

## Segurança do Webhook

A rota `POST /webhook/evolution` nos Workers é protegida por:

| Camada | Mecanismo |
| :--- | :--- |
| **Assinatura** | HMAC-SHA256 validado em cada request para garantir origem confiável |
| **IP Allowlist** | Requisições fora do range da infraestrutura são bloqueadas |
| **Idempotência** | Fingerprint em memória previne reprocessamento de eventos duplicados |
