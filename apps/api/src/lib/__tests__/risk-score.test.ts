import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../risk-score';
import { AppointmentRiskContext } from '@crmed/types';

describe('calculateRiskScore', () => {
  // Use a fixed weekday at 10 AM local time for base context
  const getPrimeDate = () => {
    const d = new Date('2026-05-14T10:00:00'); // No 'Z' = local time
    return d;
  };

  const baseContext: AppointmentRiskContext = {
    appointmentId: '1',
    scheduledAt: getPrimeDate(),
    status: 'SCHEDULED',
    patientPreviousAppointments: [],
    slaBreached: false,
    leadStatus: 'QUALIFIED',
  };

  it('should return 100 and level LOW for base context', () => {
    const result = calculateRiskScore(baseContext);
    // 100 + 10 (prime) = 110 -> capped 100
    expect(result.score).toBe(100);
    expect(result.level).toBe('LOW');
  });

  it('should return HIGH risk when multiple negative signals applied', () => {
    const outOfHoursDate = new Date(baseContext.scheduledAt);
    outOfHoursDate.setHours(22);

    const context: AppointmentRiskContext = {
      ...baseContext,
      status: 'ATTENTION_REQUIRED', // -40
      scheduledAt: outOfHoursDate, // -20 (out of hours)
    };
    const result = calculateRiskScore(context);
    // 100 - 40 - 20 = 40
    expect(result.score).toBe(40);
    expect(result.level).toBe('HIGH');
  });

  it('should cap score at 100 and return LOW', () => {
    const context: AppointmentRiskContext = {
      ...baseContext,
      status: 'CONFIRMED', // +40
      patientPreviousAppointments: [
        { status: 'COMPLETED', scheduledAt: new Date() },
        { status: 'COMPLETED', scheduledAt: new Date() }, // +50 total
      ],
    };
    const result = calculateRiskScore(context);
    expect(result.score).toBe(100);
    expect(result.level).toBe('LOW');
  });

  it('should return MEDIUM risk for unqualified lead and SLA breach', () => {
    const context: AppointmentRiskContext = {
      ...baseContext,
      leadStatus: 'NEW', // -15
      slaBreached: true, // -30
    };
    const result = calculateRiskScore(context);
    // 100 - 15 - 30 + 10 (prime time) = 65
    expect(result.score).toBe(65);
    expect(result.level).toBe('MEDIUM');
  });

  it('should cap cancellation penalty at -50', () => {
    const context: AppointmentRiskContext = {
      ...baseContext,
      patientPreviousAppointments: [
        { status: 'CANCELLED', scheduledAt: new Date() },
        { status: 'CANCELLED', scheduledAt: new Date() },
        { status: 'CANCELLED', scheduledAt: new Date() }, // 3x = -75 -> capped -50
      ],
    };
    const result = calculateRiskScore(context);
    // 100 - 50 + 10 (prime time) = 60
    expect(result.score).toBe(60);
    expect(result.level).toBe('MEDIUM');
  });

  it('should never go below 0', () => {
    const outOfHoursDate = new Date(baseContext.scheduledAt);
    outOfHoursDate.setHours(22);

    const context: AppointmentRiskContext = {
      ...baseContext,
      status: 'ATTENTION_REQUIRED', // -40
      scheduledAt: outOfHoursDate, // -20
      slaBreached: true, // -30
      leadStatus: 'NEW', // -15
      patientPreviousAppointments: [
        { status: 'CANCELLED', scheduledAt: new Date() },
        { status: 'CANCELLED', scheduledAt: new Date() }, // -50
      ],
    };
    const result = calculateRiskScore(context);
    // 100 - 40 - 20 - 30 - 15 - 50 = -55 -> capped 0
    expect(result.score).toBe(0);
    expect(result.level).toBe('HIGH');
  });

  it('should return all signals with correct applied status', () => {
    const result = calculateRiskScore(baseContext);
    expect(result.signals.length).toBeGreaterThan(5);
    const primeTimeSignal = result.signals.find(s => s.key === 'PRIME_TIME_SLOT');
    expect(primeTimeSignal?.applied).toBe(true);
    const slaSignal = result.signals.find(s => s.key === 'SLA_BREACHED');
    expect(slaSignal?.applied).toBe(false);
  });
});
