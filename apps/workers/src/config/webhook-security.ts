/**
 * Webhook Security — HMAC signature validation and IP allowlist
 * for Evolution API webhook payloads.
 *
 * Prevents forged webhook payloads from external attackers.
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const WEBHOOK_ALLOWED_IPS = process.env.WEBHOOK_ALLOWED_IPS
  ? process.env.WEBHOOK_ALLOWED_IPS.split(',').map(ip => ip.trim())
  : [];

interface WebhookValidationOptions {
  /** If true, rejects requests when WEBHOOK_SECRET is not configured (production behavior) */
  requireSecret: boolean;
  /** If true, enforces IP allowlist when WEBHOOK_ALLOWED_IPS is configured */
  enforceIpAllowlist: boolean;
}

/**
 * Validates HMAC-SHA256 signature of the webhook payload.
 * The Evolution API sends the signature in the `x-webhook-signature` header.
 */
function validateHmacSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Validates the basic structure of an Evolution API webhook payload.
 */
function validatePayloadStructure(body: Record<string, unknown>): boolean {
  if (!body || typeof body !== 'object') return false;
  if (typeof body.event !== 'string') return false;
  // 'instance' and 'data' are expected for most events
  return true;
}

/**
 * Express middleware for webhook security.
 * Apply this to the /webhook/evolution route.
 */
export function webhookSecurityMiddleware(
  options: WebhookValidationOptions = { requireSecret: false, enforceIpAllowlist: true }
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const isProduction = process.env.NODE_ENV === 'production';

    // 1. IP Allowlist check
    if (options.enforceIpAllowlist && WEBHOOK_ALLOWED_IPS.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || '';
      const normalizedIp = clientIp.replace(/^::ffff:/, ''); // Strip IPv6 prefix

      if (!WEBHOOK_ALLOWED_IPS.includes(normalizedIp) && !WEBHOOK_ALLOWED_IPS.includes(clientIp)) {
        console.error(`[Webhook:Security] Blocked request from unauthorized IP: ${clientIp}`);
        res.status(403).json({ error: 'IP não autorizado' });
        return;
      }
    }

    // 2. Payload structure validation
    const body = req.body as Record<string, unknown>;
    if (!validatePayloadStructure(body)) {
      console.error('[Webhook:Security] Invalid payload structure');
      res.status(400).json({ error: 'Payload inválido' });
      return;
    }

    // 3. HMAC Signature validation
    if (WEBHOOK_SECRET) {
      const signature = req.headers['x-webhook-signature'] as string | undefined;

      if (!signature) {
        console.error('[Webhook:Security] Missing x-webhook-signature header');
        res.status(401).json({ error: 'Assinatura ausente' });
        return;
      }

      // We need the raw body for HMAC validation
      const rawBody = JSON.stringify(body);
      if (!validateHmacSignature(rawBody, signature, WEBHOOK_SECRET)) {
        console.error('[Webhook:Security] Invalid HMAC signature');
        res.status(401).json({ error: 'Assinatura inválida' });
        return;
      }
    } else if (isProduction && options.requireSecret) {
      // In production, WEBHOOK_SECRET should always be configured
      console.error('[Webhook:Security] WEBHOOK_SECRET not configured in production');
      res.status(500).json({ error: 'Configuração de segurança ausente' });
      return;
    }

    next();
  };
}
