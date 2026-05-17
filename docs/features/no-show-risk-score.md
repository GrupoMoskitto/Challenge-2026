# No-Show Risk Score

O No-Show Risk Score é uma funcionalidade inteligente que prediz a probabilidade de um paciente não comparecer a um agendamento, permitindo intervenções proativas.

## Metodologia de Cálculo

O score é calculado por agendamento e varia de **0 a 100**.

### Sinais e Pesos

| Sinal | Tipo | Delta | Condição |
| :--- | :--- | :--- | :--- |
| **Confirmação 48h Ignorada** | Negativo | -40 | Status `ATTENTION_REQUIRED` |
| **Fora do Expediente** | Negativo | -20 | Agendado fora de 08h-18h |
| **Cancelamentos Prévios** | Negativo | -25 | Por ocorrência, máximo -50 |
| **SLA Violado** | Negativo | -30 | > 24h úteis sem resposta |
| **Lead não Qualificado** | Negativo | -15 | Status `NEW` ou `CONTACTED` |
| **Confirmado via Chatbot** | Positivo | +40 | Status `CONFIRMED` |
| **Comparecimentos Prévios** | Positivo | +25 | Por ocorrência, máximo +50 |
| **Lead Convertido** | Positivo | +15 | Status `CONVERTED` |
| **Horário Prime** | Positivo | +10 | Seg-Sex, 09h-17h |
| **Antecedência > 7 dias** | Positivo | +10 | Data da criação vs agendamento |
| **Contato Outbound Recente** | Positivo | +10 | Registrado na última semana |

## Thresholds de Risco

- **HIGH** (Risco Alto): Score < 50. Requer intervenção urgente (ligação manual).
- **MEDIUM** (Moderado): Score 50-79. Monitorar resposta.
- **LOW** (Baixo): Score >= 80. Procedimento normal.

## Arquitetura de Recálculo

```mermaid
flowchart TD
    Event[Evento de Agendamento] --> Trigger{Gatilho?}
    Trigger -- Status Change --> Engine
    Trigger -- New Contact --> Engine
    Trigger -- WhatsApp Webhook --> Engine
    Trigger -- Daily Cron SLA Violado --> Engine
    
    subgraph Engine [Risk Score Engine (BullMQ)]
        Calculate[calculateRiskScore]
    end
    
    Calculate --> Persist[Persistir no DB]
    Persist --> Audit[Audit Log: RISK_SCORE_UPDATED]
    Persist --> UI[Update Dashboard & Pills]
```

## Visualização na UI

- **RiskPill**: Exibição inline em tabelas e cards com cores semafóricas (Teal/Amber/Red).
- **Dashboard Section**: Visão consolidada dos agendamentos críticos dos próximos 7 dias e score médio do hospital.
