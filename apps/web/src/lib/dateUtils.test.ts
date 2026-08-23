import { describe, it, expect } from 'vitest';
import { buildExplicitScheduledAt } from './dateUtils';

describe('dateUtils', () => {
  it('buildExplicitScheduledAt appends -03:00 to prevent ambiguous parsing', () => {
    const result = buildExplicitScheduledAt('2026-08-23', '14:30');
    expect(result).toBe('2026-08-23T14:30:00-03:00');
    // Ensure it complies with the explicit timezone contract (ends with offset)
    expect(result).toMatch(/[-+]\d{2}:\d{2}$/);
  });
});
