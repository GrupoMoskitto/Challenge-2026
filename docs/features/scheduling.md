# Agendamento e Disponibilidade

O módulo de agendamento gerencia a agenda dos cirurgiões e garante que não haja conflitos de horário.

## Disponibilidade de Cirurgiões

A disponibilidade é gerida através de três entidades:
1. **AvailabilitySlot**: Horários fixos semanais (ex: Segundas das 08h às 12h).
2. **ExtraAvailabilitySlot**: Horários excepcionais em datas específicas.
3. **ScheduleBlock**: Bloqueios de agenda (férias, congressos, cirurgias de emergência).

## Regras de Agendamento

- **Expediente (RN08)**: O sistema bloqueia agendamentos fora do intervalo de 08h-18h, a menos que o usuário possua role `ADMIN`.
- **Duração**: Cada agendamento tem uma duração padrão definida no cadastro do cirurgião (`appointmentDuration`), geralmente 30 ou 60 minutos.
- **Conflito (RN04)**: O backend valida a sobreposição de horários antes de confirmar a criação ou atualização de um agendamento.

## Fluxo de Notificação

Ao criar um agendamento:
1. O agendamento entra com status `SCHEDULED`.
2. O **Cronjob Diário** (às 08:00) avalia se o agendamento está na janela correta (30d, 7d, 48h) e enfileira o disparo no BullMQ.
3. Caso o paciente confirme via WhatsApp, o status muda automaticamente para `CONFIRMED`.
4. Caso o paciente não responda à confirmação de 48h dentro do SLA de 24 horas úteis (RN09), o status muda para `ATTENTION_REQUIRED`, um `AuditLog` é gerado e o recálculo do Risk Score é enfileirado automaticamente.

## Integração com Risk Score

Cada alteração de status no agendamento dispara automaticamente o recálculo do **No-Show Risk Score**, permitindo que a equipe identifique lacunas na agenda com antecedência.
