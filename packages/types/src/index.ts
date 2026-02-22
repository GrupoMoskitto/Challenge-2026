export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  createdAt: Date;
  updatedAt: Date;
}

export interface Patient extends Lead {
  dateOfBirth: Date;
  medicalRecord?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  surgeonId: string;
  procedure: string;
  scheduledAt: Date;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
}

export interface Surgeon {
  id: string;
  name: string;
  specialty: string;
  crm: string;
  availability: AvailabilitySlot[];
}

export interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
