# Guia de Testes de Fluxo (Flow Testing)

Este guia descreve como realizar testes manuais de ponta a ponta (E2E) nas principais regras de negócio do CRMed, utilizando os scripts de sementes (seeds) e comandos de execução forçada.

---

## Configuração do Ambiente Sandbox

Para que as mensagens de WhatsApp sejam enviadas para o seu celular durante os testes, você **deve** configurar o modo Sandbox no arquivo `.env` na raiz do projeto:

1. Edite o arquivo `.env`.
2. Configure a variável `DEV_ALLOWED_PHONE` com o seu número (com 55 + DDD):
   ```env
   DEV_ALLOWED_PHONE="5511999999999"
   ```
3. Certifique-se de que os Workers e a API estão rodando (`pnpm dev`).

---

## 1. Régua de Notificações (RN05)

Este fluxo testa se o sistema identifica corretamente os agendamentos nas janelas de 30 dias, 7 dias e 48 horas.

### Passo a Passo:
1. **Gerar Dados de Teste:**
   ```bash
   pnpm -F @crmed/workers seed:cron-test
   ```
   *O que acontece:* O sistema cria 3 agendamentos cirúrgicos exatamente nas janelas de disparo para o seu número de Sandbox.

2. **Executar o Cronjob:**
   ```bash
   pnpm -F @crmed/workers test:cron
   ```
   *O que acontece:* O Worker varre o banco, encontra os 3 agendamentos, enfileira os disparos no BullMQ e envia as mensagens para o seu WhatsApp.

3. **Validação:**
   - Verifique se as 3 mensagens chegaram no celular.
   - Verifique se as notificações aparecem no "Sininho" do Dashboard (Frontend).
   - Rode o comando `test:cron` novamente e valide no terminal que os agendamentos foram **Ignorados** (Deduplicação).

---

## 2. Validação de Identidade LGPD (RN07)

Este fluxo testa a trava de segurança que impede a exibição de dados médicos no chatbot sem a confirmação da data de nascimento.

### Passo a Passo:
1. **Gerar Paciente de Teste:**
   ```bash
   # Executando o script de seed específico
   npx tsx packages/database/prisma/seed-test-lgpd.ts
   ```
   *O que acontece:* Cria um paciente chamado "Paciente de Teste LGPD" vinculado ao seu número, com data de nascimento definida como `15/05/1985`.

2. **Iniciar o Chatbot:**
   - Envie "Olá" para o número da clínica no WhatsApp.
   - O robô reconhecerá que você é um paciente existente e mostrará o menu principal.
   - Selecione a opção **"Ver meus agendamentos"**.

3. **Validação:**
   - O robô deve solicitar sua Data de Nascimento.
   - Digite uma data errada e valide a mensagem de erro.
   - Digite `15/05/1985` e valide que ele libera a listagem de consultas.

---

## 3. SLA de Inatividade e Risk Score (RN09)

Este fluxo testa se o sistema penaliza agendamentos que não foram confirmados em até 24 horas úteis.

### Passo a Passo:
1. **Simular Atraso:**
   - Envie uma notificação de 48h via `test:cron`.
   - Acesse o banco de dados (Prisma Studio) e altere o campo `createdAt` dessa notificação para **2 dias atrás**.
   - Mantenha o status do agendamento como `SCHEDULED`.

2. **Executar Monitoramento:**
   ```bash
   pnpm -F @crmed/workers test:cron
   ```
   *O que acontece:* A rotina `checkInactivity` detectará que o SLA foi estourado.

3. **Validação:**
   - O status do agendamento deve mudar para **`ATTENTION_REQUIRED`**.
   - O **Risk Score** do paciente deve diminuir automaticamente (penalidade de SLA).
   - Um registro deve aparecer no **Audit Log** detalhando a violação do SLA.

---

## Comandos de Diagnóstico Rápidos

| Objetivo | Comando |
| :--- | :--- |
| **Limpar Redis (BullMQ)** | `redis-cli flushall` |
| **Resetar Banco e Seeds** | `pnpm --filter @crmed/database db:setup` |
| **Abrir Interface do Banco** | `npx prisma studio` |
| **Ver Logs do Worker** | `pnpm -F @crmed/workers dev` |
