// ===== TYPES =====
export interface Lead {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  origin: "Instagram" | "TikTok" | "Google Ads" | "Indicação" | "Site";
  procedure: string;
  preferredDoctor: string;
  status: LeadStatus;
  whatsappActive: boolean;
  createdAt: string;
  notes: string;
}

export type LeadStatus =
  | "lead_recebido"
  | "contato_callcenter"
  | "agendado"
  | "avaliacao_realizada"
  | "venda";

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  crm: string;
  avatar: string;
  role: "Colaborador" | "Gestor";
}

export interface Appointment {
  id: string;
  patientName: string;
  doctorId: string;
  procedure: string;
  date: string;
  time: string;
  status: "scheduled" | "completed" | "cancelled";
  notes: string;
}

export interface Patient {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  address: string;
  birthDate: string;
  leadId: string;
  contacts: ContactEntry[];
  documents: DocumentEntry[];
  postOp: PostOpEntry[];
}

export interface ContactEntry {
  id: string;
  date: string;
  type: "whatsapp" | "call" | "email";
  direction: "inbound" | "outbound";
  status: "sent" | "delivered" | "read" | "failed" | "answered" | "missed";
  message: string;
}

export interface DocumentEntry {
  id: string;
  name: string;
  type: "contract" | "term" | "exam" | "other";
  date: string;
  status: "pending" | "signed" | "uploaded";
}

export interface PostOpEntry {
  id: string;
  date: string;
  type: "return" | "repair";
  description: string;
  status: "scheduled" | "completed" | "pending";
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  target: string;
  reason?: string;
  date: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: "whatsapp" | "sms" | "email";
  content: string;
  triggerDays: number;
}

// ===== MOCK DATA =====
export const doctors: Doctor[] = [
  { id: "d1", name: "Dr. Matheus Oliveira", specialty: "Rinoplastia", crm: "CRM/BA 12345", avatar: "", role: "Gestor" },
  { id: "d2", name: "Dra. Larissa Costa", specialty: "Lipoaspiração", crm: "CRM/BA 23456", avatar: "", role: "Colaborador" },
  { id: "d3", name: "Dra. Sabrina Mendes", specialty: "Abdominoplastia", crm: "CRM/BA 34567", avatar: "", role: "Colaborador" },
  { id: "d4", name: "Dr. Sandro Lima", specialty: "Mamoplastia", crm: "CRM/BA 45678", avatar: "", role: "Gestor" },
];

export const leads: Lead[] = [
  { id: "l1", name: "Micaele Silva", cpf: "123.456.789-00", phone: "(71) 99123-4567", email: "micaele@email.com", origin: "Instagram", procedure: "Rinoplastia", preferredDoctor: "d1", status: "lead_recebido", whatsappActive: true, createdAt: "2026-02-20", notes: "Interesse em rinoplastia estrutural" },
  { id: "l2", name: "Carlos Santos", cpf: "234.567.890-11", phone: "(71) 98234-5678", email: "carlos@email.com", origin: "Google Ads", procedure: "Lipoaspiração", preferredDoctor: "d2", status: "contato_callcenter", whatsappActive: true, createdAt: "2026-02-19", notes: "Já realizou consulta em outra clínica" },
  { id: "l3", name: "Ana Beatriz Rocha", cpf: "345.678.901-22", phone: "(71) 97345-6789", email: "ana@email.com", origin: "TikTok", procedure: "Abdominoplastia", preferredDoctor: "d3", status: "agendado", whatsappActive: false, createdAt: "2026-02-18", notes: "" },
  { id: "l4", name: "Roberto Almeida", cpf: "456.789.012-33", phone: "(71) 96456-7890", email: "roberto@email.com", origin: "Indicação", procedure: "Blefaroplastia", preferredDoctor: "d1", status: "avaliacao_realizada", whatsappActive: true, createdAt: "2026-02-17", notes: "Indicação do Dr. Sandro" },
  { id: "l5", name: "Juliana Ferreira", cpf: "567.890.123-44", phone: "(71) 95567-8901", email: "juliana@email.com", origin: "Instagram", procedure: "Mamoplastia", preferredDoctor: "d4", status: "venda", whatsappActive: true, createdAt: "2026-02-15", notes: "Contrato assinado" },
  { id: "l6", name: "Pedro Henrique Lima", cpf: "678.901.234-55", phone: "(71) 94678-9012", email: "pedro@email.com", origin: "Google Ads", procedure: "Rinoplastia", preferredDoctor: "d1", status: "lead_recebido", whatsappActive: false, createdAt: "2026-02-21", notes: "" },
  { id: "l7", name: "Fernanda Dias", cpf: "789.012.345-66", phone: "(71) 93789-0123", email: "fernanda@email.com", origin: "Site", procedure: "Lipo HD", preferredDoctor: "d2", status: "contato_callcenter", whatsappActive: true, createdAt: "2026-02-20", notes: "Quer agendar para março" },
  { id: "l8", name: "Marcos Vinícius", cpf: "890.123.456-77", phone: "(71) 92890-1234", email: "marcos@email.com", origin: "TikTok", procedure: "Otoplastia", preferredDoctor: "d3", status: "agendado", whatsappActive: true, createdAt: "2026-02-16", notes: "" },
];

export const appointments: Appointment[] = [
  { id: "a1", patientName: "Ana Beatriz Rocha", doctorId: "d3", procedure: "Abdominoplastia", date: "2026-02-24", time: "08:00", status: "scheduled", notes: "" },
  { id: "a2", patientName: "Marcos Vinícius", doctorId: "d3", procedure: "Otoplastia", date: "2026-02-24", time: "10:00", status: "scheduled", notes: "" },
  { id: "a3", patientName: "Roberto Almeida", doctorId: "d1", procedure: "Blefaroplastia", date: "2026-02-24", time: "09:00", status: "scheduled", notes: "Avaliação final" },
  { id: "a4", patientName: "Juliana Ferreira", doctorId: "d4", procedure: "Mamoplastia", date: "2026-02-25", time: "14:00", status: "scheduled", notes: "Pré-operatório" },
  { id: "a5", patientName: "Micaele Silva", doctorId: "d1", procedure: "Rinoplastia", date: "2026-02-25", time: "08:00", status: "scheduled", notes: "" },
  { id: "a6", patientName: "Carlos Santos", doctorId: "d2", procedure: "Lipoaspiração", date: "2026-02-26", time: "10:00", status: "scheduled", notes: "" },
];

export const patients: Patient[] = [
  {
    id: "p1", name: "Juliana Ferreira", cpf: "567.890.123-44", phone: "(71) 95567-8901", email: "juliana@email.com",
    address: "Rua das Flores, 123 - Pituba, Salvador/BA", birthDate: "1990-05-15", leadId: "l5",
    contacts: [
      { id: "c1", date: "2026-02-10T10:30:00", type: "whatsapp", direction: "outbound", status: "read", message: "Olá Juliana! Aqui é do Hospital São Rafael. Confirmamos seu interesse em Mamoplastia." },
      { id: "c2", date: "2026-02-11T14:00:00", type: "call", direction: "outbound", status: "answered", message: "Ligação de 8min. Paciente confirmou interesse e agendou avaliação." },
      { id: "c3", date: "2026-02-13T09:00:00", type: "whatsapp", direction: "outbound", status: "delivered", message: "Lembrete: sua avaliação é amanhã às 14h com Dr. Sandro Lima." },
      { id: "c4", date: "2026-02-15T16:00:00", type: "whatsapp", direction: "inbound", status: "read", message: "Gostaria de confirmar o procedimento. Quando posso assinar o contrato?" },
    ],
    documents: [
      { id: "doc1", name: "Contrato de Prestação de Serviços", type: "contract", date: "2026-02-15", status: "signed" },
      { id: "doc2", name: "Termo de Ciência - Peso", type: "term", date: "2026-02-15", status: "signed" },
      { id: "doc3", name: "Exames Pré-Operatórios", type: "exam", date: "2026-02-20", status: "uploaded" },
    ],
    postOp: [
      { id: "po1", date: "2026-03-10", type: "return", description: "Retorno 15 dias pós-cirurgia", status: "scheduled" },
      { id: "po2", date: "2026-04-25", type: "return", description: "Retorno 2 meses", status: "pending" },
    ],
  },
];

export const auditLogs: AuditLog[] = [
  { id: "al1", user: "Maria Souza (Recepção)", action: "Alterou status do agendamento", target: "Ana Beatriz Rocha - Abdominoplastia", reason: "Paciente reagendou por conflito de horário", date: "2026-02-22T11:30:00" },
  { id: "al2", user: "João Silva (Call Center)", action: "Moveu lead no pipeline", target: "Carlos Santos → Contato Call Center", date: "2026-02-21T09:15:00" },
  { id: "al3", user: "Dr. Sandro Lima", action: "Cancelou contrato", target: "Fernanda Oliveira - Rinoplastia", reason: "Paciente desistiu por motivos pessoais", date: "2026-02-20T16:45:00" },
  { id: "al4", user: "Admin Sistema", action: "Atualizou permissões", target: "Dra. Sabrina Mendes → Gestor", date: "2026-02-19T08:00:00" },
];

export const messageTemplates: MessageTemplate[] = [
  { id: "mt1", name: "Boas-vindas Lead", channel: "whatsapp", content: "Olá {nome}! Bem-vindo(a) ao Hospital São Rafael. Recebemos seu interesse em {procedimento}. Em breve entraremos em contato!", triggerDays: 0 },
  { id: "mt2", name: "Lembrete 4 dias", channel: "whatsapp", content: "Olá {nome}! Lembramos que sua consulta está agendada para {data} às {hora} com {medico}.", triggerDays: 4 },
  { id: "mt3", name: "Lembrete 2 dias", channel: "whatsapp", content: "{nome}, faltam apenas 2 dias para sua consulta! Não esqueça de trazer seus exames.", triggerDays: 2 },
  { id: "mt4", name: "Lembrete 1 dia", channel: "whatsapp", content: "Sua consulta é amanhã, {nome}! Estaremos esperando você às {hora}. Qualquer dúvida, estamos à disposição.", triggerDays: 1 },
];

// ===== HELPERS =====
export const leadStatusLabels: Record<LeadStatus, string> = {
  lead_recebido: "Lead Recebido",
  contato_callcenter: "Contato Call Center",
  agendado: "Agendado",
  avaliacao_realizada: "Avaliação Realizada",
  venda: "Venda (Contrato)",
};

export const leadStatusColors: Record<LeadStatus, string> = {
  lead_recebido: "bg-muted text-muted-foreground",
  contato_callcenter: "bg-info/15 text-info-foreground",
  agendado: "bg-primary/15 text-primary",
  avaliacao_realizada: "bg-warning/15 text-warning",
  venda: "bg-success/15 text-success",
};

export const channelData = [
  { name: "Instagram", leads: 45, color: "hsl(var(--primary))" },
  { name: "TikTok", leads: 32, color: "hsl(var(--warning))" },
  { name: "Google Ads", leads: 28, color: "hsl(var(--success))" },
  { name: "Indicação", leads: 18, color: "hsl(var(--destructive))" },
  { name: "Site", leads: 12, color: "hsl(var(--muted-foreground))" },
];
