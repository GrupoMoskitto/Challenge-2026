/**
 * setup-webhook.ts
 *
 * Configura o webhook da instância crmed-whatsapp na Evolution API.
 * Execute este script quando o webhook parar de funcionar ou ao iniciar o sistema.
 *
 * Uso:
 *   pnpm --filter @crmed/workers setup:webhook
 *   npx tsx src/scripts/setup-webhook.ts
 *
 * Variáveis de ambiente necessárias (no .env na raiz do projeto):
 *   EVOLUTION_API_URL     — ex: http://localhost:8080
 *   EVOLUTION_API_KEY     — Sua chave de API
 *   EVOLUTION_INSTANCE_NAME — ex: crmed-whatsapp
 *   EVOLUTION_WEBHOOK_URL — URL do webhook
 */

import 'dotenv/config';
import axios from 'axios';

// ─── Configuration ─────────────────────────────────────────────────────────
const EVOLUTION_API_URL     = process.env.EVOLUTION_API_URL     || 'http://localhost:8080';
const EVOLUTION_API_KEY     = process.env.EVOLUTION_API_KEY     || '';
const INSTANCE_NAME         = process.env.EVOLUTION_INSTANCE_NAME || 'crmed-whatsapp';
// In development: webhook must point to the host machine from inside Docker
const WEBHOOK_URL           = process.env.EVOLUTION_WEBHOOK_URL
  || 'http://host.docker.internal:3002/webhook/evolution';

// ─── Validation ────────────────────────────────────────────────────────────
if (!EVOLUTION_API_KEY) {
  console.error('[Setup] ❌  EVOLUTION_API_KEY não definido no .env');
  process.exit(1);
}

const api = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    apikey: EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

// ─── Helpers ───────────────────────────────────────────────────────────────
function ok(msg: string)    { console.log(`[Setup] ✅  ${msg}`); }
function info(msg: string)  { console.log(`[Setup] ℹ️   ${msg}`); }
function warn(msg: string)  { console.warn(`[Setup] ⚠️   ${msg}`); }
function fail(msg: string)  { console.error(`[Setup] ❌  ${msg}`); }

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  info(`Evolution API URL   : ${EVOLUTION_API_URL}`);
  info(`Instance Name       : ${INSTANCE_NAME}`);
  info(`Webhook Target URL  : ${WEBHOOK_URL}`);
  console.log('');

  // 1. Check if Evolution API is reachable
  try {
    await api.get('/');
    ok('Evolution API está respondendo');
  } catch {
    fail(`Não foi possível conectar à Evolution API em ${EVOLUTION_API_URL}`);
    fail('Verifique se os containers Docker estão rodando: docker compose -f infra/docker/docker-compose.yml ps');
    process.exit(1);
  }

  // 2. Check instance connection state
  try {
    const { data } = await api.get(`/instance/status`);
    const connected = data?.Connected ?? false;
    const loggedIn = data?.LoggedIn ?? false;
    if (connected && loggedIn) {
      ok(`Instância "${INSTANCE_NAME}" está conectada ao WhatsApp`);
    } else {
      warn(`Instância "${INSTANCE_NAME}" está no estado: connected=${connected}, loggedIn=${loggedIn}`);
      if (!connected || !loggedIn) {
        warn('A instância pode precisar ser reconectada. Acesse http://localhost:8080/manager para escanear o QR code.');
      }
    }
  } catch (err: any) {
    if (err?.response?.status === 404) {
      fail(`Instância "${INSTANCE_NAME}" não encontrada na Evolution API.`);
      fail('Crie a instância em http://localhost:8080/manager antes de executar este script.');
      process.exit(1);
    }
    warn(`Não foi possível verificar o estado da instância: ${err?.message}`);
  }

  // 3. Retrieve current webhook config
  try {
    const { data } = await api.get(`/webhook/find/${INSTANCE_NAME}`);
    info('Configuração atual do webhook:');
    console.log('  enabled    :', data?.webhook?.enabled ?? data?.enabled ?? '(desconhecido)');
    console.log('  url        :', data?.webhook?.url     ?? data?.url     ?? '(nenhuma)');
    console.log('  byEvents   :', data?.webhook?.webhookByEvents ?? data?.webhookByEvents ?? '(desconhecido)');
    console.log('  events     :', JSON.stringify(data?.webhook?.events ?? data?.events ?? []));
    console.log('');
  } catch {
    info('Não foi possível ler configuração atual do webhook (pode não estar configurado ainda)');
  }

  // 4. Set the webhook
  info(`Configurando webhook em: ${WEBHOOK_URL} ...`);
  try {
    const payload = {
      webhook: {
        enabled: true,
        url: WEBHOOK_URL,
        webhookByEvents: false,
        webhookBase64: false,
        events: ['MESSAGES_UPSERT'],
      },
    };

    const { data } = await api.post(`/webhook/set/${INSTANCE_NAME}`, payload);
    ok('Webhook configurado com sucesso!');
    console.log('  Resposta:', JSON.stringify(data));
  } catch (err: any) {
    fail(`Falha ao configurar webhook: ${err?.response?.data ? JSON.stringify(err.response.data) : err?.message}`);
    process.exit(1);
  }

  // 5. Verify the new config
  try {
    const { data } = await api.get(`/webhook/find/${INSTANCE_NAME}`);
    console.log('');
    ok('Verificação pós-configuração:');
    console.log('  enabled    :', data?.webhook?.enabled ?? data?.enabled);
    console.log('  url        :', data?.webhook?.url     ?? data?.url);
    console.log('  byEvents   :', data?.webhook?.webhookByEvents ?? data?.webhookByEvents);
    console.log('  events     :', JSON.stringify(data?.webhook?.events ?? data?.events ?? []));
  } catch {
    warn('Não foi possível verificar configuração pós-save');
  }

  console.log('');
  ok('Setup concluído! O sistema está pronto para receber mensagens do WhatsApp.');
  info('Se ainda não receber mensagens, verifique os logs do workers: docker compose -f infra/docker/docker-compose.yml logs -f workers');
}

main().catch((err) => {
  fail(`Erro inesperado: ${err.message}`);
  process.exit(1);
});
