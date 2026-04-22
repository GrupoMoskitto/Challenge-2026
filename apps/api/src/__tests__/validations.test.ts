import { describe, it, expect, beforeEach } from 'vitest';
import { resolvers, Context } from '../graphql/resolvers/index';
import { checkRateLimit, resetRateLimit } from '../auth';

describe('CRMed Validation Tests', () => {
  beforeEach(() => {
    resetRateLimit('test-ip');
  });

  describe('Rate Limiting', () => {
    it('should allow first 5 attempts', () => {
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit('rate-test')).toBe(true);
      }
    });

    it('should block after 5 attempts', () => {
      for (let i = 0; i < 5; i++) checkRateLimit('rate-test-2');
      expect(checkRateLimit('rate-test-2')).toBe(false);
    });

    it('should track IPs independently', () => {
      for (let i = 0; i < 5; i++) checkRateLimit('ip-a');
      expect(checkRateLimit('ip-a')).toBe(false);
      expect(checkRateLimit('ip-b')).toBe(true);
    });
  });

  describe('Authentication Required - Queries', () => {
    it('leads query requires auth', async () => {
      await expect(resolvers.Query.leads(null, {}, {} as Context))
        .rejects.toThrow('Usuário não autenticado');
    });

    it('patients query requires auth', async () => {
      await expect(resolvers.Query.patients(null, {}, {} as Context))
        .rejects.toThrow('Usuário não autenticado');
    });

    it('appointments query requires auth', async () => {
      await expect(resolvers.Query.appointments(null, {}, {} as Context))
        .rejects.toThrow('Usuário não autenticado');
    });

    it('surgeons query requires auth', async () => {
      await expect(resolvers.Query.surgeons(null, {}, {} as Context))
        .rejects.toThrow('Usuário não autenticado');
    });

    it('messageTemplates requires auth', async () => {
      await expect(resolvers.Query.messageTemplates(null, {}, {} as Context))
        .rejects.toThrow('Usuário não autenticado');
    });

    it('leadByCpf requires auth', async () => {
      await expect(resolvers.Query.leadByCpf(null, { cpf: '123' }, {} as Context))
        .rejects.toThrow('Usuário não autenticado');
    });
  });

  describe('ADMIN Only Access', () => {
    it('users query blocked for RECEPTION', async () => {
      const ctx = { user: { userId: '1', email: 'rec@test.com', role: 'RECEPTION' } } as Context;
      await expect(resolvers.Query.users(null, { first: 10 }, ctx))
        .rejects.toThrow('Acesso restrito a administradores');
    });

    it('users query blocked for SURGEON', async () => {
      const ctx = { user: { userId: '1', email: 'surgeon@test.com', role: 'SURGEON' } } as Context;
      await expect(resolvers.Query.users(null, { first: 10 }, ctx))
        .rejects.toThrow('Acesso restrito a administradores');
    });

    it('auditLogs blocked for non-admin', async () => {
      const ctx = { user: { userId: '1', email: 'cc@test.com', role: 'CALL_CENTER' } } as Context;
      await expect(resolvers.Query.auditLogs(null, {}, ctx))
        .rejects.toThrow('Acesso restrito a administradores');
    });
  });

  describe('RN03 - Role Restrictions', () => {
    // These tests require database mocking - covered by role-permissions.test.ts
    it('RECEPTION cannot delete lead', async () => {
      const ctx = { user: { userId: '1', email: 'rec@test.com', role: 'RECEPTION' } } as Context;
      await expect(resolvers.Mutation.deleteLead(null, { id: 'lead-1' }, ctx))
        .rejects.toThrow('RN03_VIOLATION');
    });
  });

  describe('Mutation Auth Required', () => {
    it('createAppointment requires auth', async () => {
      await expect(resolvers.Mutation.createAppointment(null, {
        input: { patientId: 'p1', surgeonId: 's1', procedure: 'Test', scheduledAt: '2026-04-01T10:00Z' }
      }, {} as Context)).rejects.toThrow('Usuário não autenticado');
    });

    it('createPatient requires auth', async () => {
      await expect(resolvers.Mutation.createPatient(null, {
        input: { leadId: 'l1', dateOfBirth: '1990-01-01' }
      }, {} as Context)).rejects.toThrow('Usuário não autenticado');
    });

    it('createUser requires ADMIN', async () => {
      const ctx = { user: { userId: '1', email: 'cc@test.com', role: 'CALL_CENTER' } } as Context;
      await expect(resolvers.Mutation.createUser(null, {
        input: { email: 'new@test.com', name: 'New', role: 'CALL_CENTER', password: '123' }
      }, ctx)).rejects.toThrow('Acesso restrito a administradores');
    });

    it('deleteAppointment requires auth', async () => {
      await expect(resolvers.Mutation.deleteAppointment(null, {
        input: { id: 'apt-1', confirmed: true }
      }, {} as Context)).rejects.toThrow('Usuário não autenticado');
    });

    it('createMessageTemplate requires ADMIN', async () => {
      const ctx = { user: { userId: '1', email: 'cc@test.com', role: 'CALL_CENTER' } } as Context;
      await expect(resolvers.Mutation.createMessageTemplate(null, {
        input: { name: 'Test', channel: 'WHATSAPP', content: 'Hello' }
      }, ctx)).rejects.toThrow('Acesso restrito a administradores');
    });
  });
});