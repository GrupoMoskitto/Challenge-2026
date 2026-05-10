import { prisma } from '@crmed/database';
import { logger } from '../config/logger';
import { parse, isValid, format, startOfDay } from 'date-fns';

export interface ValidationResult {
  isValid: boolean;
  error?: 'INVALID_FORMAT' | 'MISMATCH';
}

export class IdentityService {
  /**
   * Árvore de Decisão LGPD: Short-circuit, Enrichment ou Challenge
   */
  static async checkIdentity(jid: string): Promise<{ verified: boolean; nextStage: string }> {
    const phone = jid.split('@')[0].replace(/[^0-9]/g, '');

    // 1. Busca relação Lead -> Patient
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: phone.substring(phone.length - 8) } },
      include: { patient: { include: { appointments: { where: { scheduledAt: { gte: new Date() }, status: 'SCHEDULED' } } } } }
    });

    if (!lead || !lead.patient) {
      // Short-circuit: É um Lead novo ou paciente sem prontuário
      return { verified: true, nextStage: 'START' };
    }

    const patient = lead.patient;
    const futureAppts = patient.appointments;

    if (futureAppts.length === 0) {
      // Short-circuit: Não há dados sensíveis (agendamentos futuros) expostos
      return { verified: true, nextStage: 'START' };
    }

    // 2. Progressive Profiling
    if (!patient.dateOfBirth) {
      return { verified: false, nextStage: 'VERIFY_DOB_ENRICH' };
    }

    // 3. Validação Padrão
    return { verified: false, nextStage: 'VERIFY_DOB_CHALLENGE' };
  }

  /**
   * Valida a data de nascimento informada
   */
  static async validateDOB(jid: string, dobInput: string): Promise<ValidationResult> {
    // 1. Limpeza e parsing
    const cleanInput = dobInput.trim().replace(/\s/g, '');
    
    // Tenta diferentes formatos comuns
    const formats = ['dd/MM/yyyy', 'dd-MM-yyyy', 'ddMMyyyy'];
    let parsedDate: Date | null = null;

    for (const f of formats) {
      const d = parse(cleanInput, f, new Date());
      if (isValid(d) && d.getFullYear() > 1900 && d.getFullYear() <= new Date().getFullYear()) {
        parsedDate = startOfDay(d);
        break;
      }
    }

    if (!parsedDate) {
      return { isValid: false, error: 'INVALID_FORMAT' };
    }

    // 2. Busca no banco
    const phone = jid.split('@')[0].replace(/[^0-9]/g, '');
    const lead = await prisma.lead.findFirst({
        where: { phone: { contains: phone.substring(phone.length - 8) } },
        include: { patient: true }
    });

    if (!lead || !lead.patient || !lead.patient.dateOfBirth) {
        return { isValid: false, error: 'MISMATCH' };
    }

    const patientDOB = startOfDay(lead.patient.dateOfBirth);

    // 3. Comparação (usando strings para evitar problemas de timezone de objeto Date)
    if (format(parsedDate, 'yyyy-MM-dd') === format(patientDOB, 'yyyy-MM-dd')) {
      return { isValid: true };
    }

    return { isValid: false, error: 'MISMATCH' };
  }
}
