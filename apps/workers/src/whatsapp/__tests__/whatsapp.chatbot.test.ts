import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsappChatbot } from '../whatsapp.chatbot';
import { redisConnection } from '../../config/redis';

vi.mock('../../config/redis', () => ({
  redisConnection: {
    set: vi.fn(),
  }
}));

describe('WhatsappChatbot deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(WhatsappChatbot as any, 'processIncoming').mockResolvedValue(undefined);
  });

  it('processes the first message', async () => {
    (redisConnection.set as any).mockResolvedValue('OK');

    await WhatsappChatbot.handleRawMessage('instance1', '5511999999999@s.whatsapp.net', 'Test', 'Hello');

    expect(redisConnection.set).toHaveBeenCalled();
    expect((WhatsappChatbot as any).processIncoming).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate messages (when lock is null)', async () => {
    (redisConnection.set as any).mockResolvedValue(null); // Simulated failure to acquire lock

    await WhatsappChatbot.handleRawMessage('instance1', '5511999999999@s.whatsapp.net', 'Test', 'Hello');

    expect(redisConnection.set).toHaveBeenCalled();
    expect((WhatsappChatbot as any).processIncoming).not.toHaveBeenCalled();
  });
});
