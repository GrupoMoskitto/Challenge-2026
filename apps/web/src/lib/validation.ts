import { format } from "date-fns";

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 13;
};

export const validateCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleaned[9]) !== digit1) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cleaned[10]) === digit2;
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Senha deve ter pelo menos 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Senha deve ter pelo menos uma letra maiúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Senha deve ter pelo menos uma letra minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Senha deve ter pelo menos um número');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Senha deve ter pelo menos um caractere especial');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
};

export const formatPhone = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    cleaned = cleaned.slice(2);
  }
  
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
};

export const formatCPF = (cpf: string): string => {
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }
  
  return cpf;
};

export const checkSurgeonAvailability = (surgeon: any, date: string, time: string): boolean => {
  if (!surgeon) return true;

  const [hour, minute] = time.split(':').map(Number);
  const timeVal = hour * 60 + minute;

  // 1. Check Extra Availability (exceptions)
  const extraAvail = surgeon.extraAvailability?.find((ea: any) => 
    format(new Date(ea.date), 'yyyy-MM-dd') === date && ea.isActive
  );

  if (extraAvail) {
    const [sh, sm] = extraAvail.startTime.split(':').map(Number);
    const [eh, em] = extraAvail.endTime.split(':').map(Number);
    return timeVal >= (sh * 60 + sm) && timeVal < (eh * 60 + em);
  }

  // 2. Check Weekly Availability
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const weeklyAvail = surgeon.availability?.find((a: any) => a.dayOfWeek === dayOfWeek && a.isActive);

  if (weeklyAvail) {
    const [sh, sm] = weeklyAvail.startTime.split(':').map(Number);
    const [eh, em] = weeklyAvail.endTime.split(':').map(Number);
    return timeVal >= (sh * 60 + sm) && timeVal < (eh * 60 + em);
  }

  // 3. Fallback to Hospital Default Profile: Mon-Fri, 08:00 - 18:00
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  if (isWeekday) {
    return timeVal >= (8 * 60) && timeVal < (18 * 60);
  }

  return false; // Sat/Sun closed by default if no rule
};
