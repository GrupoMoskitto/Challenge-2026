import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../config/logger';

export const RISK_SCORE_QUEUE_NAME = 'recalculate-risk-score';

export const riskScoreQueue = new Queue(RISK_SCORE_QUEUE_NAME, {
  connection: redisConnection as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

interface RiskScoreJobData {
  appointmentId: string;
}

export const riskScoreWorker = new Worker<RiskScoreJobData>(
  RISK_SCORE_QUEUE_NAME,
  async (job: Job<RiskScoreJobData>) => {
    const { appointmentId } = job.data;
    logger.info('RiskScoreWorker', `Recalculating risk score for appointment ${appointmentId}`);

    const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001/graphql';
    const API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key';

    const query = `
      mutation RecalculateRiskScore($appointmentId: ID!) {
        recalculateRiskScore(appointmentId: $appointmentId) {
          id
          riskScore
          riskLevel
        }
      }
    `;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': API_KEY, // We need to handle this in API
        },
        body: JSON.stringify({
          query,
          variables: { appointmentId },
        }),
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const result = await response.json() as any;
      if (result.errors) {
        throw new Error(`GraphQL Errors: ${JSON.stringify(result.errors)}`);
      }

      logger.success('RiskScoreWorker', `Risk score updated for ${appointmentId}: ${result.data.recalculateRiskScore.riskScore}`);
      return { success: true };
    } catch (error: any) {
      logger.error('RiskScoreWorker', `Failed to recalculate risk score for ${appointmentId}`, error.message);
      throw error;
    }
  },
  {
    connection: redisConnection as ConnectionOptions,
    concurrency: 2,
  }
);
