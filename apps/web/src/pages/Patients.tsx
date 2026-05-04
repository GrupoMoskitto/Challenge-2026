import React, { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Info
} from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import {
  GET_PATIENTS,
  GET_PATIENT,
  UPDATE_PATIENT,
  CREATE_DOCUMENT,
  CREATE_POST_OP,
} from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const { openCreatePatientModal } = usePatientModal();
  const [searchParams, setSearchParams] = useSearchParams();
  
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
    const urlSearch = searchParams.get("search") || "";
    const urlStatus = searchParams.get("status") || "";
    const urlPatientId = searchParams.get("patientId") || null;
    const urlTab = searchParams.get("tab") || "timeline";

    if (search !== urlSearch) { setSearch(urlSearch); setDebouncedSearch(urlSearch); }
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

  const { data: patientsData, previousData: prevPatientData, loading: loadingPatients, fetchMore } = useQuery(GET_PATIENTS, {
    variables: { first: PAGE_SIZE, where: { search: debouncedSearch || undefined, status: statusFilter || undefined } },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: 'cache-and-network',
  });

  const { data: patientQueryData, loading: loadingPatient, refetch: refetchPatient } = useQuery(GET_PATIENT, {
    variables: { id: selectedPatientId || "" },
    skip: !selectedPatientId,
    fetchPolicy: 'cache-and-network',
  });

  const currentPatientRef = useRef<any>(null);
  useEffect(() => { if (patientQueryData?.patient) currentPatientRef.current = patientQueryData.patient; }, [patientQueryData]);

  const patient = patientQueryData?.patient || currentPatientRef.current;

  const [updatePatient, { loading: updatingPatient }] = useMutation(UPDATE_PATIENT);
  const [createDocument, { loading: creatingDoc }] = useMutation(CREATE_DOCUMENT);
  const [createPostOp, { loading: creatingPostOp }] = useMutation(CREATE_POST_OP);

  const [editPatientDialogOpen, setEditPatientDialogOpen] = useState(false);
  const [editPatientForm, setEditPatientForm] = useState({
    dateOfBirth: "", medicalRecord: "", address: "", sex: "", weight: "", height: "", howMet: "", reason: ""
  });

  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ name: "", type: "CONTRACT", date: new Date().toISOString().split('T')[0] });
  const [newPostOpDialogOpen, setNewPostOpDialogOpen] = useState(false);
  const [newPostOpForm, setNewPostOpForm] = useState({ description: "", type: "RETURN", date: new Date().toISOString().split('T')[0] });

  const effectivePatientsData = patientsData || prevPatientData;
  const pagination = effectivePatientsData?.patients?.pageInfo;
  const patientList = effectivePatientsData?.patients?.edges?.map((e: any) => e.node) || [];

  const handleTabChange = useCallback((v: string) => { setActiveTab(v); updateUrl({ tab: v }); }, [updateUrl]);

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
    if (!selectedPatientId || !newDocForm.name) return;
    try {
      await createDocument({
        variables: {
          input: {
            patientId: selectedPatientId,
            name: newDocForm.name,
            type: newDocForm.type,
            date: new Date(newDocForm.date).toISOString()
          }
        }
      });
      toast.success("Documento registrado!");
      setNewDocDialogOpen(false);
      setNewDocForm({ name: "", type: "CONTRACT", date: new Date().toISOString().split('T')[0] });
      refetchPatient();
    } catch (e: any) { toast.error(e.message); }
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

  if (loadingPatients && !patientsData) {
    return <AppLayout title="Pacientes"><div className="flex gap-6"><div className="w-1/3 space-y-2"><Skeleton className="h-10 w-full" />{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div><div className="flex-1 space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div></div></AppLayout>;
  }

  return (
    <AppLayout title="Pacientes">
      <div className="flex gap-6">
        <div className="w-1/3 space-y-4">
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

        <div className="flex-1 min-w-0">
          {loadingPatient && !patient ? <div className="space-y-4"><Skeleton className="h-64 w-full" /><CardListSkeleton count={3} /></div> : patient ? (
            <div className={cn("space-y-4 transition-opacity", loadingPatient && "opacity-60")}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Dados Pessoais</CardTitle>
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Telefone</span><p>{patient.lead?.phone}</p></div>
                    <div><span className="text-muted-foreground">E-mail</span><p className="truncate">{patient.lead?.email}</p></div>
                    <div><span className="text-muted-foreground">Data de Nascimento</span><p>{patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p></div>
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
                <TabsList className="w-full">
                  <TabsTrigger value="timeline" className="flex-1">Linha do Tempo</TabsTrigger>
                  <TabsTrigger value="documents" className="flex-1">Documentos</TabsTrigger>
                  <TabsTrigger value="postop" className="flex-1">Pós-Operatório</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline" className="mt-6">
                  <PatientTimeline patient={patient} />
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
                              <p className="text-sm font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">{documentTypeLabels[doc.type]} • {format(new Date(doc.date), 'dd/MM/yyyy')}</p>
                            </div>
                          </div>
                          <Badge 
                            variant={doc.status === 'SIGNED' ? 'default' : 'outline'}
                            className={cn(doc.status === 'SIGNED' && "bg-emerald-600 text-white border-none")}
                          >
                            {documentStatusLabels[doc.status]}
                          </Badge>
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

      <Dialog open={editPatientDialogOpen} onOpenChange={setEditPatientDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar Paciente</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nascimento</Label><HistoricalDatePicker value={editPatientForm.dateOfBirth} onChange={iso => setEditPatientForm(f => ({...f, dateOfBirth: iso}))} minYear={1900} locale={ptBR} /></div>
              <div className="space-y-2"><Label>Prontuário</Label><Input value={editPatientForm.medicalRecord} onChange={e => setEditPatientForm(f => ({...f, medicalRecord: e.target.value}))} /></div>
            </div>
            <div className="space-y-2"><Label>Endereço</Label><Input value={editPatientForm.address} onChange={e => setEditPatientForm(f => ({...f, address: e.target.value}))} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Sexo</Label><Select value={editPatientForm.sex} onValueChange={v => setEditPatientForm(f => ({...f, sex: v}))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="Masculino">Masculino</SelectItem><SelectItem value="Feminino">Feminino</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Peso (kg)</Label><Input type="number" step="0.1" value={editPatientForm.weight} onChange={e => setEditPatientForm(f => ({...f, weight: e.target.value}))} /></div>
              <div className="space-y-2"><Label>Altura (cm)</Label><Input type="number" step="1" value={editPatientForm.height} onChange={e => setEditPatientForm(f => ({...f, height: e.target.value}))} /></div>
            </div>
            <div className="space-y-2"><Label>Como nos conheceu</Label><Input value={editPatientForm.howMet} onChange={e => setEditPatientForm(f => ({...f, howMet: e.target.value}))} /></div>
            <div className="space-y-2"><Label className="text-primary font-bold">Motivo da Alteração *</Label><Input placeholder="Obrigatório para o histórico" value={editPatientForm.reason} onChange={e => setEditPatientForm(f => ({...f, reason: e.target.value}))} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditPatientDialogOpen(false)}>Cancelar</Button><Button onClick={handleUpdatePatient} disabled={updatingPatient || !editPatientForm.reason}>Salvar</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={newDocDialogOpen} onOpenChange={setNewDocDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome do Arquivo *</Label><Input value={newDocForm.name} onChange={e => setNewDocForm(f => ({...f, name: e.target.value}))} /></div>
            <div className="space-y-2"><Label>Tipo *</Label><Select value={newDocForm.type} onValueChange={v => setNewDocForm(f => ({...f, type: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(documentTypeLabels).map(([val, label]) => <SelectItem key={val} value={val}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Emissão *</Label><HistoricalDatePicker value={newDocForm.date} onChange={(iso) => setNewDocForm(f => ({...f, date: iso }))} minYear={2020} locale={ptBR} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewDocDialogOpen(false)}>Cancelar</Button><Button onClick={handleCreateDocument} disabled={creatingDoc} className="min-w-[120px]">{creatingDoc ? <Loader2 className="animate-spin h-4 w-4" /> : "Registrar"}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={newPostOpDialogOpen} onOpenChange={setNewPostOpDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Agendar Pós-Operatório</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Descrição *</Label><Input value={newPostOpForm.description} onChange={e => setNewPostOpForm(f => ({...f, description: e.target.value}))} /></div>
            <div className="space-y-2"><Label>Tipo *</Label><Select value={newPostOpForm.type} onValueChange={v => setNewPostOpForm(f => ({...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RETURN">Retorno</SelectItem><SelectItem value="SURGERY">Cirurgia</SelectItem><SelectItem value="PROCEDURE">Procedimento</SelectItem><SelectItem value="OTHER">Outro</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Data Agendada *</Label><HistoricalDatePicker value={newPostOpForm.date} onChange={(iso) => setNewPostOpForm(f => ({...f, date: iso }))} minYear={new Date().getFullYear()} locale={ptBR} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewPostOpDialogOpen(false)}>Cancelar</Button><Button onClick={handleCreatePostOp} disabled={creatingPostOp} className="min-w-[120px]">{creatingPostOp ? <Loader2 className="animate-spin h-4 w-4" /> : "Agendar"}</Button></div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Patients;
