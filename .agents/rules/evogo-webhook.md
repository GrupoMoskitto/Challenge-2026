---
description: Rules for handling Evolution Go Webhooks and State Machine.
trigger: model_decision
---

# EvoGo Webhook Handling & State Machine

**Core Directive:** 
Always unwrap the `{ data, message }` envelope from Evolution Go. For webhook events, enforce an in-memory **10-second deduplication lock** based on `messageId` to avoid double-processing. Integrate a State Machine pattern to manage the patient conversation flow (`NEW_ASK_NAME`, `VERIFY_DOB_CHALLENGE`, `APPOINTMENT_LIST`).

**Explicit Anti-Patterns:**
- **NEVER** use `any` when handling the unwrapped EvoGo payload. 
- **NEVER** skip the deduplication check; WhatsApp Webhooks can burst the exact same message payload on network retries.
- **NEVER** transition a patient to `APPOINTMENT_LIST` without first ensuring they have passed the `VERIFY_DOB_CHALLENGE` (LGPD RN07).

**TypeScript Template:**
```typescript
import { Request, Response } from 'express';
import { logger } from '@/utils/logger';

// In-memory Deduplication (10s lock) - Note: Upgrade to Redis if running multi-pod
const webhookLocks = new Set<string>();

export const handleEvoGoWebhook = async (req: Request, res: Response) => {
  const messageId = req.body?.data?.message?.id;
  
  if (!messageId) {
    return res.status(400).json({ error: 'Missing message ID' });
  }

  // Deduplication check
  if (webhookLocks.has(messageId)) {
    logger.info('EvoGo Webhook', 'Ignored duplicate message', { messageId });
    return res.status(200).send('OK');
  }

  webhookLocks.add(messageId);
  setTimeout(() => webhookLocks.delete(messageId), 10000);

  try {
    const payload = req.body.data;
    const currentState = payload.message?.currentState || 'UNKNOWN';

    // State Machine Transitions
    switch (currentState) {
      case 'NEW_ASK_NAME':
        // Trigger lead capture logic
        break;
      case 'VERIFY_DOB_CHALLENGE':
        // Enforce RN07 (LGPD) verification logic
        break;
      case 'APPOINTMENT_LIST':
        // Retrieve and list appointments
        break;
      default:
        logger.warn('EvoGo Webhook', `Unhandled state: ${currentState}`);
    }

    return res.status(200).send('OK');
  } catch (error: unknown) {
    logger.error('EvoGo Webhook', 'Processing error', error);
    // Always return 2xx or 500 to the webhook provider; never crash the app
    return res.status(500).send('Internal Server Error');
  }
};
```
