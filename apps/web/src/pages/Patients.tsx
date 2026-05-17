import React, { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskPill } from "@crmed/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton, CardListSkeleton } from "@/components/ui/skeleton";
import { 
  Calendar as CalendarIcon, 
  Search, 
  Phone,
  MessageCircle, 
  Mail, 
  FileText, 
  Check, 
  X, 
  Clock, 
  User, 
  Pencil, 
  Plus, 
  Filter, 
  History as HistoryIcon, 
  Loader2, 
  Trash2,
  Info,
  UploadCloud,
  ArrowLeft
} from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import { useAuth } from "@/lib/auth";
import {
  GET_PATIENTS,
  GET_PATIENT,
  UPDATE_PATIENT,
  CREATE_DOCUMENT,
  DELETE_DOCUMENT,
  CREATE_POST_OP,
  CREATE_APPOINTMENT,
  GET_SURGEONS,
  DELETE_LEAD,
} from "@/lib/queries";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePatientModal } from "@/components/PatientModalContext";
import { AuditDiff } from "@/components/AuditDiff";
import { HistoricalDatePicker } from "@/components/ui/historical-date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { checkSurgeonAvailability } from "@/lib/validation";

const documentTypeLabels: Record<string, string> = {
  CONTRACT: 'Contrato',
  EXAM: 'Exame',
  OTHER: 'Outro',
};

const documentStatusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  SIGNED: 'Assinado',
  UPLOADED: 'Enviado',
};

const auditActionLabels: Record<string, string> = {
  CREATED: "criado",
  UPDATED: "modificado",
  STATUS_CHANGE: "modificado",
  DELETED: "removido",
};

const statusColors: Record<string, string> = {
  NEW: 'bg-slate-500 text-white',
  CONTACTED: 'bg-blue-600 text-white',
  QUALIFIED: 'bg-amber-500 text-white',
  CONVERTED: 'bg-emerald-600 text-white',
  LOST: 'bg-rose-600 text-white',
};

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contato',
  QUALIFIED: 'Qualificado',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
};

const StatusIconComponent = ({ status }: { status: string }) => {
  switch (status) {
    case 'READ':
    case 'ANSWERED':
    case 'SIGNED': return <Check className="h-3 w-3 text-green-500" />;
    case 'FAILED':
    case 'MISSED': return <X className="h-3 w-3 text-red-500" />;
    default: return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
};

const getAuditActionMeta = (action?: string) => {
  switch (action) {
    case "CREATED":
      return { icon: Plus, iconClassName: "text-green-500", containerClassName: "bg-green-500/20" };
    case "DELETED":
      return { icon: Trash2, iconClassName: "text-red-500", containerClassName: "bg-red-500/20" };
    default:
      return { icon: HistoryIcon, iconClassName: "text-blue-500", containerClassName: "bg-blue-500/20" };
  }
};

const translateStatus = (raw: string) => statusLabels[raw] || raw;

const getAuditMessage = (item: any, leadName?: string | null) => {
  if (item.action === 'STATUS_CHANGE') {
    return `Status alterado de ${translateStatus(item.oldValue)} para ${translateStatus(item.newValue)}`;
  }
  const safeName = leadName || "cliente";
  const actionLabel = auditActionLabels[item.action] || "modificado";
  
  const entityLabel = item.entityType === 'Patient' ? 'Paciente' : 'Lead';
  return `${entityLabel} ${safeName} ${actionLabel}!`;
};

function PatientTimeline({ patient }: { patient: any }) {
  const contacts = patient?.lead?.contacts || [];
  const rawAuditLogs = patient?.auditLogs || [];

  // Process logs: Deduplicate and normalize dates
  const processedLogs = rawAuditLogs.reduce((acc: any[], log: any) => {
    // Deduplication logic: avoid showing multiple 'CREATED' logs for the same thing/time
    const isDuplicate = acc.some(existing => 
      existing.action === log.action && 
      existing.entityType === log.entityType && 
      Math.abs(new Date(existing.createdAt).getTime() - new Date(log.createdAt).getTime()) < 1000
    );

    if (!isDuplicate) {
      acc.push({ ...log, itemType: 'AUDIT', timestamp: new Date(log.createdAt) });
    }
    return acc;
  }, []);

  const hasPatientCreatedLog = processedLogs.some((l: any) => l.action === 'CREATED' && (l.entityType === 'Patient' || l.entityType === 'Lead'));
  if (!hasPatientCreatedLog && patient?.createdAt) {
    processedLogs.push({
      id: `virtual-creation-${patient.id}`,
      action: 'CREATED',
      entityType: 'Patient',
      timestamp: new Date(patient.createdAt),
      itemType: 'AUDIT',
      createdAt: patient.createdAt
    });
  }

  const timelineItems = [
    ...contacts.map((c: any) => ({ ...c, itemType: 'CONTACT', timestamp: new Date(c.date) })),
    ...processedLogs
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (timelineItems.length === 0) {
    return (
      <div className="text-center py-20 bg-background/50 m-6 rounded-xl border border-dashed">
        <Info className="h-8 w-8 mx-auto mb-3 opacity-20" />
        <p className="text-sm text-muted-foreground">Nenhum evento registrado na linha do tempo.</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 relative min-h-full">
      <div className="space-y-6 relative z-10">
        {timelineItems.map((item: any, index: number) => {
          const isLast = index === timelineItems.length - 1;
          const isContact = item.itemType === 'CONTACT';
          const meta = !isContact ? getAuditActionMeta(item.action) : null;
          const IconComp = isContact ? (item.type === 'WHATSAPP' ? MessageCircle : item.type === 'EMAIL' ? Mail : Phone) : meta!.icon;
          const colorClass = isContact 
            ? (item.type === 'WHATSAPP' ? "text-green-600 border-green-500/20 bg-background" : item.type === 'EMAIL' ? "text-purple-600 border-purple-500/20 bg-background" : "text-blue-600 border-blue-500/20 bg-background")
            : meta!.containerClassName + " " + meta!.iconClassName.replace('text-', 'border-') + " border border-primary/10 bg-background";

          return (
            <div key={item.id} className="relative flex items-center gap-5 group">
              {!isLast && (
                <div className="absolute left-[19px] w-px bg-border/60 z-0" style={{ top: '50%', bottom: '-50%' }} />
              )}
              <div className={cn("relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 bg-background shrink-0 shadow-sm transition-transform group-hover:scale-105", colorClass)}>
                <IconComp className="h-4 w-4" />
              </div>
              <div className="flex-1 bg-background p-4 rounded-xl border shadow-sm transition-all hover:shadow-md hover:border-primary/20 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isContact ? (item.direction === 'OUTBOUND' ? 'default' : 'secondary') : 'outline'} className="text-[10px] px-2 py-0">
                      {isContact ? (item.direction === 'OUTBOUND' ? 'Mensagem Enviada' : 'Mensagem Recebida') : (item.action === 'CREATED' ? 'Criação' : item.action === 'STATUS_CHANGE' ? 'Status Alterado' : 'Registro Alterado')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {isContact && <StatusIconComponent status={item.status} />}
                    <time className="text-[11px] text-muted-foreground font-medium bg-muted/40 px-2 py-1 rounded-md">{format(item.timestamp, "dd/MM/yyyy 'às' HH:mm")}</time>
                  </div>
                </div>
                
                <p className="text-sm text-foreground/90 leading-relaxed font-medium mt-1 whitespace-pre-wrap break-words">
                  {isContact ? item.message : getAuditMessage(item, patient?.lead?.name)}
                </p>
                
                {!isContact && item.oldValue && item.newValue && (
                  <div className="mt-3">
                    <AuditDiff oldValue={item.oldValue} newValue={item.newValue} className="bg-muted/30 border border-border/50 p-3 rounded-lg text-xs" />
                  </div>
                )}
                
                {item.user && (
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3 opacity-60" />
                    <span>Registrado por <strong className="font-semibold uppercase tracking-wider">{item.user.name}</strong></span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MAX_WEIGHT_KG = 400;
const MAX_HEIGHT_CM = 300;
const PAGE_SIZE = 20;

const Patients = () => {
  const { user } = useAuth();
  const { openCreatePatientModal } = usePatientModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "");
  const [showFilters, setShowFilters] = useState(!!searchParams.get("status"));
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "timeline");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(searchParams.get("patientId"));

  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) newParams.delete(key);
      else newParams.set(key, value);
    });
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const urlStatus = searchParams.get("status") || "";
    const urlPatientId = searchParams.get("patientId") || null;
    const urlTab = searchParams.get("tab") || "timeline";

    if (statusFilter !== urlStatus) { setStatusFilter(urlStatus); setShowFilters(!!urlStatus); }
    if (urlPatientId !== selectedPatientId) { setSelectedPatientId(urlPatientId); }
    if (urlTab !== activeTab) { setActiveTab(urlTab); }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== debouncedSearch) {
        setDebouncedSearch(search);
        updateUrl({ search: search || null });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch, updateUrl]);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      openCreatePatientModal();
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("create");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, openCreatePatientModal, setSearchParams]);

  const { data: patientsData, previousData: prevPatientData, loading: loadingPatients, fetchMore, refetch: refetchPatients } = useQuery(GET_PATIENTS, {
    variables: { first: PAGE_SIZE, where: { search: debouncedSearch || undefined, status: statusFilter || undefined } },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: 'cache-and-network',
  });

  const { data: patientQueryData, loading: loadingPatient, refetch: refetchPatient } = useQuery(GET_PATIENT, {
    variables: { id: selectedPatientId || "" },
    skip: !selectedPatientId,
    fetchPolicy: 'cache-and-network',
  });

  const { data: surgeonsData } = useQuery(GET_SURGEONS);

  const currentPatientRef = useRef<any>(null);
  useEffect(() => { if (patientQueryData?.patient) currentPatientRef.current = patientQueryData.patient; }, [patientQueryData]);

  const patient = patientQueryData?.patient || currentPatientRef.current;

  const [updatePatient, { loading: updatingPatient }] = useMutation(UPDATE_PATIENT);
  const [createDocument, { loading: creatingDoc }] = useMutation(CREATE_DOCUMENT);
  const [deleteDocument, { loading: deletingDoc }] = useMutation(DELETE_DOCUMENT);
  const [createPostOp, { loading: creatingPostOp }] = useMutation(CREATE_POST_OP);

  const [deleteDocDialogOpen, setDeleteDocDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [createAppointment, { loading: creatingAppt }] = useMutation(CREATE_APPOINTMENT);

  const [editPatientDialogOpen, setEditPatientDialogOpen] = useState(false);
  const [editPatientForm, setEditPatientForm] = useState({
    dateOfBirth: "", medicalRecord: "", address: "", sex: "", weight: "", height: "", howMet: "", reason: ""
  });

  const [deleteLead, { loading: deletingPatient }] = useMutation(DELETE_LEAD);
  const [deletePatientDialogOpen, setDeletePatientDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ name: "", type: "CONTRACT", date: new Date().toISOString().split('T')[0] });
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [newPostOpDialogOpen, setNewPostOpDialogOpen] = useState(false);
  const [newPostOpForm, setNewPostOpForm] = useState({ description: "", type: "RETURN", date: new Date().toISOString().split('T')[0] });

  const [newApptDialogOpen, setNewApptDialogOpen] = useState(false);
  const [newApptForm, setNewApptForm] = useState({ 
    procedure: "", 
    surgeonId: "", 
    date: new Date().toISOString().split('T')[0],
    time: "09:00"
  });

  const effectivePatientsData = patientsData || prevPatientData;
  const pagination = effectivePatientsData?.patients?.pageInfo;
  const patientList = effectivePatientsData?.patients?.edges?.map((e: any) => e.node) || [];

  const handleTabChange = useCallback((v: string) => { setActiveTab(v); updateUrl({ tab: v }); }, [updateUrl]);

  const handleDeletePatient = async () => {
    if (!selectedPatientId || !patient?.lead?.id) return;
    if (deleteConfirmText.toLowerCase() !== 'deletar') {
      toast.error("Digite 'deletar' para confirmar");
      return;
    }
    try {
      await deleteLead({ variables: { id: patient.lead.id } });
      toast.success("Paciente excluído (anonimizado) com sucesso!");
      setDeletePatientDialogOpen(false);
      setDeleteConfirmText("");
      setSelectedPatientId(null);
      updateUrl({ patientId: null });
      refetchPatients();
    } catch (e: any) { 
      toast.error(e.message); 
    }
  };

  const handleUpdatePatient = async () => {
    if (!selectedPatientId) return;
    const wStr = (editPatientForm.weight || "").toString().replace(",", ".");
    const hStr = (editPatientForm.height || "").toString().replace(",", ".");
    const w = parseFloat(wStr);
    const h = parseFloat(hStr);
    if (editPatientForm.weight && (isNaN(w) || w <= 0 || w > MAX_WEIGHT_KG)) return toast.error("Peso inválido.");
    if (editPatientForm.height && (isNaN(h) || h <= 0 || h > MAX_HEIGHT_CM)) return toast.error("Altura inválida.");

    try {
      await updatePatient({
        variables: {
          input: {
            id: selectedPatientId,
            dateOfBirth: editPatientForm.dateOfBirth ? new Date(editPatientForm.dateOfBirth).toISOString() : undefined,
            medicalRecord: editPatientForm.medicalRecord || undefined,
            address: editPatientForm.address || undefined,
            sex: editPatientForm.sex || undefined,
            weight: isNaN(w) ? undefined : w,
            height: isNaN(h) ? undefined : h,
            howMet: editPatientForm.howMet || undefined,
            reason: editPatientForm.reason || undefined,
          }
        }
      });
      toast.success("Paciente atualizado!");
      setEditPatientDialogOpen(false);
      refetchPatient();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateDocument = async () => {
    if (!selectedPatientId || !newDocForm.name || !newDocFile) {
      toast.error("Por favor, preencha o nome e selecione um arquivo.");
      return;
    }
    try {
      // 1. Upload file to REST API
      const formData = new FormData();
      formData.append('file', newDocFile);
      
      // Use the same API_URL format as Apollo
      const apiBase = import.meta.env.VITE_API_URL?.replace('/graphql', '') || 'http://localhost:3001';
      
      const uploadRes = await fetch(`${apiBase}/api/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Necessário para enviar o cookie de access_token
        headers: {
          ...(localStorage.getItem('user') ? { 'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user')!)?.token}` } : {})
        }
      });

      if (!uploadRes.ok) {
        throw new Error('Falha no upload do arquivo');
      }

      const { url, type } = await uploadRes.json();

      // 2. Save metadata via GraphQL
      await createDocument({
        variables: {
          input: {
            patientId: selectedPatientId,
            name: newDocForm.name,
            type: newDocForm.type,
            date: new Date(newDocForm.date).toISOString(),
            status: "UPLOADED",
            fileUrl: url,
            fileType: type
          }
        }
      });
      toast.success("Documento registrado!");
      setNewDocDialogOpen(false);
      setNewDocForm({ name: "", type: "CONTRACT", date: new Date().toISOString().split('T')[0] });
      setNewDocFile(null);
      refetchPatient();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    try {
      await deleteDocument({ variables: { id: docToDelete } });
      toast.success("Documento excluído com sucesso!");
      refetchPatient();
      setDeleteDocDialogOpen(false);
      setDocToDelete(null);
    } catch (e: any) { 
      toast.error(e.message); 
    }
  };

  const handleCreatePostOp = async () => {
    if (!selectedPatientId || !newPostOpForm.description) return;
    try {
      await createPostOp({
        variables: {
          input: {
            patientId: selectedPatientId,
            description: newPostOpForm.description,
            type: newPostOpForm.type,
            date: new Date(newPostOpForm.date).toISOString()
          }
        }
      });
      toast.success("Pós-operatório agendado!");
      setNewPostOpDialogOpen(false);
      setNewPostOpForm({ description: "", type: "RETURN", date: new Date().toISOString().split('T')[0] });
      refetchPatient();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateAppointment = async () => {
    if (!selectedPatientId || !newApptForm.procedure || !newApptForm.surgeonId) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const surgeon = surgeonsData?.surgeons?.find((s: any) => s.id === newApptForm.surgeonId);
    if (!checkSurgeonAvailability(surgeon, newApptForm.date, newApptForm.time)) {
      toast.error("Horário não permitido: O hospital/médico não atende neste horário (Limite padrão 18:00). Verifique as configurações de agenda.");
      return;
    }

    try {
      const scheduledAt = new Date(`${newApptForm.date}T${newApptForm.time}:00`);
      await createAppointment({
        variables: {
          input: {
            patientId: selectedPatientId,
            surgeonId: newApptForm.surgeonId,
            procedure: newApptForm.procedure,
            scheduledAt: scheduledAt.toISOString()
          }
        }
      });
      toast.success("Consulta agendada!");
      setNewApptDialogOpen(false);
      setNewApptForm({ 
        procedure: "", 
        surgeonId: "", 
        date: new Date().toISOString().split('T')[0],
        time: "09:00"
      });
      refetchPatient();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loadingPatients && !patientsData) {
    return <AppLayout title="Pacientes"><div className="flex gap-6"><div className="w-1/3 space-y-2"><Skeleton className="h-10 w-full" />{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div><div className="flex-1 space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div></div></AppLayout>;
  }

  return (
    <AppLayout title="Pacientes">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className={cn(
          "space-y-4 w-full lg:w-1/3 lg:shrink-0",
          selectedPatientId && "hidden lg:block"
        )}>
           <div className="flex items-center justify-between gap-2">
             <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-9" />
               {loadingPatients && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />}
             </div>
             <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)} className={cn(!!statusFilter && "border-primary")}>
               <Filter className="h-4 w-4" />
             </Button>
             <Button size="sm" onClick={() => openCreatePatientModal()} className="ml-2"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
           </div>

          {showFilters && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-3 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Filtros</span>
                  <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); updateUrl({ status: null }); }} className="h-6 text-[10px]">Limpar</Button>
                </div>
                <Select value={statusFilter || "ALL"} onValueChange={v => { const n = v === "ALL" ? "" : v; setStatusFilter(n); updateUrl({ status: n || null }); }}>
                  <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Todos os status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos os status</SelectItem>
                    {Object.entries(statusLabels).map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {patientList.length === 0 ? <div className="py-12 text-center bg-muted/20 rounded-lg border-2 border-dashed text-sm text-muted-foreground">Nenhum encontrado</div> : (
              patientList.map((p_item: any) => (
                <Card 
                  key={p_item.id} 
                  className={cn("cursor-pointer transition-all hover:border-primary/50", selectedPatientId === p_item.id && "border-primary ring-1 ring-primary/20 bg-primary/5")}
                  onClick={() => { setSelectedPatientId(p_item.id); updateUrl({ patientId: p_item.id }); }}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{p_item.lead?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p_item.lead?.phone}</p>
                      </div>
                      <Badge className={cn("text-[10px] h-4", statusColors[p_item.lead?.status])}>{statusLabels[p_item.lead?.status]}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            {pagination?.hasNextPage && <Button variant="ghost" className="w-full text-xs text-muted-foreground h-8" onClick={() => fetchMore({ variables: { after: pagination.endCursor } })} disabled={loadingPatients}>Carregar mais</Button>}
          </div>
        </div>

        <div className={cn(
          "flex-1 min-w-0",
          !selectedPatientId && "hidden lg:block"
        )}>
          {/* Back button — mobile only */}
          {selectedPatientId && (
            <Button variant="ghost" size="sm" className="lg:hidden mb-3 -ml-1 gap-1.5 text-muted-foreground" onClick={() => { setSelectedPatientId(null); updateUrl({ patientId: null }); }}>
              <ArrowLeft className="h-4 w-4" /> Voltar à lista
            </Button>
          )}
          {loadingPatient && !patient ? <div className="space-y-4"><Skeleton className="h-64 w-full" /><CardListSkeleton count={3} /></div> : patient ? (
            <div className={cn("space-y-4 transition-opacity", loadingPatient && "opacity-60")}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Dados Pessoais</CardTitle>
                  <div className="flex items-center gap-2">
                    {user?.role === 'ADMIN' && (
                      <Button variant="ghost" size="sm" onClick={() => setDeletePatientDialogOpen(true)} className="text-red-500 hover:text-red-700 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4 mr-2" />Deletar
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditPatientForm({
                        dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : "",
                        medicalRecord: patient.medicalRecord || "",
                        address: patient.address || "",
                        sex: patient.sex || "",
                        weight: patient.weight?.toString() || "",
                        height: patient.height?.toString() || "",
                        howMet: patient.howMet || "",
                        reason: ""
                      });
                      setEditPatientDialogOpen(true);
                    }}><Pencil className="h-4 w-4 mr-2" />Editar</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                   <div className="flex items-center gap-3 mb-4">
                     <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
                       <span className="text-lg font-bold text-primary">
                         {patient.lead?.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                       </span>
                     </div>
                     <div className="min-w-0">
                       <div className="flex items-center gap-2">
                         <p className="font-semibold text-lg break-words">{patient.lead?.name}</p>
                         <Badge className={cn("text-[10px] px-2 h-4 text-white border-none", statusColors[patient.lead?.status])}>{statusLabels[patient.lead?.status]}</Badge>
                       </div>
                       <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><span>CPF</span><p className="font-mono">{patient.lead?.cpf}</p></div>
                     </div>
                   </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Telefone</span><p>{patient.lead?.phone}</p></div>
                    <div><span className="text-muted-foreground">E-mail</span><p className="truncate">{patient.lead?.email}</p></div>
                    <div><span className="text-muted-foreground">Data de Nascimento</span><p>{patient.dateOfBirth ? format(new Date(new Date(patient.dateOfBirth).getTime() + new Date(patient.dateOfBirth).getTimezoneOffset() * 60000), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p></div>
                    <div><span className="text-muted-foreground">Prontuário</span><p>{patient.medicalRecord || '-'}</p></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Endereço</span><p className="break-words">{patient.address || '-'}</p></div>
                    <div><span className="text-muted-foreground">Sexo</span><p>{patient.sex || '-'}</p></div>
                    <div><span className="text-muted-foreground">Peso (kg)</span><p>{patient.weight || '-'}</p></div>
                    <div><span className="text-muted-foreground">Altura (cm)</span><p>{patient.height || '-'}</p></div>
                    <div><span className="text-muted-foreground">IMC</span><p className={cn("font-bold", (patient.bmi > 25 || patient.bmi < 18.5) ? "text-amber-600" : "text-emerald-600")}>{patient.bmi || '-'}</p></div>
                    <div><span className="text-muted-foreground">Como nos conheceu</span><p>{patient.howMet || '-'}</p></div>
                  </div>
                </CardContent>
              </Card>

              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="w-full flex sm:grid sm:grid-cols-4 overflow-x-auto no-scrollbar justify-start h-auto p-1 bg-muted rounded-md">
                  <TabsTrigger value="timeline" className="flex-1 whitespace-nowrap px-3">Linha do Tempo</TabsTrigger>
                  <TabsTrigger value="appointments" className="flex-1 whitespace-nowrap px-3">Consultas</TabsTrigger>
                  <TabsTrigger value="documents" className="flex-1 whitespace-nowrap px-3">Documentos</TabsTrigger>
                  <TabsTrigger value="postop" className="flex-1 whitespace-nowrap px-3">Pós-Op</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline" className="mt-6">
                  <PatientTimeline patient={patient} />
                </TabsContent>
                <TabsContent value="appointments" className="mt-4 space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => {
                      setNewApptForm(prev => ({ ...prev, procedure: patient.lead?.procedure || "" }));
                      setNewApptDialogOpen(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
                    </Button>
                  </div>
                  {patient.appointments?.length === 0 ? <div className="py-20 text-center text-sm text-muted-foreground">Nenhuma consulta registrada.</div> : (
                    patient.appointments?.map((apt: any) => (
                      <Card 
                        key={apt.id} 
                        className="cursor-pointer hover:border-primary/50 transition-colors hover:shadow-sm"
                        onClick={() => {
                          const aptDate = format(new Date(apt.scheduledAt), 'yyyy-MM-dd');
                          navigate(`/schedule?date=${aptDate}&appointmentId=${apt.id}`);
                        }}
                      >
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{apt.procedure}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(apt.scheduledAt), "dd/MM/yyyy 'às' HH:mm")} • Dr(a). {apt.surgeon?.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <RiskPill 
                              score={apt.riskScore} 
                              level={apt.riskLevel} 
                              minimal={true}
                            />
                            <Badge 
                              className={cn(
                                "border",
                                apt.status === 'SCHEDULED' ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" :
                                apt.status === 'CONFIRMED' ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" :
                                apt.status === 'ATTENTION_REQUIRED' ? "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800" :
                                apt.status === 'COMPLETED' ? "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800" :
                                apt.status === 'CANCELLED' ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" :
                                apt.status === 'NO_SHOW' ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800" :
                                "bg-muted text-muted-foreground border-transparent"
                              )}
                            >
                              {apt.status === 'SCHEDULED' ? 'Agendado' :
                               apt.status === 'CONFIRMED' ? 'Confirmado' :
                               apt.status === 'ATTENTION_REQUIRED' ? 'Requer Atenção' :
                               apt.status === 'COMPLETED' ? 'Concluído' :
                               apt.status === 'CANCELLED' ? 'Cancelado' :
                               apt.status === 'NO_SHOW' ? 'Não Compareceu' : apt.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="documents" className="mt-4 space-y-4">
                  <div className="flex justify-end"><Button size="sm" onClick={() => setNewDocDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo</Button></div>
                  {patient.documents?.length === 0 ? <div className="py-20 text-center text-sm text-muted-foreground">Nenhum documento registrado.</div> : (
                    patient.documents?.map((doc: any) => (
                      <Card key={doc.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">
                                {doc.fileUrl ? (
                                  <a 
                                    href={`${import.meta.env.VITE_API_URL?.replace('/graphql', '') || 'http://localhost:3001'}${doc.fileUrl}`}
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-primary hover:underline flex items-center"
                                  >
                                    {doc.name}
                                  </a>
                                ) : (
                                  doc.name
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{documentTypeLabels[doc.type as keyof typeof documentTypeLabels]} • {format(new Date(doc.date), 'dd/MM/yyyy')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={doc.status === 'SIGNED' ? 'default' : 'outline'}
                              className={cn(doc.status === 'SIGNED' && "bg-emerald-600 text-white border-none")}
                            >
                              {documentStatusLabels[doc.status]}
                            </Badge>
                            {user && ['ADMIN', 'SURGEON'].includes(user.role) && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                                onClick={() => { setDocToDelete(doc.id); setDeleteDocDialogOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="postop" className="mt-4 space-y-4">
                  <div className="flex justify-end"><Button size="sm" onClick={() => setNewPostOpDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Agendar</Button></div>
                  {patient.postOps?.length === 0 ? <div className="py-20 text-center text-sm text-muted-foreground">Nenhum registro de pós-operatório.</div> : (
                    patient.postOps?.map((po: any) => (
                      <Card key={po.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{po.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">{format(new Date(po.date), 'dd/MM/yyyy')}</span>
                                <span className="text-[10px] font-bold uppercase text-muted-foreground/50 bg-muted px-1 rounded">{po.type === 'RETURN' ? 'Retorno' : po.type === 'REPAIR' ? 'Reparo' : po.type}</span>
                              </div>
                            </div>
                          </div>
                          <Badge 
                            className={cn(
                              po.status === 'COMPLETED' ? "bg-emerald-500 hover:bg-emerald-600" : 
                              po.status === 'SCHEDULED' ? "bg-blue-500 hover:bg-blue-600" : "bg-amber-500 hover:bg-amber-600",
                              "text-white border-none"
                            )}
                          >
                            {po.status === 'COMPLETED' ? 'Concluído' : po.status === 'SCHEDULED' ? 'Agendado' : 'Pendente'}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : <Card><CardContent className="p-12 text-center text-muted-foreground">Selecione um paciente</CardContent></Card>}
        </div>
      </div>

      <ResponsiveModal open={editPatientDialogOpen} onOpenChange={setEditPatientDialogOpen} title="Editar Paciente">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nascimento</Label><HistoricalDatePicker value={editPatientForm.dateOfBirth} onChange={iso => setEditPatientForm(f => ({...f, dateOfBirth: iso}))} minYear={1900} locale={ptBR} /></div>
              <div className="space-y-2"><Label>Prontuário</Label><Input value={editPatientForm.medicalRecord} onChange={e => setEditPatientForm(f => ({...f, medicalRecord: e.target.value}))} /></div>
            </div>
            <div className="space-y-2"><Label>Endereço</Label><Input value={editPatientForm.address} onChange={e => setEditPatientForm(f => ({...f, address: e.target.value}))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Sexo</Label><Select value={editPatientForm.sex} onValueChange={v => setEditPatientForm(f => ({...f, sex: v}))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Masculino">Masculino</SelectItem><SelectItem value="Feminino">Feminino</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Peso (kg)</Label><Input type="number" inputMode="decimal" step="0.1" value={editPatientForm.weight} onChange={e => setEditPatientForm(f => ({...f, weight: e.target.value}))} /></div>
              <div className="space-y-2"><Label>Altura (cm)</Label><Input type="number" inputMode="numeric" step="1" value={editPatientForm.height} onChange={e => setEditPatientForm(f => ({...f, height: e.target.value}))} /></div>
            </div>
            <div className="space-y-2"><Label>Como nos conheceu</Label><Input value={editPatientForm.howMet} onChange={e => setEditPatientForm(f => ({...f, howMet: e.target.value}))} /></div>
            <div className="space-y-2"><Label className="text-primary font-bold">Motivo da Alteração *</Label><Input placeholder="Obrigatório para o histórico" value={editPatientForm.reason} onChange={e => setEditPatientForm(f => ({...f, reason: e.target.value}))} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditPatientDialogOpen(false)}>Cancelar</Button><Button onClick={handleUpdatePatient} disabled={updatingPatient || !editPatientForm.reason}>Salvar</Button></div>
      </ResponsiveModal>

      <ResponsiveModal open={newDocDialogOpen} onOpenChange={setNewDocDialogOpen} title="Novo Documento">
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome do Documento *</Label><Input value={newDocForm.name} onChange={e => setNewDocForm(f => ({...f, name: e.target.value}))} /></div>
            
            <div className="space-y-2">
              <Label>Arquivo *</Label>
              <div 
                className={cn(
                  "relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all text-center",
                  isDraggingFile ? "border-primary bg-primary/5" : "border-muted-foreground/20 bg-muted/20 hover:bg-muted/40",
                  newDocFile && "border-green-500/50 bg-green-500/5"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("O arquivo excede o limite de 10MB.");
                      return;
                    }
                    setNewDocFile(file);
                  }
                }}
              >
                <div className="bg-background p-3 rounded-full shadow-sm mb-3 border">
                  {newDocFile ? <Check className="h-6 w-6 text-green-500" /> : <UploadCloud className="h-6 w-6 text-primary" />}
                </div>
                <div className="space-y-1">
                  {newDocFile ? (
                    <>
                      <p className="text-sm font-bold text-foreground">{newDocFile.name}</p>
                      <p className="text-xs text-muted-foreground font-medium">{(newDocFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        Arraste imagens, PDFs ou documentos Office
                      </p>
                      <p className="text-xs text-muted-foreground">ou clique para buscar (Max 10MB)</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/webp, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error("O arquivo excede o limite de 10MB.");
                        e.target.value = '';
                        return;
                      }
                      setNewDocFile(file);
                    }
                  }} 
                />
              </div>
            </div>

            <div className="space-y-2"><Label>Tipo *</Label><Select value={newDocForm.type} onValueChange={v => setNewDocForm(f => ({...f, type: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(documentTypeLabels).map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Emissão *</Label><HistoricalDatePicker value={newDocForm.date} onChange={(iso) => setNewDocForm(f => ({...f, date: iso }))} minYear={2020} locale={ptBR} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewDocDialogOpen(false)}>Cancelar</Button><Button onClick={handleCreateDocument} disabled={creatingDoc} className="min-w-[120px]">{creatingDoc ? <Loader2 className="animate-spin h-4 w-4" /> : "Registrar"}</Button></div>
      </ResponsiveModal>

      <ResponsiveModal open={newPostOpDialogOpen} onOpenChange={setNewPostOpDialogOpen} title="Agendar Pós-Operatório">
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Descrição *</Label><Input value={newPostOpForm.description} onChange={e => setNewPostOpForm(f => ({...f, description: e.target.value}))} /></div>
            <div className="space-y-2"><Label>Tipo *</Label><Select value={newPostOpForm.type} onValueChange={v => setNewPostOpForm(f => ({...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RETURN">Retorno</SelectItem><SelectItem value="SURGERY">Cirurgia</SelectItem><SelectItem value="PROCEDURE">Procedimento</SelectItem><SelectItem value="OTHER">Outro</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Data Agendada *</Label><HistoricalDatePicker value={newPostOpForm.date} onChange={(iso) => setNewPostOpForm(f => ({...f, date: iso }))} minYear={new Date().getFullYear()} locale={ptBR} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewPostOpDialogOpen(false)}>Cancelar</Button><Button onClick={handleCreatePostOp} disabled={creatingPostOp} className="min-w-[120px]">{creatingPostOp ? <Loader2 className="animate-spin h-4 w-4" /> : "Agendar"}</Button></div>
      </ResponsiveModal>

      <ResponsiveModal open={newApptDialogOpen} onOpenChange={setNewApptDialogOpen} title="Novo Agendamento">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Procedimento *</Label>
              <Select value={newApptForm.procedure} onValueChange={v => setNewApptForm(f => ({...f, procedure: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consulta Inicial">Consulta Inicial</SelectItem>
                  <SelectItem value="Retorno">Retorno</SelectItem>
                  <SelectItem value="Rinoplastia">Rinoplastia</SelectItem>
                  <SelectItem value="Lipoaspiração">Lipoaspiração</SelectItem>
                  <SelectItem value="Mamoplastia">Mamoplastia</SelectItem>
                  <SelectItem value="Abdominoplastia">Abdominoplastia</SelectItem>
                  <SelectItem value="Blefaroplastia">Blefaroplastia</SelectItem>
                  <SelectItem value="Otoplastia">Otoplastia</SelectItem>
                  <SelectItem value="Lipo HD">Lipo HD</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cirurgião / Médico *</Label>
              <Select value={newApptForm.surgeonId} onValueChange={v => setNewApptForm(f => ({...f, surgeonId: v}))}>
                <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                <SelectContent>
                  {surgeonsData?.surgeons?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.specialty})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <HistoricalDatePicker 
                  value={newApptForm.date} 
                  onChange={(iso) => setNewApptForm(f => ({...f, date: iso }))} 
                  minYear={new Date().getFullYear()} 
                  locale={ptBR} 
                />
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <TimePicker 
                  value={newApptForm.time} 
                  onChange={val => setNewApptForm(f => ({...f, time: val}))} 
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewApptDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateAppointment} disabled={creatingAppt} className="min-w-[120px]">
              {creatingAppt ? <Loader2 className="animate-spin h-4 w-4" /> : "Agendar"}
            </Button>
          </div>
      </ResponsiveModal>

      <ResponsiveModal open={deleteDocDialogOpen} onOpenChange={setDeleteDocDialogOpen} title="Confirmar Exclusão">
        <div className="py-4 text-sm text-muted-foreground">
          Tem certeza que deseja excluir este documento permanentemente? Esta ação não pode ser desfeita.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setDeleteDocDialogOpen(false); setDocToDelete(null); }}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDeleteDocument} disabled={deletingDoc} className="min-w-[100px]">
            {deletingDoc ? <Loader2 className="animate-spin h-4 w-4" /> : "Excluir"}
          </Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal open={deletePatientDialogOpen} onOpenChange={setDeletePatientDialogOpen} title="Excluir Paciente (LGPD)">
        <div className="py-4 space-y-4">
          <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-md text-sm">
            <strong>Atenção:</strong> Ao excluir este paciente, todos os dados pessoais (nome, CPF, telefone) dele e do Lead original serão permanentemente anonimizados para cumprimento da LGPD. Históricos financeiros e agendamentos serão preservados mas desvinculados do indivíduo.
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Para confirmar a anonimização, digite <strong>deletar</strong> abaixo:</Label>
            <Input 
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Digite deletar..."
              className="border-red-200 focus-visible:ring-red-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setDeletePatientDialogOpen(false); setDeleteConfirmText(""); }}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDeletePatient} disabled={deletingPatient || deleteConfirmText.toLowerCase() !== 'deletar'} className="min-w-[100px]">
            {deletingPatient ? <Loader2 className="animate-spin h-4 w-4" /> : "Excluir"}
          </Button>
        </div>
      </ResponsiveModal>
    </AppLayout>
  );
};

export default Patients;
