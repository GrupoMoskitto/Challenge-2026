import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvers, Context } from './index';
import { prisma } from '@crmed/database';
import { LeadStatus } from '@prisma/client';

describe('RN06 - Audit Logs (updateLeadStatus)', () => {
  let findUniqueSpy: any;
  let updateSpy: any;
  let createAuditLogSpy: any;

  beforeEach(() => {
    findUniqueSpy = vi.spyOn(prisma.lead, 'findUnique');
    updateSpy = vi.spyOn(prisma.lead, 'update');
    createAuditLogSpy = vi.spyOn(prisma.auditLog, 'create');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw an error if the lead is not found', async () => {
    findUniqueSpy.mockResolvedValue(null);

    const input = { id: 'invalid-id', status: LeadStatus.CONTACTED };
    const context: Context = { user: { userId: 'admin', email: 'a@a.com', role: 'ADMIN' } };

    await expect(
      resolvers.Mutation.updateLeadStatus(null, { input }, context)
    ).rejects.toThrow('Lead não encontrado');

    expect(createAuditLogSpy).not.toHaveBeenCalled();
  });

  it('should update the lead status and create an audit log if user context exists', async () => {
    const mockLead = { id: 'lead-123', status: LeadStatus.NEW };
    findUniqueSpy.mockResolvedValue(mockLead as any);
    updateSpy.mockResolvedValue({ ...mockLead, status: LeadStatus.CONTACTED } as any);
    createAuditLogSpy.mockResolvedValue({ id: 'audit-1' } as any);

    const input = { id: 'lead-123', status: LeadStatus.CONTACTED, reason: 'Test reason' };
    const context: Context = { user: { userId: 'user-789', email: 'test@crmed.com', role: 'CALL_CENTER' } };

    const result = await resolvers.Mutation.updateLeadStatus(null, { input }, context);

    expect(result.status).toBe(LeadStatus.CONTACTED);

    expect(createAuditLogSpy).toHaveBeenCalledWith({
      data: {
        entityType: 'Lead',
        entityId: 'lead-123',
        action: 'STATUS_CHANGE',
        oldValue: LeadStatus.NEW,
        newValue: LeadStatus.CONTACTED,
        reason: 'Test reason',
        userId: 'user-789',
      },
    });
  });

  it('should throw an authentication error if user context is missing', async () => {
    const input = { id: 'lead-123', status: LeadStatus.CONTACTED };
    const context: Context = {};

    await expect(
      resolvers.Mutation.updateLeadStatus(null, { input }, context)
    ).rejects.toThrow('Usuário não autenticado');

    expect(updateSpy).not.toHaveBeenCalled();
    expect(createAuditLogSpy).not.toHaveBeenCalled();
  });
});

describe('RN01 + RN06 - Patient Mutations', () => {
  let leadFindUniqueSpy: any;
  let patientFindUniqueSpy: any;
  let patientCreateSpy: any;
  let patientUpdateSpy: any;
  let auditLogCreateSpy: any;

  beforeEach(() => {
    leadFindUniqueSpy = vi.spyOn(prisma.lead, 'findUnique');
    patientFindUniqueSpy = vi.spyOn(prisma.patient, 'findUnique');
    patientCreateSpy = vi.spyOn(prisma.patient, 'create');
    patientUpdateSpy = vi.spyOn(prisma.patient, 'update');
    auditLogCreateSpy = vi.spyOn(prisma.auditLog, 'create');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createPatient', () => {
    it('should create patient and audit log (RN06)', async () => {
      const mockLead = { id: 'lead-123', name: 'João Silva', cpf: '12345678900', email: 'joao@teste.com', phone: '11999999999' };
      const mockPatient = { 
        id: 'patient-123', 
        leadId: 'lead-123', 
        dateOfBirth: new Date('1990-01-15'), 
        medicalRecord: 'PR-001',
        address: 'Rua Teste',
        lead: mockLead
      };

      leadFindUniqueSpy.mockResolvedValue(mockLead);
      vi.spyOn(prisma.lead, 'findFirst').mockResolvedValue(null);
      patientFindUniqueSpy.mockResolvedValue(null);
      patientCreateSpy.mockResolvedValue(mockPatient);
      auditLogCreateSpy.mockResolvedValue({ id: 'audit-1' });

      const input = { 
        leadId: Buffer.from('lead-123').toString('base64url'), 
        dateOfBirth: '1990-01-15', 
        medicalRecord: 'PR-001',
        address: 'Rua Teste'
      };
      const context: Context = { user: { userId: 'user-789', email: 'test@crmed.com', role: 'ADMIN' } };

      const result = await resolvers.Mutation.createPatient(null, { input }, context);

      expect(result.id).toBe('patient-123');
      expect(auditLogCreateSpy).toHaveBeenCalledWith({
        data: {
          entityType: 'Patient',
          entityId: 'patient-123',
          action: 'CREATED',
          newValue: expect.objectContaining({
            medicalRecord: 'PR-001',
            address: 'Rua Teste',
            dateOfBirth: expect.any(String),
          }),
          reason: 'Paciente criado a partir de lead',
          userId: 'user-789',
        },
      });
    });

    it('should throw error if lead not found (RN01)', async () => {
      leadFindUniqueSpy.mockResolvedValue(null);

      const input = { 
        leadId: Buffer.from('invalid-lead').toString('base64url'), 
        dateOfBirth: '1990-01-15'
      };
      const context: Context = { user: { userId: 'user-789', email: 'test@crmed.com', role: 'ADMIN' } };

      await expect(
        resolvers.Mutation.createPatient(null, { input }, context)
      ).rejects.toThrow('Lead não encontrado');
    });

    it('should throw error if medicalRecord already exists (RN01)', async () => {
      const mockLead = { id: 'lead-123', name: 'João Silva', cpf: '12345678900', email: 'joao@teste.com', phone: '11999999999' };
      const existingPatient = { id: 'existing-patient', medicalRecord: 'PR-001' };

      leadFindUniqueSpy.mockResolvedValue(mockLead);
      vi.spyOn(prisma.lead, 'findFirst').mockResolvedValue(null);
      patientFindUniqueSpy.mockResolvedValue(existingPatient);

      const input = { 
        leadId: Buffer.from('lead-123').toString('base64url'), 
        dateOfBirth: '1990-01-15',
        medicalRecord: 'PR-001'
      };
      const context: Context = { user: { userId: 'user-789', email: 'test@crmed.com', role: 'ADMIN' } };

      await expect(
        resolvers.Mutation.createPatient(null, { input }, context)
      ).rejects.toThrow('RN01_VIOLATION: Prontuário já cadastrado');
    });
  });

  describe('updatePatient', () => {
    it('should update patient and create audit log (RN06)', async () => {
      const currentPatient = { 
        id: 'patient-123', 
        leadId: 'lead-123', 
        dateOfBirth: new Date('1990-01-15'), 
        medicalRecord: 'PR-001',
        address: 'Rua Velha'
      };
      const updatedPatient = { 
        ...currentPatient, 
        dateOfBirth: new Date('1991-05-20'),
        address: 'Rua Nova'
      };

      patientFindUniqueSpy.mockResolvedValue(currentPatient);
      patientUpdateSpy.mockResolvedValue(updatedPatient);
      auditLogCreateSpy.mockResolvedValue({ id: 'audit-2' });

      const input = { 
        id: Buffer.from('patient-123').toString('base64url'),
        dateOfBirth: '1991-05-20',
        address: 'Rua Nova',
        reason: 'Correção de endereço'
      };
      const context: Context = { user: { userId: 'user-789', email: 'test@crmed.com', role: 'ADMIN' } };

      const result = await resolvers.Mutation.updatePatient(null, { input }, context);

      expect(result.address).toBe('Rua Nova');
      expect(auditLogCreateSpy).toHaveBeenCalledWith({
        data: {
          entityType: 'Patient',
          entityId: 'patient-123',
          action: 'UPDATED',
          oldValue: expect.objectContaining({
            address: 'Rua Velha',
            dateOfBirth: expect.any(Date),
            medicalRecord: 'PR-001',
          }),
          newValue: expect.objectContaining({
            address: expect.objectContaining({ to: 'Rua Nova' }),
            dateOfBirth: expect.objectContaining({ to: expect.any(Date) }),
          }),
          reason: 'Correção de endereço',
          userId: 'user-789',
        },
      });
    });

    it('should throw error if patient not found', async () => {
      patientFindUniqueSpy.mockResolvedValue(null);

      const input = { 
        id: Buffer.from('invalid-patient').toString('base64url'),
        address: 'Novo endereço'
      };
      const context: Context = { user: { userId: 'user-789', email: 'test@crmed.com', role: 'ADMIN' } };

      await expect(
        resolvers.Mutation.updatePatient(null, { input }, context)
      ).rejects.toThrow('Paciente não encontrado');
    });

    it('should throw error if medicalRecord already belongs to another patient (RN01)', async () => {
      const currentPatient = { id: 'patient-123', medicalRecord: null };
      const existingPatient = { id: 'other-patient', medicalRecord: 'PR-001' };

      patientFindUniqueSpy.mockResolvedValueOnce(currentPatient);
      patientFindUniqueSpy.mockResolvedValueOnce(existingPatient);

      const input = { 
        id: Buffer.from('patient-123').toString('base64url'),
        medicalRecord: 'PR-001'
      };
      const context: Context = { user: { userId: 'user-789', email: 'test@crmed.com', role: 'ADMIN' } };

      await expect(
        resolvers.Mutation.updatePatient(null, { input }, context)
      ).rejects.toThrow('RN01_VIOLATION: Prontuário já cadastrado por outro paciente');
    });
  });
});

describe('patients query - Pagination', () => {
  let patientFindManySpy: any;
  let patientCountSpy: any;

  beforeEach(() => {
    patientFindManySpy = vi.spyOn(prisma.patient, 'findMany');
    patientCountSpy = vi.spyOn(prisma.patient, 'count');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return paginated patients with pageInfo', async () => {
    const mockPatients = [
      { id: 'p1', lead: { name: 'Paciente 1' } },
      { id: 'p2', lead: { name: 'Paciente 2' } },
    ];

    patientFindManySpy.mockResolvedValue(mockPatients);
    patientCountSpy.mockResolvedValue(10);

    const context: Context = { user: { userId: 'test-user', email: 'test@crmed.com', role: 'ADMIN' } };
    const result = await resolvers.Query.patients(null, { first: 2 }, context);

    expect(result.edges).toHaveLength(2);
    expect(result.pageInfo.hasNextPage).toBe(false);
    expect(result.pageInfo.hasPreviousPage).toBe(false);
    expect(result.totalCount).toBe(10);
    expect(result.edges[0].cursor).toBeDefined();
  });

  it('should filter patients by status', async () => {
    const mockPatients = [
      { id: 'p1', lead: { name: 'Paciente Convertido', status: LeadStatus.CONVERTED } },
    ];

    patientFindManySpy.mockResolvedValue(mockPatients);
    patientCountSpy.mockResolvedValue(1);

    const context: Context = { user: { userId: 'test-user', email: 'test@crmed.com', role: 'ADMIN' } };
    await resolvers.Query.patients(null, { 
      first: 10, 
      where: { status: LeadStatus.CONVERTED } 
    }, context);

    expect(patientFindManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lead: expect.objectContaining({
            status: LeadStatus.CONVERTED
          })
        })
      })
    );
  });

  it('should filter patients by search term', async () => {
    const mockPatients = [
      { id: 'p1', lead: { name: 'João Silva' } },
    ];

    patientFindManySpy.mockResolvedValue(mockPatients);
    patientCountSpy.mockResolvedValue(1);

    const context: Context = { user: { userId: 'test-user', email: 'test@crmed.com', role: 'ADMIN' } };
    await resolvers.Query.patients(null, { 
      first: 10, 
      where: { search: 'João' } 
    }, context);

    expect(patientFindManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ lead: expect.objectContaining({ name: expect.anything() }) })
          ])
        })
      })
    );
  });
});
