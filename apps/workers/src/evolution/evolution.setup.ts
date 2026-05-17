import { logger } from '../config/logger';
import { EvoGoClient, EvolutionApiError } from './evolution.client';

/**
 * Ensures the Evolution Go instance is ready to receive messages.
 *
 * In EvoGo, the webhook is configured via POST /instance/connect (not /webhook/set).
 * This function:
 *   1. Checks if the API is reachable (health check)
 *   2. Checks the instance connection status
 *   3. If disconnected, calls connect() to set up the webhook and start pairing
 *
 * This runs once on worker boot.
 */
export async function ensureEvolutionReady(client: EvoGoClient): Promise<void> {
  const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL || 'http://host.docker.internal:3002/webhook/evolution';
  const instanceIdEnv = process.env.EVOLUTION_INSTANCE_ID;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

  if (!instanceIdEnv && !instanceName) {
    logger.warn('EvoGo:Setup', 'Neither EVOLUTION_INSTANCE_ID nor EVOLUTION_INSTANCE_NAME is set. Skipping setup.');
    return;
  }

  try {
    const isHealthy = await client.checkHealth();
    if (!isHealthy) {
      logger.warn('EvoGo:Setup', 'Evolution Go API is unreachable. Setup skipped.');
      return;
    }
    logger.info('EvoGo:Setup', 'Evolution Go API is reachable ✓');

    let resolvedInstanceId = instanceIdEnv;

    try {
      const instances = await client.listInstances();
      const instance = instances.find(i => (instanceIdEnv && i.id === instanceIdEnv) || (instanceName && i.name === instanceName));
      if (instance && instance.token) {
        client.setInstanceToken(instance.token);
        resolvedInstanceId = instance.id;
        logger.info('EvoGo:Setup', 'Instance token loaded successfully.');
        // Give EvoGo a moment to stabilize the token session
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        logger.warn('EvoGo:Setup', 'Instance token not found, API calls may fail with 401.');
      }
    } catch (e) {
      logger.warn('EvoGo:Setup', 'Could not fetch instance list to load token.');
    }

    if (!resolvedInstanceId) {
       logger.error('EvoGo:Setup', `Instance not found in Evolution API.`);
       return;
    }

    try {
      const status = await client.getStatus(resolvedInstanceId);

      if (status.Connected && status.LoggedIn) {
        logger.success('EvoGo:Setup', `Instance is connected and logged in as "${status.Name || 'unknown'}" ✓`);
        
        try {
          await client.connect(webhookUrl, ['MESSAGE', 'RECEIPT', 'CONNECTION', 'QRCODE'], resolvedInstanceId);
          logger.info('EvoGo:Setup', `Webhook re-confirmed at: ${webhookUrl}`);
        } catch (webhookError) {
          logger.warn('EvoGo:Setup', 'Could not re-confirm webhook, but instance is connected.', webhookError);
        }
        
        return;
      }

      if (status.Connected && !status.LoggedIn) {
        logger.warn('EvoGo:Setup', 'Instance is connected but NOT logged in.');
      } else {
        logger.warn('EvoGo:Setup', 'Instance is disconnected. Will attempt to connect...');
      }
    } catch (e: unknown) {
      if (e instanceof EvolutionApiError && e.status === 404) {
        logger.error('EvoGo:Setup', `Instance "${resolvedInstanceId}" not found.`);
        return;
      }
      logger.warn('EvoGo:Setup', `Could not check instance status: ${(e as Error).message}`);
    }

    try {
      logger.info('EvoGo:Setup', `Connecting instance with webhook: ${webhookUrl}...`);
      const connectResult = await client.connect(webhookUrl, ['MESSAGE', 'RECEIPT', 'CONNECTION', 'QRCODE'], resolvedInstanceId);
      logger.success('EvoGo:Setup', `Instance connected! Events: ${connectResult.eventString}`);
    } catch (connectError) {
      logger.error('EvoGo:Setup', 'Failed to connect instance.', connectError);
    }

  } catch (error: unknown) {
    logger.error('EvoGo:Setup', 'Unexpected error during Evolution Go setup', error);
  }
}
