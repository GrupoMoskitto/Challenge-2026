import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Search, 
  MessageCircle, 
  Plus, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Phone, 
  PhoneCall, 
  Mail, 
  Filter, 
  Download, 
  Upload, 
  Loader2, 
  UserCheck, 
  CalendarCheck, 
  Info, 
  User, 
  Calendar, 
  Clock, 
  History as HistoryIcon, 
  XCircle, 
  Check, 
  X
} from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import { 
  GET_LEADS, 
  UPDATE_LEAD_STATUS, 
  CREATE_LEAD, 
  UPDATE_LEAD, 
  DELETE_LEAD, 
  GET_LEAD_CONTACTS, 
  EXPORT_LEADS, 
  IMPORT_LEADS 
} from "@/lib/queries";
import { sanitizeInput } from "@/lib/validation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { usePatientModal } from "@/components/PatientModalContext";
import { AuditDiff } from "@/components/AuditDiff";

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contato',
  QUALIFIED: 'Qualificado',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
};

const statusColors: Record<string, string> = {
  NEW: 'bg-gray-500',
  CONTACTED: 'bg-blue-500',
  QUALIFIED: 'bg-yellow-500',
  CONVERTED: 'bg-green-500',
  LOST: 'bg-red-500',
};

const statusColumns = [
  { status: 'NEW', label: 'Novo', color: 'border-t-gray-500' },
  { status: 'CONTACTED', label: 'Contato', color: 'border-t-blue-500' },
  { status: 'QUALIFIED', label: 'Qualificado', color: 'border-t-yellow-500' },
  { status: 'CONVERTED', label: 'Convertido', color: 'border-t-green-500' },
  { status: 'LOST', label: 'Perdido', color: 'border-t-red-500' },
];

const origins = ['Instagram', 'TikTok', 'Google Ads', 'Indicação', 'Site', 'Facebook', 'Outro'];
const procedures = ['Rinoplastia', 'Lipoaspiração', 'Mamoplastia', 'Abdominoplastia', 'Blefaroplastia', 'Otoplastia', 'Lipo HD', 'Outro'];

const auditActionLabels: Record<string, string> = {
  CREATED: "criado",
  UPDATED: "modificado",
  STATUS_CHANGE: "modificado",
  DELETED: "removido",
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

const getAuditMessage = (item: any, leadName?: string | null) => {
  if (item.action === 'STATUS_CHANGE') {
    return `Status alterado de ${item.oldValue} para ${item.newValue}`;
  }
  const safeName = leadName || "cliente";
  const actionLabel = auditActionLabels[item.action] || "modificado";
  return `Lead ${safeName} ${actionLabel}!`;
};

const StatusIconComponent = ({ status }: { status: string }) => {
  switch (status) {
    case 'READ':
    case 'ANSWERED':
    case 'SIGNED':
      return <Check className="h-3 w-3 text-green-500" />;
    case 'DELIVERED':
    case 'SENT':
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    case 'FAILED':
    case 'MISSED':
      return <X className="h-3 w-3 text-red-500" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
};

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  source: string;
  origin: string;
  procedure: string;
  whatsappActive: boolean;
  notes: string;
  status: string;
  createdAt: string;
  patient?: { id: string };
  appointments?: { id: string }[];
}

interface NewLeadForm {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  origin: string;
  procedure: string;
  whatsappActive: boolean;
  notes: string;
}

const initialNewLead: NewLeadForm = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  origin: 'Instagram',
  procedure: '',
  whatsappActive: false,
  notes: '',
};

const Leads = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { openCreatePatientModal } = usePatientModal();
  
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [filterOrigins, setFilterOrigins] = useState<string[]>([]);
  const [filterProcedures, setFilterProcedures] = useState<string[]>([]);
  const [filterWhatsapp, setFilterWhatsapp] = useState(false);
  const [filterIsPatient, setFilterIsPatient] = useState(false);
  const [filterHasAppointment, setFilterHasAppointment] = useState(false);
  
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "details");
  const [draggedLead, setDraggedLead] = useState<{ id: string; status: string } | null>(null);
  const [lastMovedLeadId, setLastMovedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [legendDialogOpen, setLegendDialogOpen] = useState(false);
  
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [newLead, setNewLead] = useState<NewLeadForm>(initialNewLead);
  const [editLead, setEditLead] = useState<NewLeadForm>(initialNewLead);
  
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, refetch } = useQuery(GET_LEADS, {
    variables: { first: 100, search: debouncedSearch || undefined },
    fetchPolicy: 'cache-and-network',
  });

  const [updateStatus] = useMutation(UPDATE_LEAD_STATUS, {
    update(cache, { data: mutationData }) {
      if (!mutationData?.updateLeadStatus) return;
      const { updateLeadStatus } = mutationData;
      cache.modify({
        id: cache.identify({ __typename: 'Lead', id: updateLeadStatus.id }),
        fields: {
          status() { return updateLeadStatus.status; },
        },
      });
    },
  });

  const [createLead] = useMutation(CREATE_LEAD);
  const [updateLead, { loading: updating }] = useMutation(UPDATE_LEAD);
  const [deleteLead, { loading: deleting }] = useMutation(DELETE_LEAD);
  const [exportLeads] = useMutation(EXPORT_LEADS);
  const [importLeads] = useMutation(IMPORT_LEADS);

  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) newParams.delete(key);
      else newParams.set(key, value);
    });
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
    const tab = searchParams.get("tab");
    if (tab && ["details", "timeline"].includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    updateUrl({ tab: v });
  };

  const handleDragStart = (l: Lead, e: React.DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (deleteDialogOpen || editDialogOpen || target?.closest('[data-no-drag="true"]')) {
      e.preventDefault();
      return;
    }
    setDraggedLead({ id: l.id, status: l.status });
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedLead || draggedLead.status === status) { setDraggedLead(null); return; }

    if (user?.role === 'RECEPTION' && (status === 'CONVERTED' || status === 'LOST')) {
      toast.error(`Permissão negada.`);
      setDraggedLead(null);
      return;
    }
    
    if (status === 'CONVERTED') {
      openCreatePatientModal(draggedLead.id, {
        onCancel: () => {
          toast.warning("É necessário preencher os dados.");
          setDraggedLead(null);
        }
      });
      return;
    }

    try {
      await updateStatus({
        variables: { input: { id: draggedLead.id, status } },
        optimisticResponse: {
          updateLeadStatus: {
            __typename: "Lead",
            id: draggedLead.id,
            status: status,
            updatedAt: new Date().toISOString(),
          }
        }
      });
      toast.success(`Lead movido para ${statusLabels[status]}`);
      const movedId = draggedLead.id;
      setLastMovedLeadId(movedId);
      
      setTimeout(() => {
        const el = document.getElementById(`lead-card-${movedId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setLastMovedLeadId(null), 3000);
      }, 100);
    } catch (err: any) { toast.error("Erro ao mover lead"); } finally { setDraggedLead(null); }
  };

  const handleEditClick = (l: Lead) => {
    setEditingLead(l);
    setEditLead({
      name: l.name,
      email: l.email || "",
      phone: l.phone,
      cpf: l.cpf || "",
      origin: l.origin || "Instagram",
      procedure: l.procedure || "",
      whatsappActive: l.whatsappActive,
      notes: l.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!editingLead) return;
    try {
      await updateLead({
        variables: {
          input: {
            id: editingLead.id,
            ...editLead,
            name: sanitizeInput(editLead.name),
            email: sanitizeInput(editLead.email),
            phone: sanitizeInput(editLead.phone),
            cpf: sanitizeInput(editLead.cpf),
            notes: sanitizeInput(editLead.notes),
          }
        }
      });
      refetch();
      setEditDialogOpen(false);
      toast.success("Lead atualizado!");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteLead = async () => {
    if (!deletingLeadId) return;
    if (deleteConfirmText.toLowerCase() !== 'deletar') {
      toast.error("Digite 'deletar' para confirmar");
      return;
    }
    try {
      await deleteLead({ variables: { id: deletingLeadId } });
      toast.success("Lead excluído!");
      setDeleteDialogOpen(false);
      setDeletingLeadId(null);
      setDeleteConfirmText("");
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateLead = async () => {
    try {
      await createLead({
        variables: {
          input: {
            ...newLead,
            source: newLead.origin,
            name: sanitizeInput(newLead.name),
            email: sanitizeInput(newLead.email),
          }
        }
      });
      refetch();
      setNewLead(initialNewLead);
      toast.success("Lead criado!");
    } catch (e: any) { toast.error(e.message); }
  };

  const confirmExport = async () => {
    try {
      setExporting(true);
      const { data: res } = await exportLeads();
      if (res?.exportLeads) { window.open(res.exportLeads, '_blank'); toast.success("Exportado!"); }
      setExportDialogOpen(false);
    } catch (e: any) { toast.error(e.message); } finally { setExporting(false); }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const { data: res } = await importLeads({ variables: { csvContent: content } });
        if (res?.importLeads?.success) { toast.success(`${res.importLeads.imported} leads importados!`); refetch(); setImportDialogOpen(false); }
        else { toast.error("Erro na importação"); }
      } catch (err: any) { toast.error(err.message); } finally { setImporting(false); }
    };
    reader.readAsText(file);
  };

  const allLeadsArr: Lead[] = data?.leads?.edges?.map((e: any) => e.node) || [];
  const hasActiveFilters = filterOrigins.length > 0 || filterProcedures.length > 0 || !!search || filterWhatsapp || filterIsPatient || filterHasAppointment;

  const filteredLeads = allLeadsArr.filter(l => 
    (search === "" || l.name.toLowerCase().includes(search.toLowerCase()) || l.cpf.includes(search) || l.phone.includes(search)) &&
    (filterOrigins.length === 0 || filterOrigins.includes(l.origin || "")) &&
    (filterProcedures.length === 0 || filterProcedures.includes(l.procedure || "")) &&
    (!filterWhatsapp || l.whatsappActive) &&
    (!filterIsPatient || !!l.patient) &&
    (!filterHasAppointment || (l.appointments?.length > 0))
  );

  const getLeadsByStatus = (s: string) => filteredLeads.filter(l => l.status === s);

  return (
    <AppLayout title="Gestão de Leads">
      <div className="flex flex-col min-h-screen">
        {/* Header & Global Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6 shrink-0">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CPF ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 shadow-sm" />
          </div>
          
          <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
            <DropdownMenuTrigger asChild>
              <Button variant={hasActiveFilters ? "default" : "outline"} className="h-10">
                <Filter className="h-4 w-4 mr-2" /> Filtros {hasActiveFilters && "Ativos"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-4 space-y-4 shadow-xl">
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Origem</Label>
                  <div className="flex flex-wrap gap-1">
                    {origins.map(o => (
                      <Button key={o} variant={filterOrigins.includes(o) ? "default" : "outline"} size="sm" className="text-[10px] h-6" onClick={() => setFilterOrigins(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o])}>{o}</Button>
                    ))}
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Procedimento</Label>
                  <div className="flex flex-wrap gap-1">
                    {procedures.slice(0, 6).map(p => (
                      <Button key={p} variant={filterProcedures.includes(p) ? "default" : "outline"} size="sm" className="text-[10px] h-6" onClick={() => setFilterProcedures(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}>{p}</Button>
                    ))}
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Outros</Label>
                  <div className="flex flex-wrap gap-1">
                    <Button variant={filterWhatsapp ? "default" : "outline"} size="sm" className="text-[10px] h-6" onClick={() => setFilterWhatsapp(v => !v)}>WhatsApp</Button>
                    <Button variant={filterIsPatient ? "default" : "outline"} size="sm" className="text-[10px] h-6" onClick={() => setFilterIsPatient(v => !v)}>Paciente</Button>
                    <Button variant={filterHasAppointment ? "default" : "outline"} size="sm" className="text-[10px] h-6" onClick={() => setFilterHasAppointment(v => !v)}>Agenda</Button>
                  </div>
               </div>
               {hasActiveFilters && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterOrigins([]); setFilterProcedures([]); setFilterWhatsapp(false); setFilterIsPatient(false); setFilterHasAppointment(false); }} className="w-full text-xs text-destructive pt-2 border-t mt-2 rounded-none">Limpar Filtros</Button>}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setImportDialogOpen(true)}><Upload className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Importar CSV</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setExportDialogOpen(true)}><Download className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Exportar CSV</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setLegendDialogOpen(true)}><Info className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Legenda</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>

          <Button onClick={() => setDialogOpen(true)} className="ml-auto shadow-md h-10"><Plus className="h-4 w-4 mr-2" /> Novo Lead</Button>
        </div>

        {/* Kanban Board Container */}
        <div className="overflow-x-auto no-scrollbar pb-6">
          <div className="flex gap-4 min-w-max items-start">
            {statusColumns.map(({ status, label, color }) => (
              <div
                key={status}
                className={cn("flex flex-col w-[300px] bg-muted/30 rounded-xl border border-border/50 transition-all min-h-[200px]", dragOverColumn === status && "ring-2 ring-primary bg-primary/5 shadow-inner")}
                onDragOver={e => { e.preventDefault(); setDragOverColumn(status); }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={e => handleDrop(e, status)}
              >
                <div className={cn("flex items-center justify-between p-4 rounded-t-xl border-t-4 shadow-sm bg-background shrink-0 sticky top-0 z-20", color)}>
                  <span className="font-bold text-sm tracking-tight">{label}</span>
                  <Badge variant="secondary" className="text-xs px-2 font-mono">{getLeadsByStatus(status).length}</Badge>
                </div>
                
                <div className="p-2 space-y-3">
                  {getLeadsByStatus(status).map(l => (
                    <Card
                      key={l.id}
                      id={`lead-card-${l.id}`}
                      className={cn(
                        "p-4 cursor-move border-l-4 transition-all hover:shadow-lg group relative",
                        lastMovedLeadId === l.id && "bg-primary/10 ring-2 ring-primary animate-pulse",
                        status === 'NEW' && "border-l-slate-400",
                        status === 'CONTACTED' && "border-l-blue-400",
                        status === 'QUALIFIED' && "border-l-yellow-400",
                        status === 'CONVERTED' && "border-l-green-400",
                        status === 'LOST' && "border-l-red-400"
                      )}
                      draggable
                      onDragStart={e => handleDragStart(l, e)}
                      onDragEnd={() => setDraggedLead(null)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate text-foreground group-hover:text-primary transition-colors">{l.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-muted text-muted-foreground border-none font-semibold">{l.origin}</Badge>
                            {l.procedure && <Badge className="text-[9px] h-3.5 px-1 bg-primary/10 text-primary border-none font-bold">{l.procedure}</Badge>}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full opacity-0 group-hover:opacity-100 hover:bg-background transition-all" data-no-drag="true">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 shadow-xl border-primary/5">
                            <DropdownMenuItem onClick={() => handleEditClick(l)} className="cursor-pointer"><Pencil className="h-4 w-4 mr-2" /> Editar Dados</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setActiveTab("timeline"); handleEditClick(l); }} className="cursor-pointer"><HistoryIcon className="h-4 w-4 mr-2" /> Ver Histórico</DropdownMenuItem>
                            {!l.patient && <DropdownMenuItem onClick={() => openCreatePatientModal(l.id)} className="cursor-pointer text-blue-600 font-bold focus:text-blue-700"><UserCheck className="h-4 w-4 mr-2" /> Converter</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => { setDeletingLeadId(l.id); setDeleteDialogOpen(true); }} className="text-destructive cursor-pointer font-medium"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-2 mt-4">
                        <div className="flex items-center gap-2.5 text-xs text-foreground/70 font-medium">
                          <div className={cn("p-1 rounded-full shadow-sm", l.whatsappActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground/30")}>
                            <Phone className="h-3 w-3" />
                          </div>
                          <span>{l.phone}</span>
                          {l.whatsappActive && <MessageCircle className="h-3.5 w-3.5 text-green-500" />}
                        </div>
                        {l.email && (
                          <div className="flex items-center gap-2.5 text-xs text-muted-foreground italic">
                             <div className="p-1 rounded-full bg-muted/40"><Mail className="h-3 w-3" /></div>
                             <span className="truncate">{l.email}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between shrink-0">
                        <time className="text-[10px] text-muted-foreground font-semibold">{format(new Date(l.createdAt), "dd/MM/yy")}</time>
                        {(l.appointments && l.appointments.length > 0) ? (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/5 text-primary">
                            <CalendarCheck className="h-3 w-3" /><span className="text-[10px] font-bold">{l.appointments.length}</span>
                          </div>
                        ) : <span className="text-[9px] uppercase text-muted-foreground/20 font-black tracking-tighter">Sem agenda</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals and Dialogs */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[750px] p-0 flex flex-col h-[85vh] shadow-2xl border-primary/10 overflow-hidden">
          <div className="px-10 py-8 border-b bg-gradient-to-b from-muted/20 to-transparent shrink-0">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <DialogTitle className="text-2xl font-black tracking-tight text-foreground/90">
                      {editingLead?.name || "Ficha do Lead"}
                    </DialogTitle>
                    {editingLead?.whatsappActive && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 px-2 py-0.5 font-bold">
                        <MessageCircle className="h-3 w-3" /> Verificado
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> 
                      Entrada em {editingLead?.createdAt ? format(new Date(editingLead.createdAt), "dd/MM/yyyy 'às' HH:mm") : ""}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    {editingLead?.status && <Badge className={cn("text-[10px] h-4 font-black uppercase tracking-widest", statusColors[editingLead.status])}>{statusLabels[editingLead.status]}</Badge>}
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="px-10 border-b justify-start h-auto p-0 bg-transparent gap-8 shrink-0">
              <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-4 font-bold text-sm transition-all hover:text-primary">Informações Gerais</TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-4 font-bold text-sm transition-all hover:text-primary">Linha do Tempo</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="p-10 overflow-y-auto flex-1 no-scrollbar bg-muted/5">
              <div className="space-y-8 max-w-[650px] mx-auto">
                <div className="grid gap-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Identificação</Label>
                  <div className="grid gap-2"><Label className="text-[11px] font-semibold">Nome Completo *</Label><Input value={editLead.name} onChange={e => setEditLead({...editLead, name: e.target.value})} className="h-11 bg-background shadow-sm border-muted-foreground/20" /></div>
                </div>

                <div className="grid gap-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Contatos</Label>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="grid gap-2"><Label className="text-[11px] font-semibold">E-mail</Label><Input value={editLead.email} onChange={e => setEditLead({...editLead, email: e.target.value})} className="h-11 bg-background shadow-sm border-muted-foreground/20" /></div>
                     <div className="grid gap-2"><Label className="text-[11px] font-semibold">Telefone *</Label><Input value={editLead.phone} onChange={e => setEditLead({...editLead, phone: e.target.value})} className="h-11 bg-background shadow-sm border-muted-foreground/20" /></div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Detalhes Adicionais</Label>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="grid gap-2"><Label className="text-[11px] font-semibold">CPF</Label><Input value={editLead.cpf} onChange={e => setEditLead({...editLead, cpf: e.target.value})} className="h-11 bg-background shadow-sm border-muted-foreground/20" /></div>
                    <div className="grid gap-2"><Label className="text-[11px] font-semibold">Procedimento de Interesse</Label>
                      <Select value={editLead.procedure} onValueChange={v => setEditLead({...editLead, procedure: v})}>
                        <SelectTrigger className="h-11 bg-background shadow-sm border-muted-foreground/20"><SelectValue placeholder="Selecione um procedimento" /></SelectTrigger>
                        <SelectContent>{procedures.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="grid gap-2"><Label className="text-[11px] font-semibold">Origem</Label>
                    <Select value={editLead.origin} onValueChange={v => setEditLead({...editLead, origin: v})}>
                      <SelectTrigger className="h-11 bg-background shadow-sm border-muted-foreground/20"><SelectValue placeholder="Selecione a origem" /></SelectTrigger>
                      <SelectContent>{origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
                    <input type="checkbox" id="whatsappActive" checked={editLead.whatsappActive} onChange={e => setEditLead({...editLead, whatsappActive: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <Label htmlFor="whatsappActive" className="text-sm font-medium cursor-pointer">WhatsApp validado</Label>
                  </div>
                </div>

                <div className="grid gap-2"><Label className="text-[11px] font-semibold">Observações Internas</Label>
                  <textarea value={editLead.notes} onChange={e => setEditLead({...editLead, notes: e.target.value})} className="min-h-[140px] w-full rounded-md border border-muted-foreground/20 bg-background px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Anotações cruciais sobre a jornada do lead..." />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="timeline" className="p-0 overflow-y-auto flex-1 no-scrollbar bg-muted/5">
              <LeadTimeline leadId={editingLead?.id} />
            </TabsContent>
            <div className="p-4 border-t bg-background flex justify-between items-center shrink-0">
               <p className="text-xs text-muted-foreground italic">Campos com * são obrigatórios.</p>
               <div className="flex gap-2">
                 <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="h-10 px-6">Cancelar</Button>
                 <Button onClick={handleUpdateLead} disabled={updating} className="h-10 px-8 shadow-md">{updating ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar Alterações"}</Button>
               </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border-destructive/20 shadow-2xl"><DialogHeader><DialogTitle className="text-destructive flex items-center gap-2"><XCircle className="h-5 w-5" /> Excluir Lead</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">Digite <span className="font-bold text-destructive">deletar</span> para confirmar:</p>
            <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="deletar" className="border-destructive h-11 text-center font-bold" />
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button><Button variant="destructive" className="flex-1 shadow-lg" onClick={handleDeleteLead} disabled={deleting || deleteConfirmText.toLowerCase() !== 'deletar'}>Excluir</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}><DialogContent className="sm:max-w-[400px]"><DialogHeader><DialogTitle>Exportar Leads</DialogTitle><DialogDescription>Deseja exportar a lista filtrada para CSV?</DialogDescription></DialogHeader>
        <div className="flex justify-end gap-2 pt-6"><Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancelar</Button><Button onClick={confirmExport} disabled={exporting} className="shadow-lg">{exporting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />} Exportar</Button></div>
      </DialogContent></Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}><DialogContent className="sm:max-w-[500px]"><DialogHeader><DialogTitle>Importação</DialogTitle><DialogDescription>Selecione um arquivo CSV estruturado.</DialogDescription></DialogHeader>
        <div className="py-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center space-y-4 bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer border-primary/20 group relative">
          <Upload className="h-7 w-7 text-primary group-hover:scale-110 transition-transform" />
          <p className="text-sm font-bold text-muted-foreground text-center px-4">Clique para carregar CSV</p>
          <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} disabled={importing} />
        </div>
        <div className="flex justify-end pt-4"><Button variant="outline" onClick={() => setImportDialogOpen(false)}>Fechar</Button></div>
      </DialogContent></Dialog>

      <Dialog open={legendDialogOpen} onOpenChange={setLegendDialogOpen}><DialogContent className="sm:max-w-[450px]"><DialogHeader><DialogTitle className="text-lg font-bold">Legenda</DialogTitle></DialogHeader>
        <div className="space-y-8 py-6">
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fases</h4>
            <div className="grid gap-3">{statusColumns.map(c => <div key={c.status} className="flex items-center gap-4"><div className={cn("w-4 h-4 rounded-full border shadow-sm", c.color.replace('border-t-', 'bg-'))} /><span className="text-sm font-bold">{c.label}</span></div>)}</div>
          </div>
          <div className="space-y-4 pt-6 border-t">
            <h4 className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Ícones</h4>
            <div className="grid gap-4">
              <div className="flex items-center gap-4 text-sm font-medium"><CalendarCheck className="h-5 w-5 text-primary" /><span>Lead com agendamento</span></div>
              <div className="flex items-center gap-4 text-sm font-medium"><MessageCircle className="h-5 w-5 text-green-500" /><span>WhatsApp ativo</span></div>
            </div>
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={() => setLegendDialogOpen(false)} className="w-full h-11">Entendi</Button></div>
      </DialogContent></Dialog>
      
      {/* Create Lead Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2"><Label>Nome *</Label><Input value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Telefone *</Label><Input value={newLead.phone} onChange={e => setNewLead({...newLead, phone: e.target.value})} /></div>
              <div className="grid gap-2"><Label>CPF</Label><Input value={newLead.cpf} onChange={e => setNewLead({...newLead, cpf: e.target.value})} /></div>
            </div>
            <div className="grid gap-2"><Label>Origem</Label>
              <Select value={newLead.origin} onValueChange={v => setNewLead({...newLead, origin: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Procedimento</Label>
              <Select value={newLead.procedure} onValueChange={v => setNewLead({...newLead, procedure: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{procedures.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleCreateLead}>Criar Lead</Button></div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

function LeadTimeline({ leadId }: { leadId?: string }) {
  const { data: contactsData, loading: contactsLoading } = useQuery(GET_LEAD_CONTACTS, { variables: { leadId }, skip: !leadId, fetchPolicy: 'cache-and-network' });
  if (!leadId) return null;
  if (contactsLoading) return <div className="space-y-4 p-8"><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;

  const contacts = contactsData?.contactsByLead || [];
  const auditLogs = contactsData?.lead?.auditLogs || [];
  const timelineItems = [
    ...contacts.map((c: any) => ({ ...c, itemType: 'CONTACT', timestamp: new Date(c.date) })),
    ...auditLogs.map((l: any) => ({ ...l, itemType: 'AUDIT', timestamp: new Date(l.createdAt) }))
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (timelineItems.length === 0) return <div className="text-center py-20 bg-background/50 m-6 rounded-xl border border-dashed"><Info className="h-8 w-8 mx-auto mb-3 opacity-20" /><p className="text-sm text-muted-foreground">Nenhum evento registrado na linha do tempo.</p></div>;

  return (
    <div className="p-6 relative min-h-full">
      <div className="absolute top-6 bottom-6 left-[43px] w-px bg-border/60 z-0"></div>
      <div className="space-y-8 relative z-10">
        {timelineItems.map((item: any) => {
          const isContact = item.itemType === 'CONTACT';
          const meta = !isContact ? getAuditActionMeta(item.action) : null;
          const IconComp = isContact ? (item.type === 'WHATSAPP' ? MessageCircle : item.type === 'EMAIL' ? Mail : PhoneCall) : meta!.icon;
          const colorClass = isContact 
            ? (item.type === 'WHATSAPP' ? "text-green-600 bg-green-500/10 border-green-500/20" : item.type === 'EMAIL' ? "text-purple-600 bg-purple-500/10 border-purple-500/20" : "text-blue-600 bg-blue-500/10 border-blue-500/20")
            : meta!.containerClassName + " " + meta!.iconClassName.replace('text-', 'border-') + " border border-primary/10 bg-background";

          return (
            <div key={item.id} className="relative flex items-start gap-5 group">
              <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border-2 bg-background shrink-0 shadow-sm transition-transform group-hover:scale-105", colorClass)}>
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
                
                <p className="text-sm text-foreground/90 leading-relaxed font-medium mt-1">
                  {isContact ? item.message : getAuditMessage(item, contactsData?.lead?.name)}
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

export default Leads;
