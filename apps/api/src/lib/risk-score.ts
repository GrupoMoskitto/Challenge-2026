import { RiskLevel, RiskSignal, AppointmentRiskContext } from '@crmed/types';
import { differenceInDays, getHours, getDay } from 'date-fns';

export function calculateRiskScore(context: AppointmentRiskContext): {
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
} {
  let score = 100;
  const signals: RiskSignal[] = [];

  // NEGATIVOS
  
  // 1. Não respondeu confirmação de 48h (status ATTENTION_REQUIRED)
  const noResponse48h = context.status === 'ATTENTION_REQUIRED';
  if (noResponse48h) {
    score -= 40;
  }
  signals.push({ key: 'NO_RESPONSE_48H', delta: -40, applied: noResponse48h });

  // 2. Agendamento fora do horário de expediente (após 18h ou antes de 8h)
  const hour = getHours(context.scheduledAt);
  const outOfHours = hour < 8 || hour >= 18;
  if (outOfHours) {
    score -= 20;
  }
  signals.push({ key: 'OUT_OF_BUSINESS_HOURS', delta: -20, applied: outOfHours });

  // 3. Paciente cancelou ao menos 1 agendamento anterior (-25 por cancelamento, max -50)
  const cancellations = context.patientPreviousAppointments.filter(a => a.status === 'CANCELLED').length;
  const cancellationPenalty = Math.min(cancellations * 25, 50);
  if (cancellationPenalty > 0) {
    score -= cancellationPenalty;
  }
  signals.push({ key: 'PREVIOUS_CANCELLATIONS', delta: -cancellationPenalty, applied: cancellations > 0 });

  // 4. SLA de 24h úteis estourado
  if (context.slaBreached) {
    score -= 30;
  }
  signals.push({ key: 'SLA_BREACHED', delta: -30, applied: context.slaBreached });

  // 5. Lead não qualificado (status NEW ou CONTACTED)
  const unmappedLead = context.leadStatus === 'NEW' || context.leadStatus === 'CONTACTED';
  if (unmappedLead) {
    score -= 15;
  }
  signals.push({ key: 'UNQUALIFIED_LEAD', delta: -15, applied: unmappedLead });

  // POSITIVOS

  // 1. Respondeu e confirmou via chatbot (status CONFIRMED)
  const isConfirmed = context.status === 'CONFIRMED';
  if (isConfirmed) {
    score += 40;
  }
  signals.push({ key: 'CONFIRMED_VIA_CHATBOT', delta: 40, applied: isConfirmed });

  // 2. Compareceu em ao menos 1 agendamento anterior (status COMPLETED) (+25 por ocorrência, max +50)
  const completions = context.patientPreviousAppointments.filter(a => a.status === 'COMPLETED').length;
  const completionBonus = Math.min(completions * 25, 50);
  if (completionBonus > 0) {
    score += completionBonus;
  }
  signals.push({ key: 'PREVIOUS_COMPLETIONS', delta: completionBonus, applied: completions > 0 });

  // 3. Lead convertido (status CONVERTED)
  const isConverted = context.leadStatus === 'CONVERTED';
  if (isConverted) {
    score += 15;
  }
  signals.push({ key: 'CONVERTED_LEAD', delta: 15, applied: isConverted });

  // 4. Agendamento em horário prime (09h-17h, seg-sex)
  const day = getDay(context.scheduledAt); // 0 = Sunday, 6 = Saturday
  const isPrimeTime = day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  if (isPrimeTime) {
    score += 10;
  }
  signals.push({ key: 'PRIME_TIME_SLOT', delta: 10, applied: isPrimeTime });

  // 5. Tempo de antecedência > 7 dias
  const advanceDays = differenceInDays(context.scheduledAt, new Date());
  const isAdvanceBooking = advanceDays > 7;
  if (isAdvanceBooking) {
    score += 10;
  }
  signals.push({ key: 'ADVANCE_BOOKING', delta: 10, applied: isAdvanceBooking });

  // 6. Contato outbound registrado pela equipe na última semana
  const lastOutbound = context.lastOutboundContactAt;
  const recentOutbound = lastOutbound && differenceInDays(new Date(), new Date(lastOutbound)) <= 7;
  if (recentOutbound) {
    score += 10;
  }
  signals.push({ key: 'RECENT_OUTBOUND_CONTACT', delta: 10, applied: !!recentOutbound });

  // Normalize score
  score = Math.max(0, Math.min(100, score));

  let level: RiskLevel = 'LOW';
  if (score < 50) {
    level = 'HIGH';
  } else if (score < 80) {
    level = 'MEDIUM';
  }

  return { score, level, signals };
}
