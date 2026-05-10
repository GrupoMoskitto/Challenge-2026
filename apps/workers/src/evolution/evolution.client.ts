import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../config/logger';
import {
  EvoGoResponse,
  EvoGoInstanceData,
  EvoGoStatusData,
  EvoGoConnectData,
  EvoGoConnectPayload,
  EvoGoCreateInstancePayload,
  EvoGoSendTextPayload,
  EvoGoSendTextResponseData,
} from './evolution.types';


export class EvolutionApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'EvolutionApiError';
  }
}

/**
 * Typed HTTP client for Evolution Go API.
 */
export class EvoGoClient {
  private api: AxiosInstance;
  private instanceToken?: string;

  constructor(
    private readonly baseUrl: string,
    private globalApiKey: string,
    private instanceId?: string
  ) {
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use(config => {
      const effectiveGlobalKey = this.globalApiKey || process.env.EVOLUTION_API_KEY || '';
      const effectiveInstanceId = this.instanceId || process.env.EVOLUTION_INSTANCE_ID || '';
      
      if (!config.baseURL && process.env.EVOLUTION_API_URL) {
        config.baseURL = process.env.EVOLUTION_API_URL;
      }

      const isGlobal = config.url?.startsWith('/instance/all') || config.url?.startsWith('/instance/create');
      config.headers['apikey'] = isGlobal ? effectiveGlobalKey : (this.instanceToken || effectiveGlobalKey);

      if (effectiveInstanceId) {
        config.headers['instanceId'] = effectiveInstanceId;
      }

      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status || 500;
        const responseData = error.response?.data as Record<string, unknown> | undefined;
        const message = (responseData?.message as string) || error.message;

        throw new EvolutionApiError(status, message, responseData);
      }
    );
  }

  public setInstanceToken(token: string) {
    this.instanceToken = token;
  }

  private unwrap<T>(response: { data: EvoGoResponse<T> }): T {
    const body = response.data;
    if (body && typeof body === 'object' && 'data' in body) {
      return body.data;
    }
    return body as unknown as T;
  }

  private instanceHeaders(instanceId?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const id = instanceId || this.instanceId;
    if (id) {
      headers['instanceId'] = id;
    }
    return headers;
  }

  /**
   * List all instances
   */
  async listInstances(): Promise<EvoGoInstanceData[]> {
    try {
      const response = await this.api.get<EvoGoResponse<EvoGoInstanceData[]>>('/instance/all');
      return this.unwrap(response);
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        logger.error('EvoGo', 'Failed to list instances', error.details);
      }
      throw error;
    }
  }

  /**
   * Create a new instance
   */
  async createInstance(payload: EvoGoCreateInstancePayload): Promise<EvoGoInstanceData> {
    try {
      logger.info('EvoGo', `Creating instance "${payload.name}"...`);
      const response = await this.api.post<EvoGoResponse<EvoGoInstanceData>>(
        '/instance/create',
        payload
      );
      return this.unwrap(response);
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        logger.error('EvoGo', `Failed to create instance "${payload.name}"`, error.details);
      }
      throw error;
    }
  }

  /**
   * Delete an instance
   */
  async deleteInstance(instanceId: string): Promise<void> {
    try {
      logger.info('EvoGo', `Deleting instance ${instanceId}...`);
      await this.api.delete(`/instance/delete/${instanceId}`);
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        logger.error('EvoGo', `Failed to delete instance ${instanceId}`, error.details);
      }
      throw error;
    }
  }

  /**
   * Get instance connection status
   */
  async getStatus(instanceId?: string): Promise<EvoGoStatusData> {
    try {
      const response = await this.api.get<EvoGoResponse<EvoGoStatusData>>(
        '/instance/status',
        { headers: this.instanceHeaders(instanceId) }
      );
      return this.unwrap(response);
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        logger.error('EvoGo', 'Failed to get instance status', error.details);
      }
      throw error;
    }
  }

  /**
   * Connect instance and configure webhook
   * Note: This is the ONLY way to set up webhooks in EvoGo
   */
  async connect(
    webhookUrl: string,
    events: string[] = ['ALL'],
    instanceId?: string
  ): Promise<EvoGoConnectData> {
    const payload: EvoGoConnectPayload = {
      webhookUrl,
      subscribe: events,
      immediate: true,
    };

    try {
      logger.info('EvoGo', `Connecting instance with webhook: ${webhookUrl}`);
      const response = await this.api.post<EvoGoResponse<EvoGoConnectData>>(
        '/instance/connect',
        payload,
        { headers: this.instanceHeaders(instanceId) }
      );
      return this.unwrap(response);
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        logger.error('EvoGo', 'Failed to connect instance', error.details);
      }
      throw error;
    }
  }

  /**
   * Get QR code for instance
   */
  async getQrCode(instanceId?: string): Promise<{ qrcode: string; code: string }> {
    try {
      const response = await this.api.get<EvoGoResponse<{ qrcode: string; code: string }>>(
        '/instance/qr',
        { headers: this.instanceHeaders(instanceId) }
      );
      return this.unwrap(response);
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        logger.error('EvoGo', 'Failed to get QR code', error.details);
      }
      throw error;
    }
  }

  /**
   * Disconnect instance
   */
  async disconnect(instanceId?: string): Promise<void> {
    try {
      logger.info('EvoGo', 'Disconnecting instance...');
      await this.api.post(
        '/instance/disconnect',
        {},
        { headers: this.instanceHeaders(instanceId) }
      );
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        logger.error('EvoGo', 'Failed to disconnect instance', error.details);
      }
      throw error;
    }
  }

  /**
   * Send a text message
   */
  async sendText(
    number: string,
    text: string,
    delay?: number,
    instanceId?: string
  ): Promise<EvoGoSendTextResponseData> {
    const payload: EvoGoSendTextPayload = { number, text };
    if (delay !== undefined) {
      payload.delay = delay;
    }

    try {
      logger.debug('EvoGo', `Sending text to ${number}`);
      const response = await this.api.post<EvoGoResponse<EvoGoSendTextResponseData>>(
        '/send/text',
        payload,
        { headers: this.instanceHeaders(instanceId) }
      );
      return this.unwrap(response);
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        logger.error('EvoGo', `Failed to send text to ${number}`, error.details);
      }
      throw error;
    }
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.api.get('/server/ok');
      return true;
    } catch (e: any) {
      if (e.response && e.response.status === 404) {
        // If it responds with 404, it means the server is reachable at least
        return true;
      }
      return false;
    }
  }
}


const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID || '';

export const evoGoClient = new EvoGoClient(
  EVOLUTION_API_URL,
  EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE_ID
);

