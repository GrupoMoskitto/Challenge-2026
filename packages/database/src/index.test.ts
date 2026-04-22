import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkUniqueness, prisma } from './index';

describe('RN01 - Zero Duplication (checkUniqueness)', () => {
  let findFirstSpy: any;

  beforeEach(() => {
    // We spy on the actual prisma instance exported from index
    findFirstSpy = vi.spyOn(prisma.lead, 'findFirst');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should pass if no existing lead has the same CPF, email, or phone', async () => {
    findFirstSpy.mockResolvedValue(null);

    const result = await checkUniqueness({
      cpf: '123.456.789-00',
      email: 'test@example.com',
      phone: '(11) 99999-9999',
    });

    expect(result).toBe(true);
    expect(findFirstSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if a lead with the same CPF exists', async () => {
    findFirstSpy.mockResolvedValue({
      id: 'existing-id',
      cpf: '123.456.789-00',
      email: 'other@example.com',
      phone: '(11) 88888-8888',
      name: 'Test',
      source: 'web',
      status: 'NEW',
    } as any);

    await expect(
      checkUniqueness({ cpf: '123.456.789-00' })
    ).rejects.toThrow('RN01_VIOLATION: CPF já cadastrado');
  });

  it('should throw an error if a lead with the same email exists', async () => {
    findFirstSpy.mockResolvedValue({
      id: 'existing-id',
      cpf: '111.111.111-11',
      email: 'test@example.com',
      phone: '(11) 88888-8888',
      name: 'Test',
      status: 'NEW',
    } as any);

    await expect(
      checkUniqueness({ email: 'test@example.com' })
    ).rejects.toThrow('RN01_VIOLATION: e-mail já cadastrado');
  });

  it('should allow skipping duplicate check for same lead (update scenario)', async () => {
    findFirstSpy.mockResolvedValue(null);

    const result = await checkUniqueness({
      cpf: '123.456.789-00',
      excludeId: 'my-own-id'
    });

    expect(result).toBe(true);
    
    // Check if the query included the NOT condition
    const callArgs = findFirstSpy.mock.calls[0][0] as any;
    expect(callArgs.where.AND[1]).toEqual({ id: { not: 'my-own-id' } });
  });
});
