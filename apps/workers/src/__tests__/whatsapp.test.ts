import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { processDailyAppointments } from '../jobs/dailyCron';
import { WhatsappSender } from '../whatsapp/whatsapp.sender';
import { whatsappQueue } from '../queues/whatsapp.processor';
import { riskScoreQueue } from '../queues/risk-score.processor';
import { prisma } from '@crmed/database';

vi.mock('../whatsapp/whatsapp.sender', () => ({
  WhatsappSender: {
    sendMessage: vi.fn().mockResolvedValue({ delivered: true }),
  }
}));

vi.mock('../queues/whatsapp.processor', () => ({
  whatsappQueue: {
    add: vi.fn(),
  }
}));

vi.mock('../queues/risk-score.processor', () => ({
  riskScoreQueue: {
    add: vi.fn(),
  },
  riskScoreWorker: {}
}));

describe('RN05 - WhatsApp Notifications', () => {
  let findManyAppointmentsSpy: MockInstance;
  let findManyTemplatesSpy: MockInstance;
  let findFirstAuditSpy: MockInstance;

  beforeEach(() => {
    findManyAppointmentsSpy = vi.spyOn(prisma.appointment, 'findMany');
    findManyTemplatesSpy = vi.spyOn(prisma.messageTemplate, 'findMany');
    findFirstAuditSpy = vi.spyOn(prisma.auditLog, 'findFirst');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should schedule jobs for 4d, 2d, 1d and 0d based on templates', async () => {
    // Mock templates for 4d, 2d, 1d and 0d
    findManyTemplatesSpy.mockResolvedValue([
      { id: 't1', triggerDays: 4, content: '4 dias' },
      { id: 't2', triggerDays: 2, content: '2 dias' },
      { id: 't3', triggerDays: 1, content: '1 dia' },
      { id: 't4', triggerDays: 0, content: 'Hoje' },
    ]);

    // Mock appointments: one is 4 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);

    findManyAppointmentsSpy.mockResolvedValue([
      {
        id: 'apt-1',
        scheduledAt: futureDate,
        status: 'SCHEDULED',
        procedure: 'Consulta',
        patient: { 
          id: 'p-1',
          lead: { id: 'lead-1', name: 'Teste 1', phone: '11999999999' }
        },
        surgeon: { name: 'Dr. Teste' }
      }
    ]);

    // Mock that we haven't sent it yet
    findFirstAuditSpy.mockResolvedValue(null);

    await processDailyAppointments();

    expect(whatsappQueue.add).toHaveBeenCalledWith(
      'send-reminder',
      expect.objectContaining({
        appointmentId: 'apt-1',
        triggerDays: 4,
        message: '4 dias'
      }),
      expect.any(Object)
    );
  });

  it('should not schedule if audit log shows already sent', async () => {
    findManyTemplatesSpy.mockResolvedValue([{ id: 't1', triggerDays: 4, content: '4 dias' }]);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 4);

    findManyAppointmentsSpy.mockResolvedValue([
      {
        id: 'apt-1',
        scheduledAt: futureDate,
        patient: { 
          id: 'p-1',
          lead: { id: 'lead-1', name: 'Teste', phone: '11999999999' }
        },
      }
    ]);

    // Mock that it was ALREADY SENT
    findFirstAuditSpy.mockResolvedValue({ id: 'audit-1' });

    await processDailyAppointments();

    expect(whatsappQueue.add).not.toHaveBeenCalled();
  });
});
